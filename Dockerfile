# Use the official Ubuntu image
FROM ubuntu:latest 

# Install necessary packages
RUN apt-get update && \
    apt-get install -y \
    build-essential \
    curl \
    net-tools \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Expose the necessary port
EXPOSE 4000