FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "case \"${DYNO:-web.1}\" in release.*) exec python -m ingestion.migrate ;; worker.*) exec python -m ingestion.worker ;; *) exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} ;; esac"]
