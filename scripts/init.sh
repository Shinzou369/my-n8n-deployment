#!/bin/bash
# Custom initialization script for n8n
# This script runs before n8n starts and can be used for setup tasks

set -e

echo "🚀 Initializing custom n8n deployment..."

# === DIRECTORY SETUP ===
echo "📁 Setting up directories..."

# Ensure n8n data directory exists
mkdir -p /home/node/.n8n
mkdir -p /home/node/.n8n/nodes
mkdir -p /home/node/.n8n/custom

# === CUSTOM NODE INSTALLATION ===
echo "🔧 Installing custom nodes..."

# Example: Install community nodes if they don't exist
# Uncomment and modify as needed
# if [ ! -d "/home/node/.n8n/node_modules/n8n-nodes-salesforce" ]; then
#     npm install n8n-nodes-salesforce
# fi

# === CONFIGURATION SETUP ===
echo "⚙️ Setting up configuration..."

# Create default config if it doesn't exist
if [ ! -f "/home/node/.n8n/config.json" ]; then
    cat > /home/node/.n8n/config.json << 'EOF'
{
  "database": {
    "type": "sqlite",
    "tablePrefix": "",
    "sqlite": {
      "database": "/home/node/.n8n/database.sqlite"
    }
  },
  "endpoints": {
    "rest": "rest",
    "webhook": "webhook",
    "webhookWaiting": "webhook-waiting",
    "webhookTest": "webhook-test"
  },
  "defaultTimezone": "UTC",
  "personalization": {
    "enabled": false
  }
}
EOF
    echo "✅ Created default config.json"
fi

# === CREDENTIALS TEMPLATE ===
echo "🔐 Setting up credentials template..."

# Create credentials template if needed
if [ ! -f "/home/node/.n8n/credentials.json" ] && [ -f "/tmp/credentials-template.json" ]; then
    cp /tmp/credentials-template.json /home/node/.n8n/credentials.json
    echo "✅ Created credentials template"
fi

# === DATABASE INITIALIZATION ===
echo "🗄️ Checking database setup..."

# For SQLite deployments, ensure database directory exists
if [ "$DB_TYPE" = "sqlite" ] || [ -z "$DB_TYPE" ]; then
    mkdir -p "$(dirname "${DB_SQLITE_DATABASE:-/home/node/.n8n/database.sqlite}")"
    echo "✅ SQLite database directory ready"
fi

# For PostgreSQL deployments, wait for database to be ready
if [ "$DB_TYPE" = "postgresdb" ]; then
    echo "⏳ Waiting for PostgreSQL database..."
    timeout=60
    counter=0
    while [ $counter -lt $timeout ]; do
        if n8n db:check 2>/dev/null; then
            echo "✅ PostgreSQL database is ready"
            break
        fi
        echo "⏳ Database not ready yet, waiting... ($counter/$timeout)"
        sleep 2
        counter=$((counter + 2))
    done
    
    if [ $counter -ge $timeout ]; then
        echo "❌ Database connection timeout"
        exit 1
    fi
fi

# === CUSTOM WORKFLOWS ===
echo "📋 Setting up workflows..."

# Import default workflows if they exist
if [ -d "/tmp/workflows" ]; then
    for workflow in /tmp/workflows/*.json; do
        if [ -f "$workflow" ]; then
            echo "📥 Importing workflow: $(basename "$workflow")"
            # Note: Workflow import would need to be done via n8n CLI or API
            # This is just a placeholder for the concept
        fi
    done
fi

# === PERMISSIONS ===
echo "🔒 Setting up permissions..."

# Ensure proper ownership (may be redundant but safe)
chown -R node:node /home/node/.n8n 2>/dev/null || true

# === ENVIRONMENT VALIDATION ===
echo "✅ Validating environment..."

# Check required environment variables
required_vars=()

if [ "$N8N_BASIC_AUTH_ACTIVE" = "true" ]; then
    required_vars+=("N8N_BASIC_AUTH_USER" "N8N_BASIC_AUTH_PASSWORD")
fi

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required environment variable $var is not set"
        exit 1
    fi
done

# Validate encryption key if set
if [ -n "$N8N_ENCRYPTION_KEY" ]; then
    if [ ${#N8N_ENCRYPTION_KEY} -ne 64 ]; then
        echo "❌ N8N_ENCRYPTION_KEY must be exactly 64 characters (32 bytes in hex)"
        exit 1
    fi
    echo "✅ Encryption key validation passed"
fi

# === WEBHOOK URL VALIDATION ===
if [ -n "$WEBHOOK_URL" ] && [ -n "$N8N_EDITOR_BASE_URL" ]; then
    if [ "$WEBHOOK_URL" != "$N8N_EDITOR_BASE_URL" ]; then
        echo "⚠️ Warning: WEBHOOK_URL and N8N_EDITOR_BASE_URL are different"
        echo "   WEBHOOK_URL: $WEBHOOK_URL"
        echo "   N8N_EDITOR_BASE_URL: $N8N_EDITOR_BASE_URL"
    fi
fi

# === HEALTH CHECK PREPARATION ===
echo "🏥 Preparing health checks..."

# Create health check log file
touch /tmp/n8n-health.log
chown node:node /tmp/n8n-health.log 2>/dev/null || true

# === CUSTOM INITIALIZATION ===
echo "🎨 Running custom initialization..."

# Run any custom initialization scripts
if [ -d "/home/node/.n8n/init.d" ]; then
    for script in /home/node/.n8n/init.d/*.sh; do
        if [ -x "$script" ]; then
            echo "🔧 Running custom script: $(basename "$script")"
            "$script"
        fi
    done
fi

# === COMPLETION ===
echo "🎉 Initialization complete!"
echo ""
echo "Environment Summary:"
echo "  Node Version: $(node --version)"
echo "  NPM Version: $(npm --version)"
echo "  N8N Version: $(n8n --version 2>/dev/null || echo 'Unknown')"
echo "  Database Type: ${DB_TYPE:-sqlite}"
echo "  Auth Enabled: ${N8N_BASIC_AUTH_ACTIVE:-false}"
echo "  Data Directory: ${N8N_USER_FOLDER:-/home/node/.n8n}"
echo ""
echo "🚀 Ready to start n8n..."
