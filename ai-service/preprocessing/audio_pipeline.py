import tempfile
import os
import numpy as np
import librosa
import soundfile as sf
from df.enhance import enhance, init_df, load_audio
from df.io import resample

TARGET_SR = 16000


def load_and_resample(path: str):
    audio, sr = librosa.load(path, sr=None, mono=True)
    if sr != TARGET_SR:
        audio = librosa.resample(audio, orig_sr=sr, target_sr=TARGET_SR)
    return audio


def denoise(audio: np.ndarray):
    model, df_state, _ = init_df()
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    try:
        sf.write(tmp.name, audio, TARGET_SR)
        tmp.close()
        noisy, _ = load_audio(tmp.name, sr=df_state.sr())
        enhanced = enhance(model, df_state, noisy)
        return enhanced.squeeze().numpy()
    finally:
        os.unlink(tmp.name)


def extract_features(audio: np.ndarray):
    mel = librosa.feature.melspectrogram(
        y=audio,
        sr=TARGET_SR,
        n_mels=128,
        fmax=8000
    )
    mel_db = librosa.power_to_db(mel, ref=np.max)

    centroid = librosa.feature.spectral_centroid(y=audio, sr=TARGET_SR)

    return {
        "mel_spectrogram": mel_db,
        "spectral_centroid": centroid,
        "duration_seconds": len(audio) / TARGET_SR
    }


def run_pipeline(file_path: str):
    audio = load_and_resample(file_path)
    clean_audio = denoise(audio)
    features = extract_features(clean_audio)
    return features, clean_audio
