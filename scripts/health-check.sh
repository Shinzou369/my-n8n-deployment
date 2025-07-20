#!/bin/bash
# Health check script for n8n
# This script is used by Docker's HEALTHCHECK instruction

set -e

# Configuration
HEALTH_URL="http://localhost:${N8N_PORT:-5000}/healthz"
TIMEOUT=5
LOG_FILE="/tmp/n8n-health.log"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [HEALTH] $1" | tee -a "$LOG_FILE"
}

# === BASIC CONNECTIVITY CHECK ===
log "Starting health check..."

# Check if n8n port is responding
if ! curl -f -s --connect-timeout $TIMEOUT "$HEALTH_URL" > /dev/null 2>&1; then
    log "❌ Health check failed: n8n not responding on $HEALTH_URL"
    exit 1
fi

log "✅ Basic connectivity check passed"

# === DETAILED HEALTH CHECKS ===

# Check if we can get a response from the main endpoint
MAIN_URL="http://localhost:${N8N_PORT:-5000}/"
if ! curl -f -s --connect-timeout $TIMEOUT "$MAIN_URL" > /dev/null 2>&1; then
    log "⚠️ Warning: Main endpoint not responding, but health endpoint is OK"
    # Don't fail here as health endpoint is more reliable
fi

# === DATABASE CONNECTION CHECK ===
if [ "$DB_TYPE" = "postgresdb" ]; then
    # For PostgreSQL, we can't easily check connection without n8n CLI
    # The health endpoint should cover this
    log "✅ Database check delegated to health endpoint"
elif [ "$DB_TYPE" = "sqlite" ] || [ -z "$DB_TYPE" ]; then
    # For SQLite, check if database file exists and is accessible
    DB_FILE="${DB_SQLITE_DATABASE:-/home/node/.n8n/database.sqlite}"
    if [ -f "$DB_FILE" ] && [ -r "$DB_FILE" ]; then
        log "✅ SQLite database file accessible"
    else
        log "⚠️ Warning: SQLite database file not found or not readable: $DB_FILE"
        # Don't fail as it might be first startup
    fi
fi

# === MEMORY CHECK ===
if command -v free > /dev/null 2>&1; then
    MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    log "📊 Memory usage: ${MEMORY_USAGE}%"
    
    if [ "$MEMORY_USAGE" -gt 90 ]; then
        log "⚠️ Warning: High memory usage detected: ${MEMORY_USAGE}%"
        # Don't fail on high memory, just warn
    fi
fi

# === DISK SPACE CHECK ===
if [ -n "$N8N_USER_FOLDER" ] && [ -d "$N8N_USER_FOLDER" ]; then
    DISK_USAGE=$(df "$N8N_USER_FOLDER" | tail -1 | awk '{print $5}' | sed 's/%//')
    log "💾 Disk usage: ${DISK_USAGE}%"
    
    if [ "$DISK_USAGE" -gt 90 ]; then
        log "⚠️ Warning: High disk usage detected: ${DISK_USAGE}%"
        # Don't fail on high disk usage, just warn
    fi
fi

# === PROCESS CHECK ===
if command -v pgrep > /dev/null 2>&1; then
    if pgrep -f "n8n" > /dev/null; then
        log "✅ n8n process is running"
    else
        log "❌ n8n process not found"
        exit 1
    fi
fi

# === RESPONSE TIME CHECK ===
START_TIME=$(date +%s%N)
if curl -f -s --connect-timeout $TIMEOUT "$HEALTH_URL" > /dev/null 2>&1; then
    END_TIME=$(date +%s%N)
    RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 )) # Convert to milliseconds
    log "⚡ Response time: ${RESPONSE_TIME}ms"
    
    if [ "$RESPONSE_TIME" -gt 5000 ]; then # 5 seconds
        log "⚠️ Warning: Slow response time detected: ${RESPONSE_TIME}ms"
        # Don't fail on slow response, just warn
    fi
fi

# === CLEANUP OLD LOGS ===
# Keep only last 100 lines of log file
if [ -f "$LOG_FILE" ]; then
    tail -n 100 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

log "✅ Health check completed successfully"
exit 0
