from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

from .predictor import MODEL_PATH, VECTORIZER_PATH


def train_model_from_csv(csv_path: Path) -> None:
    data = pd.read_csv(csv_path)
    texts = data["text"]
    labels = data["label"]

    X_train, X_test, y_train, y_test = train_test_split(texts, labels, test_size=0.2, random_state=42)

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=5000)
    classifier = RandomForestClassifier(n_estimators=200, random_state=42)

    pipeline = Pipeline([("vectorizer", vectorizer), ("classifier", classifier)])
    pipeline.fit(X_train, y_train)

    predictions = pipeline.predict(X_test)
    report = classification_report(y_test, predictions)
    print("Evaluation report:\n", report)

    joblib.dump(pipeline.named_steps["classifier"], MODEL_PATH)
    joblib.dump(pipeline.named_steps["vectorizer"], VECTORIZER_PATH)


if __name__ == "__main__":
    sample_csv = Path(__file__).resolve().parent / "sample_training_data.csv"
    if not sample_csv.exists():
        raise FileNotFoundError(f"Expected training data at {sample_csv}")
    train_model_from_csv(sample_csv)
