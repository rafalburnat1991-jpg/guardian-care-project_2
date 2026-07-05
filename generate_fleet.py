import pandas as pd
import numpy as np
import sqlite3
import random
import math
from datetime import datetime, timedelta

# ==========================================
# KONFIGURACJA PACZKI  <-- JEDYNE, CO PRZEŁĄCZASZ MIĘDZY URUCHOMIENIAMI
# ==========================================
# "DEMO"     -> 50 urządzeń / 60 dni  -> telemetry.db (żywa baza pod aplikację) + dataset_demo.csv
# "TRAINING" -> 400 urządzeń / 180 dni -> dataset_training.csv (wsad do Colab do treningu modelu)
PACKAGE = "DEMO"

CONFIG = {
    "DEMO": {
        "NUM_DEVICES": 50,
        "DAYS_TO_SIMULATE": 60,
        "SEED": 42,
        # Świat czytelny dla komisji: zrównoważony, ale z widocznymi awariami każdego typu
        "PROFILE_DISTR": {
            "GOLDEN": 18, "WORKHORSE": 6, "KILLER": 7, "SLOW_WEAR": 5,
            "PROBE_THERMAL": 3, "HUMAN_ERROR": 4, "GHOST": 4, "SUDDEN_DEATH": 3
        }
    },
    "TRAINING": {
        "NUM_DEVICES": 400,
        "DAYS_TO_SIMULATE": 180,
        "SEED": 2025,
        # Świat treningowy: celowo przesycony degradacją, SLOW_WEAR i PROBE_THERMAL mocno reprezentowane
        "PROFILE_DISTR": {
            "GOLDEN": 90, "WORKHORSE": 40, "KILLER": 70, "SLOW_WEAR": 90,
            "PROBE_THERMAL": 40, "HUMAN_ERROR": 30, "GHOST": 24, "SUDDEN_DEATH": 16
        }
    }
}

NUM_DEVICES = CONFIG[PACKAGE]["NUM_DEVICES"]
DAYS_TO_SIMULATE = CONFIG[PACKAGE]["DAYS_TO_SIMULATE"]
PROFILE_DISTR = CONFIG[PACKAGE]["PROFILE_DISTR"]
SEED = CONFIG[PACKAGE]["SEED"]
TOTAL_H = DAYS_TO_SIMULATE * 24

START_DATE = datetime(2026, 4, 1, 0, 0)
MODELS = ["vet pro 70", "vet portable 15", "vet pro-key 75"]

random.seed(SEED)
np.random.seed(SEED)

# ==========================================
# GENERATOR FLOTY
# ==========================================
def generate_fleet():
    devices = []
    profile_list = []
    for p, count in PROFILE_DISTR.items():
        profile_list.extend([p] * count)
    random.shuffle(profile_list)

    # GWARANTOWANY, RÓWNY ROZKŁAD TRYBÓW KILLER (naprawia brak POWER w starym losowaniu)
    killer_indices = [i for i, p in enumerate(profile_list) if p == "KILLER"]
    modes_cycle = ["SNR", "THERMAL", "POWER"]
    killer_mode_map = {idx: modes_cycle[k % 3] for k, idx in enumerate(killer_indices)}

    for i in range(1, NUM_DEVICES + 1):
        dev_id = f"USG-{i:04d}"
        profile = profile_list[i - 1]
        model = random.choice(MODELS)

        # Workhorse to sprzęt stacjonarno-wózkowy
        if profile == "WORKHORSE":
            model = "vet pro 70"

        # Podział architektury: pierwsza połowa GSM, druga USB (skaluje się z NUM_DEVICES)
        device_number = int(dev_id.split('-')[1])
        comm_type = "GSM" if device_number <= NUM_DEVICES // 2 else "USB"

        killer_mode = killer_mode_map.get(i - 1) if profile == "KILLER" else None

        devices.append({
            "device_id": dev_id,
            "device_model": model,
            "profile": profile,
            "comm_type": comm_type,
            "killer_mode": killer_mode,

            # --- CYFROWE DNA MASZYNY ---
            "temp_bias": random.uniform(-1.0, 1.0),
            "volt_bias": random.uniform(-1.5, 1.5),
            "typical_start": random.randint(7, 10),
            "cooling_efficiency": random.uniform(0.85, 1.15),

            # --- KRZYWA DEGRADACJI: nieliniowość utrudnia ekstrapolację modelowi ---
            "degradation_curve": random.choice(["LINEAR", "EXPONENTIAL"]),

            # --- PARAMETRY SLOW_WEAR (wieloczynnikowy, subtelny dryf; używane tylko dla tego profilu) ---
            "wear_temp_amp": random.uniform(5.0, 9.0),
            "wear_snr_amp": random.uniform(3.0, 5.0),
            "wear_volt_amp": random.uniform(3.0, 5.0),
            "wear_volt_dir": random.choice([-1, 1]),

            # --- PARAMETRY PROBE_THERMAL (przegrzewanie głowicy: temp rośnie + SNR spada PONAD sprzężenie) ---
            "probe_temp_amp": random.uniform(8.0, 14.0),   # umiarkowany wzrost temperatury głowicy
            "probe_snr_amp": random.uniform(4.0, 9.0),     # dodatkowy, WEWNĘTRZNY spadek SNR (nie z ciepła)

            # Zmienne parametry uszkodzeń
            "human_error_type": random.choice([1, 2, 3]) if profile == "HUMAN_ERROR" else 0,
            "degradation_window": random.randint(int(0.10 * TOTAL_H), int(0.35 * TOTAL_H)),
            "death_mode": random.choice(["THERMAL", "VOLTAGE", "CPU"])
        })
    return devices

# ==========================================
# SILNIK FIZYKI I SYMULACJI
# ==========================================
def simulate_telemetry(devices):
    print(f"Inicjalizacja Guardian Care VET-EYE Data Engine [{PACKAGE}: {NUM_DEVICES} urz. / {DAYS_TO_SIMULATE} dni]...")
    all_logs = []

    for dev in devices:
        dev_id = dev["device_id"]
        model = dev["device_model"]
        profile = dev["profile"]
        comm_type = dev["comm_type"]
        killer_mode = dev["killer_mode"]
        curve = dev["degradation_curve"]

        current_temp = 22.0
        current_snr = 46.0

        # --- HORYZONTY AWARII (skalowane do długości symulacji) ---
        eol_hour = None
        if profile == "KILLER":
            eol_hour = random.randint(int(0.25 * TOTAL_H), int(0.92 * TOTAL_H))
        elif profile == "SUDDEN_DEATH":
            eol_hour = random.randint(int(0.15 * TOTAL_H), int(0.85 * TOTAL_H))
        elif profile == "SLOW_WEAR":
            # Długa, łagodna degradacja; szerokie okno = subtelny sygnał przez większość życia
            eol_hour = random.randint(int(0.55 * TOTAL_H), int(0.95 * TOTAL_H))
        elif profile == "PROBE_THERMAL":
            # Przegrzewanie głowicy: podobny horyzont co KILLER
            eol_hour = random.randint(int(0.30 * TOTAL_H), int(0.90 * TOTAL_H))

        # SLOW_WEAR ma własne, szerokie okno degradacji (nadpisuje losowe DNA)
        slow_window = random.randint(int(0.40 * TOTAL_H), int(0.70 * TOTAL_H)) if profile == "SLOW_WEAR" else None

        base_k = 0.3 if model == "vet portable 15" else (0.6 if model == "vet pro 70" else 0.8)

        buffer_24h = []
        is_dead = False

        for hour_idx in range(DAYS_TO_SIMULATE * 24):
            if is_dead:
                break

            current_time = START_DATE + timedelta(hours=hour_idx)
            hour_of_day = current_time.hour
            weekday = current_time.weekday()

            ambient_temp = 22.0
            today_start = dev["typical_start"] + random.choice([-1, 0, 1])
            is_working = today_start <= hour_of_day <= (today_start + 10)

            if profile == "WORKHORSE":
                is_working = True
                if random.random() < 0.15: is_working = False
                if weekday in [5, 6] and random.random() < 0.5: is_working = False

            if weekday in [5, 6] and profile != "WORKHORSE":
                is_working = False

            # --- BŁĄD LUDZKI ---
            actual_k = base_k * dev["cooling_efficiency"]
            if profile == "HUMAN_ERROR":
                if dev["human_error_type"] == 1 and not is_working and 11 <= hour_of_day <= 14 and random.random() < 0.15:
                    ambient_temp = 42.0
                elif dev["human_error_type"] == 2 and 12 <= hour_of_day <= 14:
                    ambient_temp = 32.0
                elif dev["human_error_type"] == 3 and is_working and random.random() < 0.2:
                    actual_k = 0.05

            # --- FIZYKA BAZOWA I PIKI ---
            cpu = random.uniform(2, 10) if not is_working else random.uniform(35, 72)
            voltage = 221.0 + dev["volt_bias"] + random.uniform(-1.0, 1.0)

            if model == "vet pro-key 75" and hour_of_day == today_start and weekday not in [5, 6]:
                cpu = random.uniform(88, 95)
                voltage -= random.uniform(2.5, 4.0)

            target_temp = ambient_temp + (cpu * 0.25)
            current_temp = ambient_temp + (current_temp - ambient_temp) * math.exp(-actual_k)
            if is_working:
                current_temp += (target_temp - current_temp) * 0.3 + dev["temp_bias"]

            current_snr = 45.0 - (current_temp - 22.0) * 0.15 + random.uniform(-0.4, 0.4)

            # --- GHOST ---
            if profile == "GHOST" and is_working and random.random() < 0.015:
                voltage += random.choice([-8.0, 8.0])
                cpu = 100.0

            # --- RUL I DEGRADACJA ---
            rul = 600
            status = "NORMAL"

            if profile == "KILLER" and eol_hour is not None:
                rul = max(0, eol_hour - hour_idx)
                if rul < dev["degradation_window"]:
                    progress = (dev["degradation_window"] - rul) / float(dev["degradation_window"])
                    if curve == "EXPONENTIAL":
                        progress = progress ** 2.2  # "kolano": długo płasko, potem gwałtownie

                    # ROZSZCZEPIENIE BŁĘDÓW: selektywne, jednokanałowe załamanie
                    if killer_mode == "SNR":
                        current_snr -= progress * random.uniform(6.0, 12.0)
                        cpu += progress * 5.0
                    elif killer_mode == "THERMAL":
                        current_temp += progress * random.uniform(15.0, 20.0)
                        cpu += progress * 10.0
                    elif killer_mode == "POWER":
                        if hour_idx % 2 == 0:
                            voltage += progress * random.uniform(6.0, 15.0)
                        else:
                            voltage -= progress * random.uniform(6.0, 15.0)
                        cpu += progress * 5.0

            # --- NOWY PROFIL: SLOW_WEAR (wieloczynnikowy, subtelny, bez dominującego kanału) ---
            if profile == "SLOW_WEAR" and eol_hour is not None:
                rul = max(0, eol_hour - hour_idx)
                if rul < slow_window:
                    progress = (slow_window - rul) / float(slow_window)
                    if curve == "EXPONENTIAL":
                        progress = progress ** 2.2
                    # Wszystkie kanały dryfują JEDNOCZEŚNIE i ŁAGODNIE — żaden sam nie przekracza progu wcześnie
                    current_temp += progress * dev["wear_temp_amp"]
                    current_snr -= progress * dev["wear_snr_amp"]
                    voltage += progress * dev["wear_volt_amp"] * dev["wear_volt_dir"]
                    cpu += progress * random.uniform(3.0, 6.0)

            # --- NOWY PROFIL: PROBE_THERMAL (przegrzewanie samej głowicy) ---
            if profile == "PROBE_THERMAL" and eol_hour is not None:
                rul = max(0, eol_hour - hour_idx)
                if rul < dev["degradation_window"]:
                    progress = (dev["degradation_window"] - rul) / float(dev["degradation_window"])
                    if curve == "EXPONENTIAL":
                        progress = progress ** 2.2
                    # Temperatura rośnie umiarkowanie...
                    current_temp += progress * dev["probe_temp_amp"]
                    # ...a SNR spada MOCNIEJ niż tłumaczy ciepło (sygnatura wewnętrzna głowicy).
                    # Napięcie NIETKNIĘTE -> odróżnia od zużycia systemowego (SLOW_WEAR).
                    current_snr -= progress * dev["probe_snr_amp"]
                    cpu += progress * 4.0

            if profile == "SUDDEN_DEATH" and eol_hour is not None:
                rul = max(0, eol_hour - hour_idx)
                if rul <= 3:
                    cpu = 100.0  # gwarancja detekcji ERR-SYS-99 na backendzie
                    if dev["death_mode"] == "THERMAL":
                        current_temp += random.uniform(20.0, 30.0)
                    elif dev["death_mode"] == "VOLTAGE":
                        voltage = random.uniform(0.0, 15.0)
                    elif dev["death_mode"] == "CPU":
                        current_temp += random.uniform(8.0, 12.0)
                if rul <= 0:
                    is_dead = True

            if rul <= 0 and profile != "GOLDEN":
                status = "CRITICAL"
            elif rul < 96:
                status = "CRITICAL"
            elif rul < 168:
                status = "PRE-FAILURE"

            # Końcowy log z szumem czujnika
            temp_final = round(current_temp + random.uniform(-0.15, 0.15), 2)
            snr_final = round(current_snr + random.uniform(-0.25, 0.25), 2)
            volt_final = round(voltage + random.uniform(-0.3, 0.3), 2)
            cpu_final = round(min(100.0, max(0.0, cpu + random.uniform(-1.5, 1.5))), 1)

            log_entry = {
                "timestamp": current_time.strftime("%Y-%m-%d %H:00"),
                "device_id": dev_id,
                "device_model": model,
                "connection_type": comm_type,
                "ambient_temp_c": ambient_temp,
                "temp_c": temp_final,
                "snr_db": snr_final,
                "voltage_v": volt_final,
                "cpu_pct": cpu_final,
                "RUL_hours": rul,
                "status": status
            }

            buffer_24h.append(log_entry)

            # --- PACZKA 22:00 (zgodnie z pracą: batch processing o 22:00; fizyka OFFLINE) ---
            if hour_of_day == 22:
                sync_success = True
                if comm_type == "USB":
                    if random.random() < 0.20:
                        sync_success = False
                else:  # GSM
                    if random.random() < 0.02:
                        sync_success = False

                if sync_success:
                    all_logs.extend(buffer_24h)

                buffer_24h = []

        if buffer_24h and not is_dead:
            all_logs.extend(buffer_24h)

    return pd.DataFrame(all_logs)

if __name__ == "__main__":
    devices = generate_fleet()
    df_telemetry = simulate_telemetry(devices)

    print(f"Wygenerowano: {len(df_telemetry)} rekordów.")

    # Raport kontrolny rozkładu (dowód do pracy: co realnie uczy model)
    prof_counts = pd.Series([d["profile"] for d in devices]).value_counts()
    print("Rozkład profili floty:")
    print(prof_counts.to_string())
    km = pd.Series([d["killer_mode"] for d in devices if d["killer_mode"]]).value_counts()
    print("Rozkład trybów KILLER (teraz gwarantowany):")
    print(km.to_string())

    df_telemetry = df_telemetry.sort_values(by=["device_id", "timestamp"])
    # Dołączamy profile/killer_mode do CSV -> rozbicie per profil działa z samego CSV (kolumny NIE są cechami modelu)
    dev_meta = pd.DataFrame(devices)[["device_id", "profile", "killer_mode"]]
    df_ml = df_telemetry.drop(columns=['status']).merge(dev_meta, on="device_id", how="left")

    if PACKAGE == "DEMO":
        csv_name = "dataset_demo.csv"
        db_name = "telemetry.db"   # żywa baza pod aplikację
    else:
        csv_name = "dataset_training.csv"
        db_name = "telemetry_training.db"  # opcjonalnie, do wglądu

    df_ml.to_csv(csv_name, index=False)
    print(f"Zapisano: {csv_name}")

    conn = sqlite3.connect(db_name)
    df_telemetry.to_sql("logs", conn, index=False, if_exists="replace")
    pd.DataFrame(devices).to_sql("devices", conn, index=False, if_exists="replace")
    conn.close()
    print(f"Zapisano: {db_name}")
    print("Guardian Care VET-EYE Data Engine -> ZAKOŃCZONO.")
