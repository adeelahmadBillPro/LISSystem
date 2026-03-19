# Multi-stage build for LIS System
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM python:3.13-slim AS production
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ ./backend/

# Copy frontend build
COPY --from=frontend-build /app/frontend/dist ./static/

# Create directories
RUN mkdir -p logs reports barcodes qrcodes signatures backups

# Expose port
EXPOSE 8000

# Start server
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
