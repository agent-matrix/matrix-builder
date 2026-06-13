FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/services/api PIP_NO_CACHE_DIR=1 PORT=8000
WORKDIR /app
RUN pip install --no-cache-dir uv
RUN addgroup --system matrixbuilder && adduser --system --ingroup matrixbuilder --home /home/matrixbuilder matrixbuilder
# Install the full runtime (API + Aiven persistence + auth) from the single requirements source.
COPY requirements.txt /app/requirements.txt
RUN uv pip install --system -r /app/requirements.txt
COPY services/api /app/services/api
RUN mkdir -p /app/.local/matrix-builder-storage /app/.local/audit && chown -R matrixbuilder:matrixbuilder /app
USER matrixbuilder
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/health', timeout=3).read()"
CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
