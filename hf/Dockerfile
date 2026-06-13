# Matrix Builder — standalone Hugging Face Space (Docker SDK).
#
# Self-contained: fetches the app from the matrix-builder repo at build time, so the Space
# stays thin (just this Dockerfile + README.md). HF Spaces serves on port 7860.
# Override the source with build args MATRIX_BUILDER_REPO / MATRIX_BUILDER_REF.
FROM python:3.12-slim

ARG MATRIX_BUILDER_REPO=https://github.com/agent-matrix/matrix-builder.git
ARG MATRIX_BUILDER_REF=main

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/services/api \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860

WORKDIR /app

# git to fetch the app; uv for fast installs.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && pip install --no-cache-dir uv

# Shallow-clone only what we need, then drop the .git history to keep the image small.
RUN git clone --depth 1 --branch "${MATRIX_BUILDER_REF}" "${MATRIX_BUILDER_REPO}" /tmp/src \
  && cp /tmp/src/requirements.txt /app/requirements.txt \
  && cp -r /tmp/src/services/api /app/services/api \
  && cp -r /tmp/src/scripts /app/scripts \
  && rm -rf /tmp/src

RUN uv pip install --system -r /app/requirements.txt

RUN useradd -m app \
  && mkdir -p /app/.local/matrix-builder-storage /app/.local/audit \
  && chown -R app /app
USER app

EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"7860\")}/health', timeout=3).read()"

# DATABASE_URL (matrix_app) + MB_JWT_SECRET come from Space secrets. Migrations are run
# separately by an operator (make migrate) against Aiven — this container does not self-migrate.
CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
