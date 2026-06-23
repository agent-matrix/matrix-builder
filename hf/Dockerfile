# Matrix Builder — full stack on one Hugging Face Space (Docker SDK, port 7860).
# The Next.js UI is the public server on 7860; it proxies /api/builder/* to the FastAPI
# backend running internally on 127.0.0.1:8000 (same-origin — mirrors the Vercel topology).

# ── stage 1: build the Next.js standalone UI ──────────────────────────────────────────────
FROM node:20-slim AS web
WORKDIR /web
COPY web/package.json ./
RUN npm install --no-audit --no-fund
COPY web/ ./
# NEXT_PUBLIC_* is inlined at build time; rewrites read the *_SPACE_URL envs.
# NEXT_PUBLIC_GOOGLE_CLIENT_ID is public (safe to bake); set it to enable Sign in with Google.
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ENV NEXT_PUBLIC_API_BASE_URL=/api/builder \
    MATRIX_BUILDER_SPACE_URL=http://127.0.0.1:8000 \
    AGENT_GENERATOR_SPACE_URL=https://ruslanmv-agent-generator.hf.space \
    OLLABRIDGE_SPACE_URL=https://ruslanmv-ollabridge.hf.space \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
RUN npm run build && test -f .next/standalone/server.js
# Standalone needs static assets + public/ copied alongside the server.
RUN cp -r .next/static .next/standalone/.next/static \
  && if [ -d public ]; then cp -r public .next/standalone/public; fi

# ── stage 2: runtime (Node UI + Python API) ───────────────────────────────────────────────
FROM node:20-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/services/api \
    PIP_NO_CACHE_DIR=1 PORT=7860 PATH=/opt/venv/bin:$PATH \
    # Run the REAL engine in production: load agent_generator.engine.AgentGenerator and the
    # signed matrix-definitions pack instead of fabricating candidates/bundles/validation.
    AGENT_GENERATOR_MODE=sdk MATRIX_DEFINITIONS_MODE=sdk \
    # Public, absolute API base so the coder prompt's "Fetch the Matrix Bundle" link is a real,
    # fetchable signed URL (build.matrixhub.io proxies /api/builder/* to this backend).
    PUBLIC_API_BASE_URL=https://build.matrixhub.io/api/builder/api/v1 \
    # Matrix Designer (the brain) runs as an internal service in this same container (started by
    # start.sh). The control plane calls it here and falls back to deterministic generation if down.
    MATRIX_DESIGNER_PORT=8077 MATRIX_DESIGNER_URL=http://127.0.0.1:8077
WORKDIR /app
# git + ca-certificates are required: requirements.txt installs matrix-designer from a git+https
# URL, which pip resolves by shelling out to `git` over TLS. Without git the build fails with
# "Cannot find command 'git'"; without ca-certificates the clone fails TLS verification.
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv git ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && python3 -m venv /opt/venv
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY services/api /app/services/api
COPY scripts /app/scripts
COPY --from=web /web/.next/standalone /app/web
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh \
  && useradd -m app \
  && mkdir -p /app/.local/matrix-builder-storage /app/.local/audit \
  && chown -R app /app
USER app
EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||7860)+'/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"
CMD ["/app/start.sh"]
