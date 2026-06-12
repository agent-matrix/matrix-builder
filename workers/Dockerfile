FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/services/api:/app
WORKDIR /app
RUN addgroup --system matrixbuilder && adduser --system --ingroup matrixbuilder matrixbuilder
COPY services/api /app/services/api
COPY workers /app/workers
RUN python -m pip install --no-cache-dir fastapi pydantic && chown -R matrixbuilder:matrixbuilder /app
USER matrixbuilder
CMD ["python", "workers/worker.py"]
