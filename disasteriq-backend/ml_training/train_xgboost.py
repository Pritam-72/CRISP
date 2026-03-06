"""
XGBoost Risk Model Training Script
Usage: python ml_training/train_xgboost.py
Trains 3 binary classifiers: flood, heatwave, cyclone
Saves models to ml_training/models/*.pkl
"""
import os
import pickle
import numpy as np

# Add project root to path
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml_training.data_prep import generate_synthetic_dataset, train_test_split_temporal

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")


def train():
    print("📦 Generating training dataset...")
    X, y_flood, y_heat, y_cyclone = generate_synthetic_dataset(n_samples=3000)

    os.makedirs(MODEL_DIR, exist_ok=True)

    try:
        from xgboost import XGBClassifier  # type: ignore
    except ImportError:
        print("❌ XGBoost not installed. Run: pip install xgboost")
        return

    for label, y, filename in [
        ("flood", y_flood, "flood_model.pkl"),
        ("heatwave", y_heat, "heatwave_model.pkl"),
        ("cyclone", y_cyclone, "cyclone_model.pkl"),
    ]:
        X_train, X_test, y_train, y_test = train_test_split_temporal(X, y, test_size=0.2)

        print(f"\n🔧 Training {label} model — {X_train.shape[0]} samples, {y_train.sum()} positives")

        clf = XGBClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            use_label_encoder=False,
            eval_metric="logloss",
            random_state=42,
        )
        clf.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

        # Basic evaluation
        from sklearn.metrics import classification_report, roc_auc_score  # type: ignore
        y_pred = clf.predict(X_test)
        y_prob = clf.predict_proba(X_test)[:, 1]

        print(f"   AUC-ROC: {roc_auc_score(y_test, y_prob):.4f}")
        print(classification_report(y_test, y_pred, target_names=["low", "high"]))

        # Print top SHAP features
        try:
            import shap  # type: ignore
            explainer = shap.TreeExplainer(clf)
            shap_vals = explainer.shap_values(X_test[:100])
            feature_names = [
                "rainfall_24h", "rainfall_72h", "temperature", "humidity",
                "wind_speed", "river_level", "river_delta", "elevation",
                "flood_freq", "ndvi", "month_sin", "month_cos", "coastal"
            ]
            mean_abs = np.abs(shap_vals).mean(axis=0)
            ranked = sorted(zip(feature_names, mean_abs), key=lambda x: -x[1])
            print(f"   Top features: {ranked[:5]}")
        except ImportError:
            print("   (install shap for feature importance)")

        # Save
        path = os.path.join(MODEL_DIR, filename)
        with open(path, "wb") as f:
            pickle.dump(clf, f)
        print(f"   ✅ Saved → {path}")

    print("\n🎉 All models trained successfully!")


if __name__ == "__main__":
    train()
