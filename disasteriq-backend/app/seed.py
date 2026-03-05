"""
Seed script: populates 50 Indian districts, demo users, and initial resources.
Called automatically at startup if tables are empty.
"""
import random
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models import District, User, Resource, WeatherSnapshot, RiskScore
from app.auth import hash_password

DISTRICTS_DATA = [
    # (name, state, population, lat, lng, elevation_m, flood_freq, coastal)
    ("Bhubaneswar", "Odisha", 900000, 20.2961, 85.8245, 45, 0.8, False),
    ("Puri", "Odisha", 300000, 19.8135, 85.8312, 5, 1.2, True),
    ("Cuttack", "Odisha", 650000, 20.4625, 85.8830, 30, 1.0, False),
    ("Ganjam", "Odisha", 400000, 19.3860, 84.8044, 10, 1.1, True),
    ("Kendrapara", "Odisha", 350000, 20.5004, 86.4124, 5, 1.3, True),
    ("Ahmedabad", "Gujarat", 7200000, 23.0225, 72.5714, 53, 0.4, False),
    ("Kutch", "Gujarat", 2100000, 23.7337, 69.8597, 45, 0.7, True),
    ("Surat", "Gujarat", 4500000, 21.1702, 72.8311, 12, 0.6, True),
    ("Bharuch", "Gujarat", 1600000, 21.7051, 72.9959, 18, 0.5, True),
    ("Rajkot", "Gujarat", 2200000, 22.3039, 70.8022, 134, 0.3, False),
    ("Thiruvananthapuram", "Kerala", 1700000, 8.5241, 76.9366, 58, 0.5, True),
    ("Ernakulam", "Kerala", 3100000, 9.9312, 76.2673, 15, 0.7, True),
    ("Wayanad", "Kerala", 817000, 11.6854, 76.1320, 780, 0.9, False),
    ("Idukki", "Kerala", 1110000, 9.9189, 77.1025, 900, 0.6, False),
    ("Kozhikode", "Kerala", 3100000, 11.2588, 75.7804, 25, 0.6, True),
    ("Patna", "Bihar", 5800000, 25.5941, 85.1376, 55, 1.1, False),
    ("Darbhanga", "Bihar", 3900000, 26.1542, 85.8918, 52, 1.4, False),
    ("Muzaffarpur", "Bihar", 4800000, 26.1197, 85.3910, 60, 1.3, False),
    ("Supaul", "Bihar", 2230000, 26.1218, 86.5989, 55, 1.5, False),
    ("Saharsa", "Bihar", 1900000, 25.8858, 86.5990, 42, 1.3, False),
    ("Chennai", "Tamil Nadu", 10000000, 13.0827, 80.2707, 6, 0.5, True),
    ("Cuddalore", "Tamil Nadu", 2600000, 11.7480, 79.7714, 5, 0.7, True),
    ("Nagapattinam", "Tamil Nadu", 1600000, 10.7672, 79.8449, 5, 1.0, True),
    ("Madurai", "Tamil Nadu", 3100000, 9.9252, 78.1198, 147, 0.3, False),
    ("Theni", "Tamil Nadu", 1250000, 10.0104, 77.4770, 300, 0.4, False),
    ("Mumbai", "Maharashtra", 20700000, 19.0760, 72.8777, 11, 0.4, True),
    ("Raigad", "Maharashtra", 2630000, 18.5158, 73.1837, 50, 0.6, True),
    ("Kolhapur", "Maharashtra", 3880000, 16.7050, 74.2433, 584, 0.5, False),
    ("Nashik", "Maharashtra", 6100000, 19.9975, 73.7898, 584, 0.3, False),
    ("Osmanabad", "Maharashtra", 1660000, 18.1860, 76.0408, 640, 0.2, False),
    ("Kolkata", "West Bengal", 14800000, 22.5726, 88.3639, 9, 0.6, False),
    ("Murshidabad", "West Bengal", 7100000, 24.1756, 88.2694, 20, 0.9, False),
    ("South 24 Parganas", "West Bengal", 8160000, 22.1532, 88.7462, 5, 1.1, True),
    ("North 24 Parganas", "West Bengal", 10100000, 22.7262, 88.4185, 8, 0.8, False),
    ("Cooch Behar", "West Bengal", 2870000, 26.3249, 89.4499, 43, 0.7, False),
    ("Dibrugarh", "Assam", 1320000, 27.4728, 94.9120, 108, 1.2, False),
    ("Dhemaji", "Assam", 688000, 27.4731, 94.5597, 100, 1.5, False),
    ("Barpeta", "Assam", 1690000, 26.3216, 91.0014, 35, 1.3, False),
    ("Kamrup", "Assam", 1250000, 26.1439, 91.7362, 55, 1.0, False),
    ("Vizianagaram", "Andhra Pradesh", 2250000, 18.1066, 83.3956, 65, 0.5, True),
    ("Srikakulam", "Andhra Pradesh", 2700000, 18.2949, 83.8935, 40, 0.7, True),
    ("East Godavari", "Andhra Pradesh", 5150000, 17.3850, 81.9300, 20, 0.8, True),
    ("Krishna", "Andhra Pradesh", 4530000, 16.6100, 80.7214, 15, 0.6, True),
    ("Guntur", "Andhra Pradesh", 4890000, 16.3067, 80.4365, 30, 0.5, True),
    ("Jaipur", "Rajasthan", 6600000, 26.9124, 75.7873, 432, 0.2, False),
    ("Barmer", "Rajasthan", 2600000, 25.7463, 71.3939, 227, 0.1, False),
    ("Indore", "Madhya Pradesh", 3200000, 22.7196, 75.8577, 553, 0.2, False),
    ("Bhopal", "Madhya Pradesh", 2300000, 23.2599, 77.4126, 527, 0.2, False),
    ("Lucknow", "Uttar Pradesh", 3800000, 26.8467, 80.9462, 111, 0.4, False),
    ("Varanasi", "Uttar Pradesh", 3700000, 25.3176, 82.9739, 80, 0.5, False),
]


def seed_if_empty():
    db = SessionLocal()
    try:
        existing_count = db.query(District).count()
        if existing_count > 0:
            print(f"[OK] DB already seeded: {existing_count} districts found")
            return

        print("[*] Seeding database with 50 Indian districts...")

        # ── Seed districts ──────────────────────────────────────────────────
        districts = []
        for i, (name, state, pop, lat, lng, elev, freq, coastal) in enumerate(DISTRICTS_DATA, start=1):
            d = District(
                id=i, name=name, state=state, population=pop,
                lat=lat, lng=lng, elevation_m=elev,
                historical_flood_freq=freq, coastal_district=coastal,
                vulnerability_weight=round(1.0 + freq * 0.2, 2),
            )
            db.add(d)
            districts.append(d)
        db.commit()
        print(f"   [OK] {len(districts)} districts added")

        # ── Seed weather snapshots ───────────────────────────────────────────
        for d in districts:
            for h in range(12):  # 12 historical snapshots (last 3 hours of 15-min intervals)
                t = datetime.utcnow() - timedelta(minutes=15 * h)
                rain = random.uniform(0, 20 if d.coastal_district else 5)
                snap = WeatherSnapshot(
                    district_id=d.id, time=t,
                    rainfall_mm=round(rain, 1),
                    temperature_c=round(random.uniform(24, 38), 1),
                    humidity_pct=round(random.uniform(50, 90), 1),
                    wind_speed_kmh=round(random.uniform(5, 35), 1),
                    river_level_m=round(random.uniform(0.8, 3.0), 2),
                    source="seed",
                )
                db.add(snap)
        db.commit()
        print("   [OK] Weather snapshots seeded")

        # ── Seed initial risk scores ─────────────────────────────────────────
        for d in districts:
            flood = min(d.historical_flood_freq * random.uniform(0.3, 0.9), 1.0)
            heatwave = round(random.uniform(0.05, 0.4), 3)
            cyclone = round(d.historical_flood_freq * 0.4 if d.coastal_district else 0.02, 3)
            composite = round(0.5 * flood + 0.3 * cyclone + 0.2 * heatwave, 3)

            for h in range(8):  # 8 historical score entries
                t = datetime.utcnow() - timedelta(hours=h)
                variation = random.uniform(-0.05, 0.05)
                rs = RiskScore(
                    district_id=d.id, time=t,
                    flood_risk=round(min(flood + variation, 1.0), 3),
                    heatwave_risk=round(heatwave, 3),
                    cyclone_risk=round(cyclone, 3),
                    composite_risk=round(min(composite + variation, 1.0), 3),
                    people_at_risk=int(d.population * composite * 0.3),
                    confidence=0.72,
                    shap_explanation='{"rainfall":0.25,"flood_freq":0.20,"elevation":0.15,"coastal":0.10}',
                )
                db.add(rs)
        db.commit()
        print("   [OK] Risk scores seeded")

        # ── Seed resources ───────────────────────────────────────────────────
        depot_district_ids = [1, 6, 11, 16, 21, 26, 31, 36]  # major city depots
        resource_types = [
            ("truck", 50, 30), ("boat", 20, 15), ("medical", 100, 80), ("food", 500, 400)
        ]
        for did in depot_district_ids:
            for rtype, cap, qty in resource_types:
                r = Resource(
                    type=rtype, quantity=qty, location_district=did,
                    status="available", capacity=cap,
                )
                db.add(r)
        db.commit()
        print("   [OK] Resources seeded")

        # ── Seed demo users ──────────────────────────────────────────────────
        demo_users = [
            ("admin@disasteriq.in", "demo123", "admin", None),
            ("odisha.officer@disasteriq.in", "demo123", "officer", 1),
            ("ngo@relief.in", "demo123", "ngo", 6),
        ]
        for email, pwd, role, dist_id in demo_users:
            u = User(
                email=email,
                hashed_password=hash_password(pwd),
                role=role,
                district_id=dist_id,
            )
            db.add(u)
        db.commit()
        print("   [OK] Demo users created")
        print("\n[DONE] Seeding complete! Login: admin@disasteriq.in / demo123")

    except Exception as e:
        print(f"[ERROR] Seed error: {e}")
        db.rollback()
    finally:
        db.close()
