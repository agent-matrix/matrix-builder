#!/usr/bin/env sh
set -e
# Backend (internal, same-origin target of the Next.js /api/builder rewrite).
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers &
# Frontend (public). Next standalone honors PORT/HOSTNAME.
cd /app/web
export PORT="${PORT:-7860}" HOSTNAME=0.0.0.0
exec node server.js
