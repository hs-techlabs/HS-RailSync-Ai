# Indian Railways AI Automatic Block Planning System - Production Backend
FROM python:3.11-slim

# Install system dependencies needed for C++ extensions, OR-Tools, and XGBoost
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency definition and install
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

# Copy backend source, data, scripts, and entry points
COPY . .

# Expose standard FastAPI port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Run the master system pipeline (initializes datasets, ML models, OR-Tools solver, and starts Uvicorn)
CMD ["python", "run_system.py"]
