"""
vet_features.py — WSPÓLNY moduł cech Guardian Care VET-EYE.

Ten sam plik musi być w repozytorium backendu (obok main.py) ORAZ w Colab (obok train_model.py).
Gwarantuje, że trening i serwis liczą cechy IDENTYCZNIE (kontrakt train<->serve).

Zawiera:
  - reindeksację do ciągłej osi godzinowej + imputację stanu spoczynku (BRAK SYNC),
  - cechy pochodne (rolling 24h, delta temperatury, korelacja krzyżowa SNR/CPU),
  - budowę okien sekwencyjnych 24h dla sieci LSTM,
  - skalowanie spójne train/serve.
"""
import numpy as np
import pandas as pd

# ==========================================
# STAŁE — JEDNO ŹRÓDŁO PRAWDY DLA CAŁEGO PROJEKTU
# ==========================================
WINDOW = 24            # długość okna sekwencji (24h) — zgodnie z pracą (F-04)
R_MAX = 168            # Piecewise Linear RUL — sufit 7 dni (168h), zgodnie z pracą (3.3, F-05)

# Wektor spoczynku (imputacja luk / BRAK SYNC):
ROOM_TEMP = 22.0       # temperatura pokojowa (praca F-03: "temperatura = pokojowa")
IDLE_CPU = 0.0         # praca F-03: "CPU = 0"
# SNR i napięcie NIE są stałą — są forward-fill z ostatniego realnego odczytu urządzenia
# (żeby nie "uzdrawiać" urządzenia, które już wykazywało anomalie).

NOMINAL_SNR = 45.0     # odniesienie do cechy krzyżowej (nie do imputacji)

# Progi pasm decyzyjnych (Moduł F). Ściśle poniżej R_MAX, by zdrowe (~168) były NORMAL.
BAND_CRITICAL = 24.0   # RUL < 24h  -> CRITICAL
BAND_PREFAIL = 144.0   # 24 <= RUL < 144 -> PRE-FAILURE ; >=144 -> NORMAL

# Kolejność kanałów w sekwencji — MUSI być identyczna train i serve
CHANNELS = [
    'ambient_temp_c', 'temp_c', 'snr_db', 'voltage_v', 'cpu_pct',
    'temp_rolling_24h', 'snr_rolling_24h', 'delta_temp', 'snr_cpu_cross',
    'device_model_encoded', 'is_imputed'
]
# Kanały skalowane (ciągłe). is_imputed (indeks 10) zostaje surowy (flaga 0/1).
SCALE_COLS = list(range(10))


def build_device_frame(df_device, model_encoded, end_ts=None):
    """
    Buduje ciągłą, godzinową ramkę cech dla JEDNEGO urządzenia.

    df_device : realne wiersze urządzenia (kolumny: timestamp, ambient_temp_c, temp_c,
                snr_db, voltage_v, cpu_pct, opcjonalnie RUL_hours), timestamp jako string/datetime.
    model_encoded : int — zakodowany model urządzenia (stały kanał).
    end_ts : datetime lub None. None -> koniec = ostatni realny odczyt (trening).
             Podany -> koniec = end_ts; brakujące godziny do end_ts są imputowane (serwis, BRAK SYNC).

    Zwraca DataFrame z kolumnami CHANNELS + 'is_imputed' + (jeśli było) 'RUL_hours'.
    """
    d = df_device.copy()
    d['timestamp'] = pd.to_datetime(d['timestamp'])
    d = d.sort_values('timestamp').set_index('timestamp')
    d = d[~d.index.duplicated(keep='last')]

    start = d.index.min()
    end = pd.to_datetime(end_ts) if end_ts is not None else d.index.max()
    if pd.isna(start) or pd.isna(end) or end < start:
        return None

    full = pd.date_range(start=start, end=end, freq='h')
    real_index = d.index
    d = d.reindex(full)

    # Flaga imputacji: wiersz nie miał realnego odczytu
    d['is_imputed'] = (~d.index.isin(real_index)).astype(float)

    # --- IMPUTACJA STANU SPOCZYNKU ---
    # Stałe spoczynku (fizyka wyłączonego urządzenia):
    d['cpu_pct'] = d['cpu_pct'].where(d['is_imputed'] == 0, IDLE_CPU)
    d['temp_c'] = d['temp_c'].where(d['is_imputed'] == 0, ROOM_TEMP)
    d['ambient_temp_c'] = d['ambient_temp_c'].where(d['is_imputed'] == 0, ROOM_TEMP)
    # SNR i napięcie: forward-fill z ostatniego realnego odczytu (nie "uzdrawiamy" chorego urządzenia)
    d['snr_db'] = d['snr_db'].ffill().bfill()
    d['voltage_v'] = d['voltage_v'].ffill().bfill()
    # Zabezpieczenie: gdyby pierwsze wiersze były imputowane (brak realnego do ffill)
    d['cpu_pct'] = d['cpu_pct'].fillna(IDLE_CPU)
    d['temp_c'] = d['temp_c'].fillna(ROOM_TEMP)
    d['ambient_temp_c'] = d['ambient_temp_c'].fillna(ROOM_TEMP)
    d['snr_db'] = d['snr_db'].fillna(NOMINAL_SNR)
    d['voltage_v'] = d['voltage_v'].fillna(221.0)

    # --- CECHY POCHODNE (Moduł D) ---
    d['temp_rolling_24h'] = d['temp_c'].rolling(WINDOW, min_periods=1).mean()
    d['snr_rolling_24h'] = d['snr_db'].rolling(WINDOW, min_periods=1).mean()
    # delta temperatury: tempo nagrzewania (praca 3.2)
    d['delta_temp'] = d['temp_c'].diff().fillna(0.0)
    # korelacja krzyżowa: jednoczesny spadek SNR i wzrost CPU (praca 3.2, F-04)
    d['snr_cpu_cross'] = (d['cpu_pct'] / 100.0) * np.maximum(0.0, NOMINAL_SNR - d['snr_db'])

    d['device_model_encoded'] = float(model_encoded)

    # RUL: zostaje tylko na realnych wierszach (imputowane -> NaN; nie fabrykujemy etykiet)
    if 'RUL_hours' not in d.columns:
        d['RUL_hours'] = np.nan

    return d.reset_index().rename(columns={'index': 'timestamp'})


def make_training_sequences(frame, stride=1):
    """
    Z ciągłej ramki jednego urządzenia buduje okna treningowe 24h.
    Okno emitowane TYLKO gdy ostatni krok jest realnym odczytem (etykieta RUL realna).
    stride : co ile godzin próbkować okna (redukcja pamięci przy dużej flocie).
    Zwraca (X_list, y_list): listy okien [WINDOW, C] i etykiet (RUL przyciętych do R_MAX).
    """
    X, y = [], []
    if frame is None or len(frame) < WINDOW:
        return X, y
    arr = frame[CHANNELS].to_numpy(dtype=float)
    imputed = frame['is_imputed'].to_numpy()
    rul = frame['RUL_hours'].to_numpy()
    for i in range(len(frame) - 1, WINDOW - 2, -stride):
        if imputed[i] == 0 and not np.isnan(rul[i]):
            X.append(arr[i - WINDOW + 1: i + 1])
            y.append(min(rul[i], R_MAX))
    return X, y


def make_serving_window(frame):
    """Ostatnie WINDOW kroków ciągłej ramki -> [1, WINDOW, C]. Do predykcji w serwisie."""
    if frame is None or len(frame) < WINDOW:
        return None
    arr = frame[CHANNELS].to_numpy(dtype=float)
    return arr[-WINDOW:][np.newaxis, ...]


def fit_scaler(X):
    """Dopasowuje StandardScaler na kanałach ciągłych. X: [n, WINDOW, C]."""
    from sklearn.preprocessing import StandardScaler
    n, w, c = X.shape
    flat = X.reshape(n * w, c)
    sc = StandardScaler()
    sc.fit(flat[:, SCALE_COLS])
    return sc


def apply_scaler(X, scaler):
    """Skaluje kanały ciągłe, zostawia is_imputed. Działa dla [n, WINDOW, C]."""
    Xs = X.copy().astype(float)
    n, w, c = Xs.shape
    flat = Xs.reshape(n * w, c)
    flat[:, SCALE_COLS] = scaler.transform(flat[:, SCALE_COLS])
    return flat.reshape(n, w, c)


def band_from_rul(rul):
    """Mapuje RUL na pasmo decyzyjne (spójne train-eval i serwis)."""
    if rul < BAND_CRITICAL:
        return 'CRITICAL'
    if rul < BAND_PREFAIL:
        return 'PRE-FAILURE'
    return 'NORMAL'
