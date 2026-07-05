"""
Rozbicie MAE per profil awarii — BEZ ponownego treningu.
Ładuje zapisany model (vet_eye_rul_model.pkl) i odtwarza DOKŁADNIE ten sam podział
po urządzeniach co train_model.py (ten sam random_state), więc wynik jest spójny z raportem.

Wymaga w tym samym folderze: dataset_training.csv, vet_eye_rul_model.pkl, label_encoder.pkl
oraz (jeśli CSV nie ma kolumny 'profile') telemetry_training.db.
"""
import os
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import mean_absolute_error
import joblib

TRAIN_CSV = "dataset_training.csv"
R_MAX = 600

df = pd.read_csv(TRAIN_CSV).sort_values(["device_id", "timestamp"]).reset_index(drop=True)
df['temp_rolling_24h'] = df.groupby('device_id')['temp_c'].transform(lambda x: x.rolling(24, min_periods=1).mean())
df['snr_rolling_24h']  = df.groupby('device_id')['snr_db'].transform(lambda x: x.rolling(24, min_periods=1).mean())

le = joblib.load('label_encoder.pkl')
df['device_model_encoded'] = le.transform(df['device_model'])
model = joblib.load('vet_eye_rul_model.pkl')

features = ['ambient_temp_c', 'temp_c', 'snr_db', 'voltage_v', 'cpu_pct',
            'temp_rolling_24h', 'snr_rolling_24h', 'device_model_encoded']
X = df[features]
y = np.minimum(df['RUL_hours'], R_MAX)
groups = df['device_id']

# Ten sam podział co w treningu (identyczny random_state => te same urządzenia testowe)
gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
_, test_idx = next(gss.split(X, y, groups))
pred = model.predict(X.iloc[test_idx])
y_test = y.iloc[test_idx]

# Mapowanie profilu: najpierw z CSV, potem z bazy
prof = None
if 'profile' in df.columns:
    prof = df[['device_id', 'profile']].drop_duplicates()
    prof['killer_mode'] = df['killer_mode'] if 'killer_mode' in df.columns else None
elif os.path.exists("telemetry_training.db") and os.path.getsize("telemetry_training.db") > 0:
    import sqlite3
    conn = sqlite3.connect("telemetry_training.db")
    prof = pd.read_sql("SELECT device_id, profile, killer_mode FROM devices", conn)
    conn.close()
else:
    raise FileNotFoundError("Brak profilu: użyj CSV z kolumną 'profile' albo wgraj telemetry_training.db")

ev = df.iloc[test_idx][['device_id']].copy()
ev['y'] = y_test.values
ev['pred'] = pred
ev = ev.merge(prof, on='device_id', how='left')
ev['grp'] = ev.apply(lambda r: r['profile'] if r['profile'] != 'KILLER' else f"KILLER-{r['killer_mode']}", axis=1)

ev_deg = ev[ev['y'] < R_MAX]
per = (ev_deg.assign(ae=(ev_deg['y'] - ev_deg['pred']).abs())
       .groupby('grp')
       .agg(MAE_h=('ae', 'mean'), n=('ae', 'size'))
       .sort_values('MAE_h', ascending=False))

print("MAE per profil awarii (tylko wiersze degradujące, test na nieznanych urządzeniach):")
print(per.round(1).to_string())
