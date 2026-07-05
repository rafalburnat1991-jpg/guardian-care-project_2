import pandas as pd
import numpy as np
import sqlite3
import random
import math
from datetime import datetime, timedelta

# ==========================================
# KONFIGURACJA POCZĄTKOWA
# ==========================================
NUM_DEVICES = 100
DAYS_TO_SIMULATE = 60
START_DATE = datetime(2026, 4, 1, 0, 0)

MODELS = ["vet pro 70", "vet portable 15", "vet pro-key 75"]
PROFILES = ["GOLDEN", "WORKHORSE", "KILLER", "HUMAN_ERROR", "GHOST", "SUDDEN_DEATH"]

PROFILE_DISTR = {
    "GOLDEN": 50, "WORKHORSE": 15, "KILLER": 12, 
    "HUMAN_ERROR": 8, "GHOST": 10, "SUDDEN_DEATH": 5
}

def generate_fleet():
    devices = []
    profile_list = []
    for p, count in PROFILE_DISTR.items():
        profile_list.extend([p] * count)
    random.shuffle(profile_list)

    for i in range(1, NUM_DEVICES + 1):
        dev_id = f"USG-{i:04d}"
        model = random.choice(MODELS)
        
        # Logika sprzętowa: Workhorse to sprzęt stacjonarno-wózkowy
        if profile_list[i-1] == "WORKHORSE":
            model = "vet pro 70"
            
        comm_type = "eSIM" if model in ["vet pro-key 75", "vet portable 15"] else "USB"
        if model == "vet pro 70" and random.random() > 0.5:
            comm_type = "eSIM"

        devices.append({
            "device_id": dev_id,
            "device_model": model,
            "profile": profile_list[i-1],
            "comm_type": comm_type,
            
            # --- CYFROWE DNA MASZYNY ---
            "temp_bias": random.uniform(-1.0, 1.0),
            "volt_bias": random.uniform(-1.5, 1.5),
            "typical_start": random.randint(7, 10),
            "cooling_efficiency": random.uniform(0.85, 1.15),
            
            # Zmienne parametry uszkodzeń dla profili awaryjnych
            "human_error_type": random.choice([1, 2, 3]) if profile_list[i-1] == "HUMAN_ERROR" else 0,
            "degradation_window": random.randint(150, 400),
            "death_mode": random.choice(["THERMAL", "VOLTAGE", "CPU"])
        })
    return devices

# ==========================================
# SILNIK FIZYKI I SYMULACJI
# ==========================================
def simulate_telemetry(devices):
    print("Inicjalizacja Guardian Care VET-EYE Data Engine (Architektura Bez Kompromisów)...")
    all_logs = []
    
    for dev in devices:
        dev_id = dev["device_id"]
        model = dev["device_model"]
        profile = dev["profile"]
        comm_type = dev["comm_type"]
        
        current_temp = 22.0
        current_snr = 46.0
        
        # Losowanie czasu końca życia (EOL)
        eol_hour = None
        if profile == "KILLER":
            eol_hour = random.randint(30 * 24, 55 * 24)
        elif profile == "SUDDEN_DEATH":
            eol_hour = random.randint(20 * 24, 50 * 24)
            
        base_k = 0.3 if model == "vet portable 15" else (0.6 if model == "vet pro 70" else 0.8)

        # Bufor na logi przed wieczorną wysyłką do chmury
        buffer_24h = []
        is_dead = False

        for hour_idx in range(DAYS_TO_SIMULATE * 24):
            # Jeśli maszyna umarła wczoraj, dziś niczego fizycznie nie rejestruje
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

            # Fizyka Newtona dla stygnięcia maszyny
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
                    degradation = (dev["degradation_window"] - rul) / float(dev["degradation_window"])
                    current_temp += degradation * random.uniform(2.0, 5.0)
                    current_snr -= degradation * random.uniform(3.0, 8.0)
                    cpu += degradation * 15.0
                    
            if profile == "SUDDEN_DEATH" and eol_hour is not None:
                rul = max(0, eol_hour - hour_idx)
                if rul <= 3:
                    if dev["death_mode"] == "THERMAL":
                        current_temp += random.uniform(15.0, 25.0)
                    elif dev["death_mode"] == "VOLTAGE":
                        voltage = random.uniform(0.0, 15.0)
                    elif dev["death_mode"] == "CPU":
                        cpu = 100.0
                        current_temp += random.uniform(8.0, 12.0)
                if rul <= 0:
                    is_dead = True # Śmierć maszyny 

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

            # POPRAWKA FORMATOWANIA STRF_TIME (%H:00 zamiast %H:%00)
            log_entry = {
                "timestamp": current_time.strftime("%Y-%m-%d %H:00"),
                "device_id": dev_id,
                "device_model": model,
                "ambient_temp_c": ambient_temp,
                "temp_c": temp_final,
                "snr_db": snr_final,
                "voltage_v": volt_final,
                "cpu_pct": cpu_final,
                "RUL_hours": rul,
                "status": status
            }
            
            buffer_24h.append(log_entry)
            
            # --- PACZKA 21:00 (Wysyłka i generowanie "dziur") ---
            if hour_of_day == 21:
                sync_success = True
                if comm_type == "USB":
                    if random.random() < 0.15: # 15% szans każdego dnia na zapomnienie podpięcia
                        sync_success = False
                else: # eSIM
                    if random.random() < 0.03: # 3% szans na zgubienie pakietu w drodze
                        sync_success = False
                        
                if sync_success:
                    all_logs.extend(buffer_24h)
                
                # Bufor czyści się zawsze po 21:00. Jeśli sync_success było False, dane przepadają.
                buffer_24h = []
                
        # Zabezpieczenie resztek z bufora po upływie dni testowych
        if buffer_24h and not is_dead:
            all_logs.extend(buffer_24h)
            
    return pd.DataFrame(all_logs)

if __name__ == "__main__":
    devices = generate_fleet()
    df_telemetry = simulate_telemetry(devices)
    
    print(f"Wygenerowano: {len(df_telemetry)} rekordów (symulacja pakietowania zepsuta celowo).")
    
    # Sortowanie danych
    df_telemetry = df_telemetry.sort_values(by=["device_id", "timestamp"])
    
    # Eksport dla Colab 
    df_ml = df_telemetry.drop(columns=['status'])
    df_ml.to_csv("dataset.csv", index=False)
    print("Zapisano: dataset.csv (Gotowe do nauki modelu)")
    
    # Eksport dla bazy Dashboardu
    conn = sqlite3.connect("telemetry.db")
    df_telemetry.to_sql("logs", conn, index=False, if_exists="replace")
    pd.DataFrame(devices).to_sql("devices", conn, index=False, if_exists="replace")
    conn.close()
    
    print("Zapisano: telemetry.db")
    print("Guardian Care VET-EYE Data Engine -> ZAKOŃCZONO.")