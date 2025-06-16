# Use Node.js 18 as base (includes both Node.js and npm)
FROM node:18-slim

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and create symlinks
RUN pip3 install --upgrade pip
RUN ln -s /usr/bin/python3 /usr/bin/python

# Set working directory
WORKDIR /app

# Copy and install Python requirements
COPY requirements.txt .
RUN pip3 install --no-cache-dir --timeout=1000 -r requirements.txt

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