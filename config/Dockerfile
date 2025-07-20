# Custom n8n Dockerfile Template
# Use this template to create custom n8n deployments with additional features
# This Dockerfile extends the official n8n image with customizations

# Start from official n8n image
# Pin to specific version for production stability
FROM n8nio/n8n:1.54.0

# Metadata
LABEL maintainer="your-email@example.com"
LABEL description="Custom n8n deployment with additional features"
LABEL version="1.0.0"

# Switch to root for system modifications
USER root

# === SYSTEM DEPENDENCIES ===
# Install additional system packages if needed
# Uncomment and modify based on your requirements
RUN apk add --no-cache \
    # Python for Python nodes (if needed)
    # python3 \
    # python3-pip \
    # Git for git operations
    git \
    # Curl for health checks and debugging
    curl \
    # Additional tools
    # imagemagick \
    # ffmpeg \
    # ghostscript \
    && rm -rf /var/cache/apk/*

# === PYTHON DEPENDENCIES ===
# Install Python packages if using Python nodes
# Uncomment and modify based on your requirements
# RUN pip3 install --no-cache-dir \
#     pandas \
#     numpy \
#     requests \
#     beautifulsoup4 \
#     openpyxl \
#     pillow

# === NODE.JS DEPENDENCIES ===
# Install additional Node.js packages globally if needed
# RUN npm install -g \
#     sharp \
#     puppeteer \
#     canvas

# === CUSTOM NODES ===
# Copy custom nodes into the image
# Create custom nodes directory structure first
RUN mkdir -p /home/node/.n8n/custom

# Copy custom nodes from your repository
# COPY custom-nodes/ /home/node/.n8n/custom/

# Example: Install community nodes
# RUN npm install -g n8n-nodes-saleforce
# RUN npm install -g n8n-nodes-google-analytics

# === CONFIGURATION FILES ===
# Copy custom configuration files
# COPY config/n8n-config.json /home/node/.n8n/config.json

# Copy custom credentials template
# COPY config/credentials.json /tmp/credentials-template.json

# === CUSTOM SCRIPTS ===
# Copy initialization scripts
COPY scripts/init.sh /usr/local/bin/init.sh
RUN chmod +x /usr/local/bin/init.sh

# Copy health check script
COPY scripts/health-check.sh /usr/local/bin/health-check.sh
RUN chmod +x /usr/local/bin/health-check.sh

# === FILE PERMISSIONS ===
# Ensure proper ownership of n8n directories
RUN chown -R node:node /home/node/.n8n
RUN chown -R node:node /usr/local/lib/node_modules/n8n

# Switch back to node user for security
USER node

# === WORKING DIRECTORY ===
WORKDIR /home/node/.n8n

# === ENVIRONMENT VARIABLES ===
# Set default environment variables (can be overridden in render.yaml)
ENV N8N_USER_FOLDER=/home/node/.n8n
ENV N8N_LOG_LEVEL=info
ENV N8N_LOG_OUTPUT=console

# === EXPOSE PORTS ===
# Expose n8n default port
EXPOSE 5000

# === HEALTH CHECK ===
# Define health check using custom script
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD /usr/local/bin/health-check.sh

# === VOLUME DEFINITIONS ===
# Define volume mount points (used with persistent disk)
VOLUME ["/home/node/.n8n"]

# === STARTUP SCRIPT ===
# Create startup script to handle initialization
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Run initialization script\n\
if [ -f /usr/local/bin/init.sh ]; then\n\
    echo "Running initialization script..."\n\
    /usr/local/bin/init.sh\n\
fi\n\
\n\
# Start n8n with proper configuration\n\
echo "Starting n8n..."\n\
exec n8n start\n\
' > /usr/local/bin/start.sh && chmod +x /usr/local/bin/start.sh

# === DEFAULT COMMAND ===
# Use custom startup script
CMD ["/usr/local/bin/start.sh"]

# === BUILD ARGUMENTS ===
# Accept build arguments for customization
ARG BUILD_VERSION=unknown
ARG BUILD_DATE=unknown
ARG GIT_COMMIT=unknown

# Add build information as labels
LABEL build.version=$BUILD_VERSION
LABEL build.date=$BUILD_DATE
LABEL build.git-commit=$GIT_COMMIT

# === PERFORMANCE OPTIMIZATIONS ===
# Set Node.js performance options
ENV NODE_OPTIONS="--max-old-space-size=1024"

# === SECURITY SETTINGS ===
# Drop unnecessary capabilities (if running with privileged: false)
# This is handled by Render automatically

# === MULTI-STAGE BUILD EXAMPLE ===
# For complex builds, you can use multi-stage builds
# Uncomment and modify as needed:

# FROM node:18-alpine AS builder
# WORKDIR /app
# COPY package*.json ./
# RUN npm ci --only=production

# FROM n8nio/n8n:1.54.0
# COPY --from=builder /app/node_modules ./node_modules

# === COMMENTS FOR CUSTOMIZATION ===
# 
# CUSTOM NODES:
# To add custom nodes, place them in the custom-nodes/ directory
# and uncomment the COPY line above. Custom nodes should follow
# n8n's node development guidelines.
#
# SYSTEM PACKAGES:
# Add system packages in the RUN apk add command above.
# Common packages include: python3, imagemagick, ffmpeg, etc.
#
# ENVIRONMENT CONFIGURATION:
# Most configuration should be done via environment variables
# in the render.yaml file rather than in this Dockerfile.
#
# PERSISTENT DATA:
# This Dockerfile is designed to work with both PostgreSQL
# and persistent disk configurations. Data persistence is
# handled by Render's infrastructure.
#
# SECURITY:
# - Never include secrets or API keys in the Dockerfile
# - Use environment variables for sensitive configuration
# - The image runs as non-root user 'node' for security
#
# PERFORMANCE:
# - Keep the image size small by cleaning up after installations
# - Use multi-stage builds for complex applications
# - Pin package versions for reproducible builds
#
# DEBUGGING:
# To debug the container, you can override the entrypoint:
# docker run -it --entrypoint /bin/sh your-image-name
