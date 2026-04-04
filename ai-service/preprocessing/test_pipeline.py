from audio_pipeline import run_pipeline
import sys

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "test.wav"
    features, _ = run_pipeline(path)
    print("Mel shape:", features["mel_spectrogram"].shape)
    print("Centroid shape:", features["spectral_centroid"].shape)
    print("Duration:", features["duration_seconds"], "s")
    print("Preprocessing OK")
