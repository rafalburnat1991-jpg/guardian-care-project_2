import json
import random
import re

print("Aktualizacja rejestru placówek: Generowanie fizycznych adresów pocztowych...")

clinic_names = [
    "Psia Przystań", "Gabinet Pod Psiakiem", "Koci Zaułek", "Vet-Medica",
    "Cztery Łapy", "Zdrowy Pupil", "Klinika Małych Zwierząt", "Vet-Care",
    "Zwierzęcy Zakątek", "Ogonek", "Przyjaciel Vet", "Centrum Weterynaryjne",
    "Arka Noego", "Radosny Pysk", "Lecznica pod Psem", "Salus Vet"
]

cities = ["Rzeszów", "Kraków", "Warszawa", "Wrocław", "Poznań", "Gdańsk", "Lublin", "Tarnów"]

streets = [
    "ul. Polna", "ul. Słoneczna", "ul. Mickiewicza", "ul. Leśna", "ul. Lipowa", 
    "ul. Kwiatowa", "ul. Weterynaryjna", "ul. Zwierzyniecka", "ul. Warszawska", "ul. Długa"
]

def clean_for_domain(text):
    replacements = {'ą':'a', 'ć':'c', 'ę':'e', 'ł':'l', 'ń':'n', 'ó':'o', 'ś':'s', 'ź':'z', 'ż':'z'}
    text = text.lower()
    for pl, en in replacements.items():
        text = text.replace(pl, en)
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

registry = {}
random.seed(42)

for i in range(1, 51):
    dev_id = f"USG-{i:04d}"
    name = random.choice(clinic_names)
    city = random.choice(cities)
    
    # Adres fizyczny
    street = random.choice(streets)
    building = str(random.randint(1, 150))
    if random.random() > 0.7:
        building += random.choice(['a', 'b', 'c'])
    zip_code = f"{random.randint(10, 99)}-{random.randint(100, 999)}"
    
    # Mail
    domain_name = clean_for_domain(name)
    domain_city = clean_for_domain(city)
    email = f"biuro@{domain_name}-{domain_city}.pl"
    
    registry[dev_id] = {
        "clinic_name": name,
        "address": f"{street} {building}",
        "zip_code": zip_code,
        "city": city,
        "contact": f"+48 {random.randint(500, 899)} {random.randint(100, 999)} {random.randint(100, 999)}",
        "email": email
    }

output_path = 'guardian-dashboard/src/clinics_mapping.json'

try:
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)
    print(f"Sukces: Zaktualizowano {output_path} o adresy i kody pocztowe do wysyłek serwisowych.")
except FileNotFoundError:
    print(f"Błąd: Nie znaleziono folderu 'guardian-dashboard/src/'.")