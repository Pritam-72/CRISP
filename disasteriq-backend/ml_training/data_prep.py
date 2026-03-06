"""
ML Training — Data Preparation
Loads raw data from DB / CSV files and builds a clean training dataset.
"""
import os
import csv
import json
import math
import random
import numpy as np
from datetime import datetime, timedelta
from typing import Tuple

# ---------------------------------------------------------------------------
# Synthetic data generation (used when historical DB data is unavailable)
# ---------------------------------------------------------------------------

DISTRICTS_SAMPLE = [
    # (name, state, lat, lng, elevation_m, flood_freq, coastal)
    ("Kutch", "Gujarat", 23.7, 69.8, 50, 0.6, True),
    ("Puri", "Odisha", 19.8, 85.8, 10, 0.8, True),
    ("Patna", "Bihar", 25.6, 85.1, 53, 0.7, False),
    ("Ernakulam", "Kerala", 9.9, 76.3, 5, 0.6, True),
    ("Nashik", "Maharashtra", 19.9, 73.8, 565, 0.2, False),
    ("Jaisalmer", "Rajasthan", 26.9, 70.9, 225, 0.05, False),
    ("Assam_Kamrup", "Assam", 26.1, 91.7, 49, 0.9, False),
    ("Visakhapatnam", "Andhra Pradesh", 17.7, 83.2, 15, 0.5, True),
    ("Uttarkashi", "Uttarakhand", 30.7, 78.4, 1158, 0.4, False),
    ("Mumbai", "Maharashtra", 19.1, 72.9, 14, 0.5, True),
]


def _sin_cos(month: int):
    return math.sin(2 * math.pi * month / 12), math.cos(2 * math.pi * month / 12)


def generate_synthetic_dataset(n_samples: int = 2000) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Generate synthetic training samples for flood, heatwave, and cyclone risk.
    Returns X, y_flood, y_heatwave, y_cyclone — all as numpy arrays.
    """
    X, y_flood, y_heat, y_cyclone = [], [], [], []

    for _ in range(n_samples):
        d = random.choice(DISTRICTS_SAMPLE)
        _, _, _, _, elevation, flood_freq, coastal = d
        month = random.randint(1, 12)
        is_monsoon = 6 <= month <= 9
        ms, mc = _sin_cos(month)

        rain_24h = random.uniform(0, 80 if is_monsoon else 10)
        rain_72h = rain_24h * random.uniform(2.5, 4.0) if is_monsoon else rain_24h * 2
        temp = random.uniform(28, 44 if month in [4, 5] else 32)
        humidity = random.uniform(55, 95 if is_monsoon else 60)
        wind = random.uniform(5, 80 if coastal else 30)
        river = random.uniform(0.8, 4.5 if is_monsoon else 1.5)
        river_delta = random.uniform(-0.5, 1.5)
        ndvi = random.uniform(0.2, 0.8)

        features = [
            rain_24h, rain_72h, temp, humidity, wind,
            river, river_delta, elevation, flood_freq, ndvi, ms, mc,
            1.0 if coastal else 0.0,
        ]
        X.append(features)

        # Label generation with realistic thresholds
        flood = int(rain_72h > 60 or (river > 3.5 and river_delta > 0.5) or
                    (flood_freq > 0.6 and rain_24h > 30))
        heatwave = int(temp > 40 and humidity < 30)
        cyclone = int(coastal and wind > 60 and is_monsoon)

        y_flood.append(flood)
        y_heat.append(heatwave)
        y_cyclone.append(cyclone)

    return (
        np.array(X, dtype=np.float32),
        np.array(y_flood),
        np.array(y_heat),
        np.array(y_cyclone),
    )


def load_ndma_csv(filepath: str) -> Tuple[np.ndarray, np.ndarray]:
    """
    Load real NDMA historical disaster event CSV if available.
    Expected columns: year, district, state, disaster_type, deaths, affected
    Returns X (dummy features), y_flood for now — extend as data becomes available.
    """
    if not os.path.exists(filepath):
        print(f"⚠️  NDMA CSV not found at {filepath}, using synthetic data")
        X, y_flood, _, _ = generate_synthetic_dataset()
        return X, y_flood

    X, y = [], []
    with open(filepath, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            disaster = row.get("disaster_type", "").lower()
            y.append(1 if "flood" in disaster else 0)
            # Use available numeric fields as proxy features
            X.append([
                float(row.get("annual_rainfall_mm", 0) or 0),
                float(row.get("deaths", 0) or 0),
                float(row.get("affected", 0) or 0),
            ])
    return np.array(X, dtype=np.float32), np.array(y)


def train_test_split_temporal(X: np.ndarray, y: np.ndarray, test_size: float = 0.2):
    """Temporal split — last test_size proportion as test set (no shuffle)."""
    split = int(len(X) * (1 - test_size))
    return X[:split], X[split:], y[:split], y[split:]


if __name__ == "__main__":
    X, y_flood, y_heat, y_cyclone = generate_synthetic_dataset(2000)
    print(f"Dataset shape: {X.shape}")
    print(f"Flood positives: {y_flood.sum()} / {len(y_flood)}")
    print(f"Heatwave positives: {y_heat.sum()} / {len(y_heat)}")
    print(f"Cyclone positives: {y_cyclone.sum()} / {len(y_cyclone)}")
    np.save("X_train.npy", X)
    np.save("y_flood.npy", y_flood)
    np.save("y_heat.npy", y_heat)
    np.save("y_cyclone.npy", y_cyclone)
    print("✅ Saved training arrays to .npy files")
