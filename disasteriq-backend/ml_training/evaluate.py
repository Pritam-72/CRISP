"""
Model Evaluation Script
Usage: python ml_training/evaluate.py
Loads trained models and prints confusion matrix, PR-AUC, and SHAP feature importance.
"""
import os
import sys
import pickle
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml_training.data_prep import generate_synthetic_dataset, train_test_split_temporal

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")

FEATURE_NAMES = [
    "rainfall_24h", "rainfall_72h", "temperature", "humidity",
    "wind_speed", "river_level", "river_delta", "elevation",
    "flood_freq", "ndvi", "month_sin", "month_cos", "coastal"
]


def load_model(name: str):
    path = os.path.join(MODEL_DIR, name)
    if not os.path.exists(path):
        print(f"❌ Model not found: {path}")
        return None
    with open(path, "rb") as f:
        return pickle.load(f)


def evaluate():
    print("📦 Loading test dataset...")
    X, y_flood, y_heat, y_cyclone = generate_synthetic_dataset(n_samples=1000)
    _, X_test, _, y_flood_test = train_test_split_temporal(X, y_flood, test_size=0.3)
    _, _,      _, y_heat_test  = train_test_split_temporal(X, y_heat,  test_size=0.3)
    _, _,      _, y_cyc_test   = train_test_split_temporal(X, y_cyclone, test_size=0.3)

    for label, y_test, model_file in [
        ("Flood", y_flood_test, "flood_model.pkl"),
        ("Heatwave", y_heat_test, "heatwave_model.pkl"),
        ("Cyclone", y_cyc_test, "cyclone_model.pkl"),
    ]:
        print(f"\n{'='*50}")
        print(f"  {label} Risk Model")
        print(f"{'='*50}")

        clf = load_model(model_file)
        if clf is None:
            continue

        try:
            from sklearn.metrics import (  # type: ignore
                classification_report,
                confusion_matrix,
                roc_auc_score,
                average_precision_score,
            )
        except ImportError:
            print("❌ scikit-learn not installed. Run: pip install scikit-learn")
            return

        y_pred = clf.predict(X_test)
        y_prob = clf.predict_proba(X_test)[:, 1]

        print(f"\nConfusion Matrix:\n{confusion_matrix(y_test, y_pred)}")
        print(f"\nClassification Report:\n{classification_report(y_test, y_pred, target_names=['Low Risk', 'High Risk'])}")
        print(f"AUC-ROC:  {roc_auc_score(y_test, y_prob):.4f}")
        print(f"PR-AUC:   {average_precision_score(y_test, y_prob):.4f}")

        # SHAP feature importance
        try:
            import shap  # type: ignore
            explainer = shap.TreeExplainer(clf)
            shap_values = explainer.shap_values(X_test[:200])
            mean_abs = np.abs(shap_values).mean(axis=0)
            ranked = sorted(zip(FEATURE_NAMES, mean_abs), key=lambda x: -x[1])
            print("\nTop 5 SHAP Features:")
            for feat, val in ranked[:5]:
                bar = "█" * int(val * 100)
                print(f"  {feat:20s} {bar} {val:.4f}")
        except ImportError:
            print("\n(install shap for feature importance: pip install shap)")

    print("\n✅ Evaluation complete")


if __name__ == "__main__":
    evaluate()
