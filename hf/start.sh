#!/usr/bin/env sh
set -e
# Matrix Designer (the brain) — internal HTTP service the control plane calls to design the
# blueprints/batches. Best-effort: if it fails to boot, the control plane falls back to its
# deterministic generator, so the app still works. Bound to localhost; never public.
export MATRIX_DESIGNER_PORT="${MATRIX_DESIGNER_PORT:-8077}"
export MATRIX_DESIGNER_URL="${MATRIX_DESIGNER_URL:-http://127.0.0.1:${MATRIX_DESIGNER_PORT}}"
if python -c "import matrix_designer" 2>/dev/null; then
  echo "-> starting Matrix Designer service on 127.0.0.1:${MATRIX_DESIGNER_PORT}"
  ( cd /tmp && python -m matrix_designer.service ) &
else
  echo "-> Matrix Designer not installed; control plane will use the deterministic generator"
fi

# Backend (internal, same-origin target of the Next.js /api/builder rewrite).
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers &

# Frontend (public). Next standalone honors PORT/HOSTNAME.
cd /app/web
export PORT="${PORT:-7860}" HOSTNAME=0.0.0.0
exec node server.js
