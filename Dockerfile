# Use Ubuntu base image for better Python support
FROM ubuntu:22.04

# Install Node.js 18 and Python
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks for python commands
RUN ln -s /usr/bin/python3 /usr/bin/python

# Set working directory
WORKDIR /app

# Install Python requirements first (most likely to fail)
COPY requirements.txt .
RUN python3 -m pip install --upgrade pip && \
    python3 -m pip install -r requirements.txt

# Copy package.json and install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy all source code
COPY . .

# Build React frontend
RUN npm run build

# Expose port
EXPOSE 3001

# Start the Express server
CMD ["node", "server.js"]