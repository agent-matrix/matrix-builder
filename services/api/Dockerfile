FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/services/api
WORKDIR /app
RUN addgroup --system matrixbuilder && adduser --system --ingroup matrixbuilder --home /home/matrixbuilder matrixbuilder
COPY services/api/pyproject.toml /app/services/api/pyproject.toml
RUN python -m pip install --no-cache-dir --upgrade pip && python -m pip install --no-cache-dir fastapi uvicorn pydantic
COPY services/api /app/services/api
RUN mkdir -p /app/.local/matrix-builder-storage /app/.local/audit && chown -R matrixbuilder:matrixbuilder /app
USER matrixbuilder
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).read()"
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
