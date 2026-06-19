# Hugging Face Spaces (Docker SDK) entrypoint — one simple container, no k8s/replicas.
# See docs/deploy-huggingface.md. HF Spaces serves the app on port 7860 by default.
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/services/api PIP_NO_CACHE_DIR=1 PORT=7860 \
    # Matrix Designer (the brain) is installed via requirements.txt and started alongside the API
    # below; the control plane calls it here and falls back to deterministic generation if down.
    MATRIX_DESIGNER_PORT=8077 MATRIX_DESIGNER_URL=http://127.0.0.1:8077
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY requirements.txt /app/requirements.txt
RUN uv pip install --system -r /app/requirements.txt
COPY services/api /app/services/api
COPY scripts /app/scripts
RUN useradd -m app \
  && mkdir -p /app/.local/matrix-builder-storage /app/.local/audit \
  && chown -R app /app
USER app
EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"7860\")}/health', timeout=3).read()"
# DATABASE_URL (matrix_app) + MB_JWT_SECRET come from Space secrets. Migrations are run separately
# by an operator (make migrate) against Aiven — the web container does not self-migrate.
# Start Matrix Designer (the brain) in the background if installed, then the API in the foreground.
CMD ["sh", "-c", "if python -c 'import matrix_designer' 2>/dev/null; then (cd /tmp && python -m matrix_designer.service >/tmp/designer.log 2>&1 &); fi; python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
