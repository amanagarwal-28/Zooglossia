import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from preprocessing.audio_pipeline import run_pipeline
from models.naturelm_classifier import run_on_clean_audio

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "preprocessing/test.wav"

    if os.getenv("NATURELM_FAST_MODE", "0") == "1":
        print("NATURELM_FAST_MODE=1 -> skipping slow text generation, extracting embedding only")

    print("Running preprocessing...")
    features, clean_audio = run_pipeline(path)
    print(f"Audio duration: {features['duration_seconds']:.1f}s")

    print("Running NatureLM classification...")
    result = run_on_clean_audio(clean_audio)

    print(f"\nIntent:      {result['intent_label']}")
    print(f"Raw output:  {result['raw_model_output']}")
    print(f"Embedding:   shape={result['embedding_shape']}")
