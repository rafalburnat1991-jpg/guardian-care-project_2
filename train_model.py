"""
train_model.py — trening sieci LSTM Guardian Care VET-EYE.

Uruchamiać w Colab. Wymaga w tym samym folderze: dataset_training.csv, vet_features.py.
Zapisuje: vet_eye_rul_model.keras, scaler.pkl, label_encoder.pkl
(te trzy pliki wgrywasz do backendu obok main.py + vet_features.py).
"""
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error
import joblib

import vet_features as vf

# TensorFlow/Keras importowany dopiero tu (w Colab dostępny)
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Input, LSTM, Dense, Dropout, Masking
from tensorflow.keras.callbacks import EarlyStopping

# ==========================================
# KONFIGURACJA
# ==========================================
TRAIN_CSV = "dataset_training.csv"
STRIDE = 3               # co ile godzin probkujemy okna (redukcja pamieci)
HEALTHY_KEEP = 0.20      # ulamek okien "zdrowych" (RUL==R_MAX) do zachowania (reszta redundantna)
EPOCHS = 30
BATCH = 256
SEED = 42
np.random.seed(SEED); tf.random.set_seed(SEED)

print("Guardian Care VET-EYE - trening LSTM...")

# 1. Dane + kodowanie modelu urzadzenia
df = pd.read_csv(TRAIN_CSV).sort_values(["device_id", "timestamp"]).reset_index(drop=True)
le = LabelEncoder(); df['device_model_encoded'] = le.fit_transform(df['device_model'])
print(f"Wczytano {len(df)} rekordow, {df.device_id.nunique()} urzadzen.")

# 2. Podzial PO URZADZENIACH
ids = df['device_id'].unique()
gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED)
tr_pos, te_pos = next(gss.split(ids, groups=ids))
train_ids, test_ids = set(ids[tr_pos]), set(ids[te_pos])
print(f"Urzadzenia treningowe: {len(train_ids)} | testowe: {len(test_ids)}")

# 3. Budowa okien sekwencyjnych (przez wspolny vet_features)
COLS = ['timestamp', 'ambient_temp_c', 'temp_c', 'snr_db', 'voltage_v', 'cpu_pct', 'RUL_hours']

def build_split(device_ids, stride, healthy_keep):
    Xs, ys, meta = [], [], []
    for dev, g in df[df.device_id.isin(device_ids)].groupby('device_id'):
        me = int(g['device_model_encoded'].iloc[0])
        frame = vf.build_device_frame(g[COLS], me)
        X, y = vf.make_training_sequences(frame, stride=stride)
        for xi, yi in zip(X, y):
            if yi >= vf.R_MAX and np.random.random() > healthy_keep:
                continue
            Xs.append(xi); ys.append(yi); meta.append(dev)
    return np.asarray(Xs, dtype=np.float32), np.asarray(ys, dtype=np.float32), np.asarray(meta)

print("Budowa sekwencji treningowych...")
X_train, y_train, _ = build_split(train_ids, STRIDE, HEALTHY_KEEP)
print("Budowa sekwencji testowych...")
X_test, y_test, meta_test = build_split(test_ids, STRIDE, HEALTHY_KEEP)
print(f"Okna: train={X_train.shape}, test={X_test.shape}")
assert X_train.shape[1:] == (vf.WINDOW, len(vf.CHANNELS)), "Zly ksztalt okna - sprawdz vet_features.CHANNELS"

# 4. Skalowanie (dopasowane na train, zapisane, stosowane spojnie w serwisie)
scaler = vf.fit_scaler(X_train)
X_train = vf.apply_scaler(X_train, scaler)
X_test = vf.apply_scaler(X_test, scaler)

# 5. Model LSTM
n_feat = len(vf.CHANNELS)
inp = Input(shape=(vf.WINDOW, n_feat))
x = Masking(mask_value=0.0)(inp)
x = LSTM(64, return_sequences=False)(x)
x = Dropout(0.2)(x)
x = Dense(32, activation='relu')(x)
out = Dense(1)(x)
model = Model(inp, out)
model.compile(optimizer='adam', loss='mae', metrics=['mae'])
model.summary()

es = EarlyStopping(monitor='val_loss', patience=4, restore_best_weights=True)
model.fit(X_train, y_train, validation_split=0.15, epochs=EPOCHS, batch_size=BATCH,
          callbacks=[es], verbose=2)

# 6. Ewaluacja
pred = model.predict(X_test, batch_size=BATCH, verbose=0).ravel()
pred = np.clip(pred, 0, vf.R_MAX)
mae_all = mean_absolute_error(y_test, pred)
rmse_all = np.sqrt(mean_squared_error(y_test, pred))
deg = y_test < vf.R_MAX
mae_deg = mean_absolute_error(y_test[deg], pred[deg]) if deg.sum() else float('nan')

print("-" * 55)
print("RAPORT LSTM (test na nieznanych urzadzeniach):")
print(f"  MAE  ogolem:            {mae_all:6.2f} h")
print(f"  RMSE ogolem:            {rmse_all:6.2f} h")
print(f"  MAE  (tylko degradacja): {mae_deg:6.2f} h   <-- kluczowa metryka")
print(f"  Okien testowych: {len(y_test)} (degradujacych: {int(deg.sum())})")
print("-" * 55)

# Trafnosc pasm (progi z vet_features)
tb = np.array([vf.band_from_rul(v) for v in y_test])
pb = np.array([vf.band_from_rul(v) for v in pred])
print(f"Trafnosc klasyfikacji do pasm: {(tb==pb).mean()*100:.1f}%")
bands = ['CRITICAL', 'PRE-FAILURE', 'NORMAL']
conf = pd.DataFrame(0, index=[f'true_{b}' for b in bands], columns=[f'pred_{b}' for b in bands])
for a, b in zip(tb, pb):
    conf.loc[f'true_{a}', f'pred_{b}'] += 1
print(conf.to_string())

# MAE per profil
if 'profile' in df.columns:
    pm = df[['device_id', 'profile', 'killer_mode']].drop_duplicates()
    ev = pd.DataFrame({'device_id': meta_test, 'y': y_test, 'pred': pred})
    ev = ev.merge(pm, on='device_id', how='left')
    ev['grp'] = ev.apply(lambda r: r['profile'] if r['profile'] != 'KILLER' else f"KILLER-{r['killer_mode']}", axis=1)
    evd = ev[ev['y'] < vf.R_MAX]
    per = (evd.assign(ae=(evd['y'] - evd['pred']).abs()).groupby('grp')
           .agg(MAE_h=('ae', 'mean'), n=('ae', 'size')).sort_values('MAE_h', ascending=False))
    print("\nMAE per profil awarii (degradujace):")
    print(per.round(1).to_string())

# 7. Eksport
model.save('vet_eye_rul_model.keras')
joblib.dump(scaler, 'scaler.pkl')
joblib.dump(le, 'label_encoder.pkl')
print("\nZapisano: vet_eye_rul_model.keras, scaler.pkl, label_encoder.pkl")
