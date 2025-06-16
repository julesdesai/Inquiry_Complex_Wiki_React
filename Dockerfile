# Multi-stage Docker build for full-stack app
FROM node:18 AS frontend-build

# Build React frontend
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Python backend stage
FROM python:3.11-slim AS backend

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Python requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY server.js .
COPY src/python/ ./src/python/
COPY public/prompts/ ./public/prompts/

# Copy built frontend from previous stage
COPY --from=frontend-build /app/build ./build

# Install Node.js for the Express server
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

# Install Node.js dependencies
COPY package*.json ./
RUN npm install --only=production

# Expose port
EXPOSE 3001

# Start the Express server
CMD ["node", "server.js"]