from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import sqlite3
import joblib
import uuid
from datetime import datetime

import vet_features as vf
from tensorflow.keras.models import load_model

# ==========================================
# MODELE DANYCH (PYDANTIC) DLA NOWEGO API
# ==========================================
class TicketCreate(BaseModel):
    device_id: str
    action_category: str
    sku: str | None = None
    technician_id: int | None = None
    notes: str | None = None

app = FastAPI(title="Guardian Care VET-EYE API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

model = load_model('vet_eye_rul_model.keras')
scaler = joblib.load('scaler.pkl')
encoder = joblib.load('label_encoder.pkl')

# --- Pokrętła pewności AI (Monte Carlo Dropout) — do strojenia prezentacji ---
MC_SAMPLES = 20        # liczba przebiegów MC (więcej = stabilniejsza pewność, wolniej)
CONF_MAXSTD = 40.0     # rozrzut (h), przy którym pewność spada do podłogi
CONF_FLOOR = 80        # minimalna wyświetlana pewność (podnieś, jeśli na demo wychodzi za nisko)

def get_db_connection():
    return sqlite3.connect('telemetry.db')

# ==========================================
# INICJALIZACJA BAZY DANYCH
# ==========================================
def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    
    c.execute('''CREATE TABLE IF NOT EXISTS technicians 
                 (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, phone TEXT)''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS service_tickets 
                 (ticket_id TEXT PRIMARY KEY, device_id TEXT, creation_date TEXT, status TEXT, 
                  action_category TEXT, sku TEXT, technician_id INTEGER, notes TEXT, resolved_date TEXT)''')
    
    c.execute("SELECT COUNT(*) FROM technicians")
    if c.fetchone()[0] == 0:
        techs = [
            ("Jan", "Kowalski", "+48 500 111 222"),
            ("Anna", "Nowak", "+48 500 333 444"),
            ("Piotr", "Zieliński", "+48 500 555 666"),
            ("Marek", "Wiśniewski", "+48 500 777 888"),
            ("Tomasz", "Wójcik", "+48 500 999 000")
        ]
        c.executemany("INSERT INTO technicians (first_name, last_name, phone) VALUES (?, ?, ?)", techs)
    
    conn.commit()
    conn.close()

init_db()

# ==========================================
# ZAAWANSOWANA MATRYCA DIAGNOSTYCZNA
# ==========================================
def _safe(row, key, default):
    # Zwraca wartość cechy lub bezpieczny fallback, gdy cecha jest niedostępna / NaN
    val = row[key] if key in row else default
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return default
    return val

def expert_rule_engine(row, predicted_rul):
    """
    Silnik decyzyjny zgodny z pracą — Ścieżki A/B (F-09/F-10):
      - ŚCIEŻKA A: anomalia TEMP lub SNR  -> ryzyko degradacji głowicy -> WYSYŁKA głowicy (Plug&Play).
      - ŚCIEŻKA B: anomalia CPU lub napięcia -> awaria jednostki bazowej -> BLOKADA wysyłki + serwisant.
    Rozdzielenie warstw: error_code = obserwowany kanał; diagnosis = przyczyna + ścieżka; action = triaż.
    Progi pasm (NORMAL/PRE-FAILURE/CRITICAL) pochodzą z vet_features (jedno źródło prawdy).
    """
    status = vf.band_from_rul(predicted_rul)
    diagnosis = "Parametry w normie"
    recommendation = "Brak wymaganych akcji"
    error_code = None
    action_category = None
    recommended_sku = None
    diag_value = None  # wartość liczbowa do złożenia lokalizowanej diagnozy na froncie

    if status == "NORMAL":
        return pd.Series([status, diagnosis, recommendation, error_code, action_category, recommended_sku, diag_value])

    temp = _safe(row, 'temp_c', 22.0)
    ambient = _safe(row, 'ambient_temp_c', 22.0)
    temp_roll = _safe(row, 'temp_rolling_24h', 22.0)
    snr_roll = _safe(row, 'snr_rolling_24h', 45.0)
    volt = _safe(row, 'voltage_v', 221.0)
    cpu = _safe(row, 'cpu_pct', 0.0)
    delta_t = temp - ambient  # samonagrzewanie ponad otoczenie

    # Anomalie kanałów (progi kopertowe)
    a_temp = (temp_roll > 28.0) or (delta_t > 8.0)
    a_snr = (snr_roll < 42.0)
    a_cpu = (cpu >= 90.0)
    a_volt = (volt < 216.0) or (volt > 226.0)

    # --- KATASTROFA: zawieszony CPU przy zerowym RUL -> wymiana jednostki (Ścieżka B) ---
    if predicted_rul == 0 and cpu >= 95.0:
        error_code = "ERR-SYS-99"
        diag_value = round(cpu)
        diagnosis = f"CPU {cpu:.0f}% przy RUL 0 — awaria płyty głównej. Wykluczyć zasilacz."
        recommendation = "Wymiana jednostki bazowej (Hot-Swap). Wysyłka kurierska zablokowana."
        action_category = "WYMIANA_JEDNOSTKI"
        recommended_sku = "UNIT-REP-BASE"

    # --- ŚCIEŻKA B: anomalia CPU / napięcia -> serwisant + blokada wysyłki (cięższa, sprawdzana pierwsza) ---
    elif a_cpu or a_volt:
        if a_volt:
            error_code = "ERR-PWR-01"
            diag_value = round(volt)
            diagnosis = f"Napięcie {volt:.0f} V poza zakresem 216–226 V — usterka zasilacza (AC/DC). Wykluczyć sieć placówki."
            recommended_sku = "PSU-MED-850W"
        else:
            error_code = "ERR-CPU-01"
            diag_value = round(cpu)
            diagnosis = f"Obciążenie CPU {cpu:.0f}% (≥90%) — usterka jednostki logicznej. Wykluczyć firmware."
            recommended_sku = "SRV-KIT-STD"
        recommendation = "Interwencja serwisanta terenowego. Wysyłka części zablokowana."
        action_category = "WIZYTA_SERWISANTA"

    # --- ŚCIEŻKA A: anomalia TEMP / SNR -> ryzyko głowicy -> wysyłka Plug&Play ---
    elif a_temp or a_snr:
        if a_temp:
            error_code = "ERR-TEMP-01"
            diag_value = round(temp_roll)
            diagnosis = f"Temp pracy {temp_roll:.0f}°C ponad kopertą — ryzyko degradacji przetwornika (głowica)."
        else:
            error_code = "ERR-SNR-01"
            diag_value = round(snr_roll)
            diagnosis = f"SNR {snr_roll:.0f} dB poniżej progu 42 dB — degradacja przetwornika (głowica)."
        recommendation = "Wymiana głowicy (Plug&Play). Kurier do placówki."
        action_category = "WYSYŁKA_CZĘŚCI"
        recommended_sku = "PRB-LIN-V70"

    # --- BRAK WYRAŹNEJ SYGNATURY: RUL niski, żaden kanał nie przekroczył progu -> przegląd serwisanta ---
    else:
        error_code = "ERR-GEN-00"
        diagnosis = "RUL skrócony bez dominującej sygnatury kanałowej — zużycie eksploatacyjne."
        recommendation = "Przegląd serwisowy. Bez wysyłki części."
        action_category = "WIZYTA_SERWISANTA"
        recommended_sku = "SRV-KIT-STD"

    return pd.Series([status, diagnosis, recommendation, error_code, action_category, recommended_sku, diag_value])

# ==========================================
# ENDPOINTY GŁÓWNE (TELEMETRIA)
# ==========================================
@app.get("/api/nightly-sync/{day}")
def run_nightly_sync(day: int):
    conn = get_db_connection()
    df_all = pd.read_sql("SELECT * FROM logs ORDER BY timestamp", conn)
    
    c = conn.cursor()
    c.execute("SELECT device_id FROM service_tickets WHERE status = 'OPEN'")
    devices_in_progress = {row[0] for row in c.fetchall()}
    conn.close()

    df_all['date'] = df_all['timestamp'].str.split(' ').str[0]
    unique_dates = sorted(df_all['date'].unique())
    
    if day >= len(unique_dates):
        return {"error": "Osiągnięto koniec danych symulacyjnych z bazy."}
        
    target_date = unique_dates[day]
    
    df_history = df_all[df_all['timestamp'] <= f"{target_date} 22:00"].copy()
    demo_devices = [f"USG-{i:04d}" for i in range(1, 51)]
    
    df_history = df_history[df_history['device_id'].isin(demo_devices)]
    df_history = df_history.sort_values(by=["device_id", "timestamp"])

    # ==========================================
    # PREDYKCJA LSTM: okno sekwencyjne 24h per urządzenie (wspólny vet_features)
    # ==========================================
    cutoff_ts = pd.to_datetime(f"{target_date} 22:00")
    RAW_COLS = ['timestamp', 'ambient_temp_c', 'temp_c', 'snr_db', 'voltage_v', 'cpu_pct']

    windows = []
    meta = []  # metadane per urządzenie do zbudowania df_today
    for dev, g in df_history.groupby('device_id'):
        try:
            me = int(encoder.transform([g['device_model'].iloc[0]])[0])
        except Exception:
            continue
        frame = vf.build_device_frame(g[RAW_COLS], me, end_ts=cutoff_ts)
        w = vf.make_serving_window(frame)
        if w is None:
            continue
        last = frame.iloc[-1]                       # wiersz na cutoff (może być imputowany)
        real = g.iloc[-1]                            # ostatni REALNY odczyt (do wyświetlenia)
        stale_today = bool(last['is_imputed'] == 1)  # dzisiejsza paczka nie dotarła -> BRAK SYNC
        windows.append(w[0])
        meta.append({
            'device_id': dev,
            'device_model': g['device_model'].iloc[0],
            'connection_type': g['connection_type'].iloc[0],
            'timestamp': pd.to_datetime(real['timestamp']).strftime('%d.%m %H:00'),     # czas ostatniego realnego odczytu
            'temp_c': float(real['temp_c']),
            'snr_db': float(real['snr_db']),
            'cpu_pct': float(real['cpu_pct']),
            'voltage_v': float(real['voltage_v']),
            'ambient_temp_c': float(last['ambient_temp_c']),
            'temp_rolling_24h': float(last['temp_rolling_24h']),
            'snr_rolling_24h': float(last['snr_rolling_24h']),
            'stale_today': stale_today,
        })

    if not windows:
        return {"simulation_day": day, "date": target_date, "synced_devices": 0, "fleet_status": []}

    X = np.asarray(windows, dtype=np.float32)
    X = vf.apply_scaler(X, scaler)

    # Predykcja RUL (deterministyczna, dropout wyłączony) — zaokrąglona do liczb całkowitych
    preds = model.predict(X, verbose=0).ravel()
    preds = np.clip(np.rint(preds), 0.0, vf.R_MAX)

    # PEWNOŚĆ AI (Monte Carlo Dropout): wiele przebiegów z aktywnym dropout -> rozrzut = niepewność.
    # Mały rozrzut = wysoka pewność. Pokrętła poniżej pozwalają dostroić prezentację.
    mc = np.stack([model(X, training=True).numpy().ravel() for _ in range(MC_SAMPLES)], axis=0)
    mc_std = mc.std(axis=0)  # odchylenie std predykcji per urządzenie (godziny)
    conf = 100.0 - (mc_std / CONF_MAXSTD) * (100.0 - CONF_FLOOR)
    conf = np.clip(np.rint(conf), CONF_FLOOR, 99).astype(int)

    df_today = pd.DataFrame(meta)
    df_today['predicted_rul'] = preds.astype(int)
    df_today['confidence'] = conf

    df_today[['status', 'diagnosis', 'recommendation', 'error_code', 'action_category', 'recommended_sku', 'diag_value']] = df_today.apply(
        lambda row: expert_rule_engine(row, row['predicted_rul']), axis=1
    )
    df_today['diag_value'] = df_today['diag_value'].apply(lambda x: int(x) if pd.notna(x) else None)

    # BRAK SYNC: dzisiejsza paczka nie dotarła (weekend / luka). Imputowana jako spoczynek.
    # Nie zamraża RUL i nie kasuje realnego alarmu — pokazujemy tylko gdy urządzenie jest w normie.
    mask_stale_ok = df_today['stale_today'] & (df_today['status'] == 'NORMAL')
    df_today.loc[mask_stale_ok, 'status'] = 'BRAK SYNC'
    df_today.loc[mask_stale_ok, 'diagnosis'] = 'Brak dzisiejszej paczki danych — przyjęto ostatni znany odczyt (tryb spoczynku).'
    df_today.loc[mask_stale_ok, 'recommendation'] = 'Weryfikacja łącza przy kolejnej synchronizacji. Bez akcji serwisowej.'
    df_today.loc[mask_stale_ok, 'error_code'] = 'ERR-NET-STALE'
    df_today.loc[mask_stale_ok, 'action_category'] = 'WERYFIKACJA_ZDALNA'
    df_today.loc[mask_stale_ok, 'recommended_sku'] = None

    df_today['status'] = df_today.apply(
        lambda row: 'IN PROGRESS' if row['device_id'] in devices_in_progress and row['status'] not in ('BRAK SYNC',) else row['status'], axis=1
    )

    results = df_today[[
        'device_id', 'device_model', 'connection_type', 'timestamp', 'temp_c', 'snr_db', 
        'predicted_rul', 'confidence', 'status', 'diagnosis', 'recommendation', 'error_code', 'action_category', 'recommended_sku', 'diag_value'
    ]].to_dict(orient="records")

    for row in results:
        for key, value in row.items():
            if pd.isna(value):
                row[key] = None

    reported_devices = {r['device_id'] for r in results}
    missing_devices = set(demo_devices) - reported_devices

    for md in missing_devices:
        idx = int(md.split('-')[1])
        results.append({
            'device_id': md,
            'device_model': 'Oczekuje na przypisanie',
            'connection_type': 'GSM' if idx <= 25 else 'USB',
            'timestamp': 'Nigdy',
            'temp_c': 0, 'snr_db': 0, 'predicted_rul': 0, 'confidence': None, 'diag_value': None,
            'status': 'OFFLINE',
            'diagnosis': 'Urządzenie nigdy nie połączyło się z systemem.',
            'recommendation': 'Sprawdź zasilanie u klienta.',
            'error_code': 'ERR-NET-NEVER',
            'action_category': 'WERYFIKACJA_ZDALNA',
            'recommended_sku': None
        })

    results = sorted(results, key=lambda x: x['device_id'])

    return {
        "simulation_day": day,
        "date": target_date,
        "synced_devices": len(results),
        "fleet_status": results
    }

@app.get("/api/device/{device_id}/history")
def get_device_history(device_id: str, target_date: str):
    conn = get_db_connection()
    query = f"""
    SELECT timestamp, temp_c, snr_db, cpu_pct, voltage_v 
    FROM logs 
    WHERE device_id = '{device_id}' 
    AND timestamp <= '{target_date} 22:00'
    ORDER BY timestamp DESC LIMIT 168
    """
    df = pd.read_sql(query, conn)
    conn.close()
    
    if not df.empty:
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df.set_index('timestamp', inplace=True)
        
        end_date = pd.to_datetime(target_date + ' 22:00:00')
        start_date = end_date - pd.Timedelta(days=7)
        
        full_range = pd.date_range(start=start_date.ceil('h'), end=end_date.floor('h'), freq='h')
        df = df.reindex(full_range)
        df.index.name = 'timestamp'
        df.reset_index(inplace=True)
        
        df['display_time'] = df['timestamp'].dt.strftime('%d.%m %H:00')
        
        records = df.to_dict(orient="records")
        for row in records:
            for key, value in row.items():
                if pd.isna(value):
                    row[key] = None
        return records
    return []

# ==========================================
# NOWE ENDPOINTY (MODUŁ ACTION CENTER / CMMS)
# ==========================================
@app.get("/api/technicians")
def get_technicians():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM technicians")
    techs = [{"id": row[0], "first_name": row[1], "last_name": row[2], "phone": row[3]} for row in c.fetchall()]
    conn.close()
    return techs

@app.post("/api/tickets")
def create_ticket(ticket: TicketCreate):
    conn = get_db_connection()
    c = conn.cursor()
    
    ticket_id = f"TKT-{str(uuid.uuid4())[:4].upper()}"
    creation_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    c.execute('''INSERT INTO service_tickets 
                 (ticket_id, device_id, creation_date, status, action_category, sku, technician_id, notes, resolved_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
              (ticket_id, ticket.device_id, creation_date, 'OPEN', 
               ticket.action_category, ticket.sku, ticket.technician_id, ticket.notes, None))
    
    conn.commit()
    conn.close()
    return {"message": "Ticket created successfully", "ticket_id": ticket_id}

@app.get("/api/device/{device_id}/tickets")
def get_device_tickets(device_id: str):
    conn = get_db_connection()
    c = conn.cursor()
    query = """
    SELECT s.ticket_id, s.creation_date, s.status, s.action_category, s.sku, s.notes, s.resolved_date,
           t.first_name, t.last_name
    FROM service_tickets s
    LEFT JOIN technicians t ON s.technician_id = t.id
    WHERE s.device_id = ?
    ORDER BY s.creation_date DESC
    """
    c.execute(query, (device_id,))
    
    tickets = []
    for row in c.fetchall():
        tickets.append({
            "ticket_id": row[0],
            "creation_date": row[1],
            "status": row[2],
            "action_category": row[3],
            "sku": row[4],
            "notes": row[5],
            "resolved_date": row[6],
            "technician": f"{row[7]} {row[8]}" if row[7] else None
        })
    conn.close()
    return tickets

@app.post("/api/tickets/{ticket_id}/resolve")
def resolve_ticket(ticket_id: str, target_date: str):
    conn = get_db_connection()
    c = conn.cursor()
    resolved_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # 1. Zamknięcie zgłoszenia
    c.execute("UPDATE service_tickets SET status = 'CLOSED', resolved_date = ? WHERE ticket_id = ?", 
              (resolved_date, ticket_id))
    
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Ticket not found")

    # 2. Identyfikacja naprawionej maszyny
    c.execute("SELECT device_id FROM service_tickets WHERE ticket_id = ?", (ticket_id,))
    device_id = c.fetchone()[0]

    c.execute("SELECT device_model, connection_type FROM logs WHERE device_id = ? LIMIT 1", (device_id,))
    model_row = c.fetchone()
    dev_model = model_row[0] if model_row else "vet pro 70"
    conn_type = model_row[1] if model_row else "GSM"

    # 3. SYMULACJA FIZYCZNEJ NAPRAWY: Generowanie idealnych logów od dnia naprawy w przód
    # To wymusi na modelu ML przeliczenie RUL z powrotem do wartości "jak prosto z fabryki" (~600h)
    start_dt = pd.to_datetime(target_date) + pd.Timedelta(days=1)
    
    # Kasujemy zepsutą przyszłość z bazy
    c.execute("DELETE FROM logs WHERE device_id = ? AND timestamp >= ?", 
              (device_id, start_dt.strftime("%Y-%m-%d 00:00")))
    
    # Wstrzykujemy 30 dni zdrowego, PRACUJĄCEGO urządzenia (nie martwego idle):
    # CPU wysokie w godzinach pracy (przyjęcia), niskie poza — jak sprawny aparat w klinice.
    new_logs = []
    for day_offset in range(30):
        for hour in range(24):
            current_time = start_dt + pd.Timedelta(days=day_offset, hours=hour)
            weekday = current_time.weekday()
            working = (8 <= hour <= 18) and (weekday < 5)  # dni robocze, godziny przyjęć
            if working:
                cpu_val = round(np.random.uniform(35.0, 70.0), 1)      # aktywna praca
                temp_val = round(24.5 + np.random.uniform(-0.5, 1.0), 2)
            else:
                cpu_val = round(np.random.uniform(3.0, 9.0), 1)        # spoczynek nocny/weekend
                temp_val = round(22.5 + np.random.uniform(-0.3, 0.5), 2)
            new_logs.append((
                current_time.strftime("%Y-%m-%d %H:00"),
                device_id, dev_model, conn_type,
                22.0,                                            # ambient_temp_c
                temp_val,                                        # temp_c (zdrowa)
                round(46.0 + np.random.uniform(-0.5, 0.5), 2),   # snr_db (zdrowy)
                round(220.0 + np.random.uniform(-1.0, 1.0), 2),  # voltage_v (stabilne)
                cpu_val                                          # cpu_pct (z cyklami pracy)
            ))

    c.executemany("""
        INSERT INTO logs 
        (timestamp, device_id, device_model, connection_type, ambient_temp_c, temp_c, snr_db, voltage_v, cpu_pct) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, new_logs)
        
    conn.commit()
    conn.close()
    return {"message": f"Ticket {ticket_id} closed, telemetry for {device_id} restored to factory state."}