import tempfile
import os
import numpy as np
import librosa
import soundfile as sf
from scipy.io import wavfile
from df.enhance import enhance, init_df, load_audio
from df.io import resample

from voice.rvc_enhancer import enhance_vocalization

TARGET_SR = 16000


def load_and_resample(path: str):
    try:
        # Try scipy first for WAV files (more reliable)
        if path.endswith('.wav'):
            try:
                sr, audio = wavfile.read(path)
                audio = audio.astype(np.float32) / 32768.0  # Normalize to [-1, 1]
                if sr != TARGET_SR:
                    audio = librosa.resample(audio, orig_sr=sr, target_sr=TARGET_SR)
                return audio
            except Exception as wav_err:
                print(f"scipy wavfile failed: {wav_err}, trying librosa...")
        
        # Fallback to librosa
        audio, sr = librosa.load(path, sr=None, mono=True)
        if sr != TARGET_SR:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=TARGET_SR)
        return audio
    except Exception as e:
        raise RuntimeError(f"Failed to load audio file from {path}: {str(e)}. Ensure file is valid WAV/MP3/FLAC format.")


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
    # Optional RVC v3 voice enhancement — skipped gracefully if model unavailable
    enhanced_audio, rvc_applied = enhance_vocalization(clean_audio, sample_rate=TARGET_SR)
    features = extract_features(enhanced_audio)
    return features, enhanced_audio, rvc_applied
