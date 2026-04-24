FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install CPU-only torch first to avoid pulling the CUDA build (~2 GB extra)
RUN grep -v "^torch" requirements.txt > /tmp/req_no_torch.txt \
    && pip install --no-cache-dir \
        torch==2.3.0+cpu \
        torchaudio==2.3.0+cpu \
        --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r /tmp/req_no_torch.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
