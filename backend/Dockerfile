FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# Create non-root system user and group
RUN groupadd -g 10001 proofpatch && \
    useradd -u 10001 -g proofpatch -s /bin/bash -m proofpatch

# Install curl for healthcheck
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code and tests
COPY . /app/

# Ensure workspace and artifacts directories exist and are owned by non-root user
RUN mkdir -p /app/workspaces /app/artifacts /app/data && \
    chown -R proofpatch:proofpatch /app

USER proofpatch

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/health || exit 1

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
