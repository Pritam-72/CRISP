"""
LSTM Risk Model Training Script
Usage: python ml_training/train_lstm.py
Trains a 2-layer LSTM on synthetic time-series sequences.
Saves model to ml_training/models/lstm_model.h5 (TensorFlow/Keras format).
"""
import os
import sys
import numpy as np
import random

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
TIMESTEPS = 12   # 12 × 6h = 72h window
FEATURES = 5     # rainfall, temp, humidity, wind, river_level


def generate_sequence_dataset(n_samples: int = 2000):
    """Generate (n, 12, 5) sequence dataset with labels (n, 3)."""
    X = []
    y = []

    for _ in range(n_samples):
        is_monsoon = random.random() > 0.5
        is_coastal = random.random() > 0.6

        seq = []
        for t in range(TIMESTEPS):
            rain = random.uniform(0, 50 if is_monsoon else 5)
            temp = random.uniform(28, 43 if not is_monsoon else 33)
            humidity = random.uniform(55, 95 if is_monsoon else 60)
            wind = random.uniform(5, 70 if is_coastal else 25)
            river = random.uniform(0.8, 4.0 if is_monsoon else 1.5)
            seq.append([rain, temp, humidity, wind, river])

        X.append(seq)

        # Labels based on last timestep thresholds
        last = seq[-1]
        flood = 1 if (last[0] > 30 and last[4] > 3.0) else 0
        heat = 1 if (last[1] > 40 and last[2] < 35) else 0
        cyclone = 1 if (is_coastal and last[3] > 60) else 0
        y.append([flood, heat, cyclone])

    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)


def build_model():
    try:
        from tensorflow import keras  # type: ignore
        from tensorflow.keras import layers  # type: ignore
    except ImportError:
        print("❌ TensorFlow not installed. Run: pip install tensorflow")
        return None

    model = keras.Sequential([
        layers.LSTM(64, return_sequences=True, input_shape=(TIMESTEPS, FEATURES)),
        layers.Dropout(0.3),
        layers.LSTM(32),
        layers.Dense(64, activation="relu"),
        layers.Dropout(0.3),
        layers.Dense(3, activation="sigmoid"),  # [flood, heatwave, cyclone]
    ])
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    return model


def train():
    print("📦 Generating sequence dataset...")
    X, y = generate_sequence_dataset(n_samples=3000)
    split = int(len(X) * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    print(f"   Train: {X_train.shape}, Test: {X_test.shape}")

    model = build_model()
    if model is None:
        return

    model.summary()
    os.makedirs(MODEL_DIR, exist_ok=True)

    from tensorflow import keras  # type: ignore
    callbacks = [
        keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=3),
    ]

    print("\n🔧 Training LSTM model...")
    model.fit(
        X_train, y_train,
        validation_data=(X_test, y_test),
        epochs=50,
        batch_size=32,
        callbacks=callbacks,
        verbose=1,
    )

    # Evaluate
    loss, acc = model.evaluate(X_test, y_test, verbose=0)
    print(f"\n✅ Test loss: {loss:.4f}, Test accuracy: {acc:.4f}")

    save_path = os.path.join(MODEL_DIR, "lstm_model.h5")
    model.save(save_path)
    print(f"✅ LSTM model saved → {save_path}")


if __name__ == "__main__":
    train()
