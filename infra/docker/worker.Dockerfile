FROM python:3.12-slim
WORKDIR /app
COPY workers ./workers
CMD ["python", "workers/worker.py"]
