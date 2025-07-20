#!/bin/bash
# Automated deployment script for n8n on Render
# This script automates the deployment process using Render API

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_DIR="$PROJECT_ROOT/config"

# Default values
DEPLOYMENT_TYPE="postgres"
SERVICE_NAME=""
RENDER_API_KEY=""
GITHUB_REPO=""
GITHUB_BRANCH="main"
RENDER_REGION="oregon"
SERVICE_PLAN="starter"
DATABASE_PLAN="starter"

# === UTILITY FUNCTIONS ===

print_header() {
    echo -e "\n${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

# === HELP FUNCTION ===
show_help() {
    cat << EOF
n8n Render Deployment Script

USAGE:
    ./deploy.sh [OPTIONS]

OPTIONS:
    -t, --type TYPE         Deployment type: postgres or disk (default: postgres)
    -n, --name NAME         Service name (required)
    -k, --api-key KEY       Render API key (required)
    -r, --repo REPO         GitHub repository URL (required)
    -b, --branch BRANCH     Git branch (default: main)
    --region REGION         Render region (default: oregon)
    --web-plan PLAN         Web service plan (default: starter)
    --db-plan PLAN          Database plan (default: starter)
    --dry-run               Show what would be deployed without actually deploying
    -h, --help              Show this help message

EXAMPLES:
    # Deploy with Postgres database
    ./deploy.sh -t postgres -n my-n8n -k \$RENDER_API_KEY -r https://github.com/user/repo

    # Deploy with persistent disk
    ./deploy.sh -t disk -n my-n8n-disk -k \$RENDER_API_KEY -r https://github.com/user/repo

    # Dry run to see what would be created
    ./deploy.sh -t postgres -n my-n8n -k \$RENDER_API_KEY -r https://github.com/user/repo --dry-run

ENVIRONMENT VARIABLES:
    RENDER_API_KEY          Render API key (alternative to --api-key)
    GITHUB_TOKEN            GitHub token for private repositories (optional)

NOTES:
    - API key can be obtained from https://dashboard.render.com/account/api-keys
    - Service name must be unique across Render
    - Repository must contain render.yaml file
    - Free plans available but not recommended for production

EOF
}

# === ARGUMENT PARSING ===
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            DEPLOYMENT_TYPE="$2"
            shift 2
            ;;
        -n|--name)
            SERVICE_NAME="$2"
            shift 2
            ;;
        -k|--api-key)
            RENDER_API_KEY="$2"
            shift 2
            ;;
        -r|--repo)
            GITHUB_REPO="$2"
            shift 2
            ;;
        -b|--branch)
            GITHUB_BRANCH="$2"
            shift 2
            ;;
        --region)
            RENDER_REGION="$2"
            shift 2
            ;;
        --web-plan)
            SERVICE_PLAN="$2"
            shift 2
            ;;
        --db-plan)
            DATABASE_PLAN="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# === VALIDATION ===
validate_requirements() {
    print_header "Validating Requirements"

    # Check required tools
    local missing_tools=()
    
    if ! command -v curl &> /dev/null; then
        missing_tools+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi

    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_info "Install with: sudo apt-get install curl jq"
        exit 1
    fi

    # Check required parameters
    if [ -z "$SERVICE_NAME" ]; then
        print_error "Service name is required. Use -n or --name"
        exit 1
    fi

    if [ -z "$RENDER_API_KEY" ]; then
        RENDER_API_KEY="${RENDER_API_KEY:-}"
        if [ -z "$RENDER_API_KEY" ]; then
            print_error "Render API key is required. Use -k or --api-key or set RENDER_API_KEY environment variable"
            exit 1
        fi
    fi

    if [ -z "$GITHUB_REPO" ]; then
        print_error "GitHub repository is required. Use -r or --repo"
        exit 1
    fi

    # Validate deployment type
    if [[ "$DEPLOYMENT_TYPE" != "postgres" && "$DEPLOYMENT_TYPE" != "disk" ]]; then
        print_error "Invalid deployment type: $DEPLOYMENT_TYPE. Must be 'postgres' or 'disk'"
        exit 1
    fi

    # Validate render.yaml exists
    local render_file="$CONFIG_DIR/render-${DEPLOYMENT_TYPE}.yaml"
    if [ ! -f "$render_file" ]; then
        print_error "Configuration file not found: $render_file"
        exit 1
    fi

    print_success "All requirements validated"
}

# === RENDER API FUNCTIONS ===
render_api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local response_file="/tmp/render_response.json"

    local curl_cmd="curl -s -X $method"
    curl_cmd+=" -H 'Authorization: Bearer $RENDER_API_KEY'"
    curl_cmd+=" -H 'Content-Type: application/json'"
    
    if [ -n "$data" ]; then
        curl_cmd+=" -d '$data'"
    fi
    
    curl_cmd+=" 'https://api.render.com/v1$endpoint'"
    curl_cmd+=" -o '$response_file'"
    curl_cmd+=" -w '%{http_code}'"

    local http_code
    http_code=$(eval "$curl_cmd")

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        cat "$response_file"
        return 0
    else
        print_error "API call failed with HTTP $http_code"
        if [ -f "$response_file" ]; then
            cat "$response_file" >&2
        fi
        return 1
    fi
}

# === DEPLOYMENT FUNCTIONS ===
create_postgres_database() {
    print_header "Creating PostgreSQL Database"

    local db_name="${SERVICE_NAME}-database"
    
    local db_data=$(cat << EOF
{
    "type": "pserv",
    "name": "$db_name",
    "env": "node",
    "plan": "$DATABASE_PLAN",
    "region": "$RENDER_REGION",
    "databases": [
        {
            "name": "n8n_db",
            "databaseName": "n8n",
            "user": "n8n_user"
        }
    ]
}
EOF
)

    if [ "$DRY_RUN" = true ]; then
        print_info "DRY RUN: Would create database with:"
        echo "$db_data" | jq .
        return 0
    fi

    local response
    if response=$(render_api_call "POST" "/services" "$db_data"); then
        local db_id
        db_id=$(echo "$response" | jq -r '.id')
        print_success "Database created with ID: $db_id"
        echo "$db_id" > "/tmp/n8n_db_id"
        
        # Wait for database to be ready
        print_info "Waiting for database to be ready..."
        wait_for_service_ready "$db_id"
    else
        print_error "Failed to create database"
        exit 1
    fi
}

create_web_service() {
    print_header "Creating n8n Web Service"

    local web_name="${SERVICE_NAME}-app"
    local image_url="docker.io/n8nio/n8n:1.54.0"
    
    # Prepare environment variables based on deployment type
    local env_vars
    if [ "$DEPLOYMENT_TYPE" = "postgres" ]; then
        local db_id
        if [ -f "/tmp/n8n_db_id" ]; then
            db_id=$(cat "/tmp/n8n_db_id")
        else
            print_error "Database ID not found. Create database first."
            exit 1
        fi
        
        env_vars=$(cat << 'EOF'
[
    {"key": "DB_TYPE", "value": "postgresdb"},
    {"key": "WEBHOOK_URL", "value": "https://SERVICE_NAME.onrender.com"},
    {"key": "N8N_EDITOR_BASE_URL", "value": "https://SERVICE_NAME.onrender.com"},
    {"key": "N8N_PROTOCOL", "value": "https"},
    {"key": "N8N_PORT", "value": "5000"},
    {"key": "N8N_LISTEN_ADDRESS", "value": "0.0.0.0"},
    {"key": "N8N_BASIC_AUTH_ACTIVE", "value": "true"},
    {"key": "EXECUTIONS_PROCESS", "value": "main"},
    {"key": "EXECUTIONS_MODE", "value": "regular"},
    {"key": "N8N_LOG_LEVEL", "value": "info"},
    {"key": "NODE_ENV", "value": "production"}
]
EOF
)
    else
        env_vars=$(cat << 'EOF'
[
    {"key": "WEBHOOK_URL", "value": "https://SERVICE_NAME.onrender.com"},
    {"key": "N8N_EDITOR_BASE_URL", "value": "https://SERVICE_NAME.onrender.com"},
    {"key": "N8N_PROTOCOL", "value": "https"},
    {"key": "N8N_PORT", "value": "5000"},
    {"key": "N8N_LISTEN_ADDRESS", "value": "0.0.0.0"},
    {"key": "N8N_USER_FOLDER", "value": "/home/node/.n8n"},
    {"key": "N8N_BASIC_AUTH_ACTIVE", "value": "true"},
    {"key": "EXECUTIONS_PROCESS", "value": "main"},
    {"key": "EXECUTIONS_MODE", "value": "regular"},
    {"key": "EXECUTIONS_DATA_PRUNE", "value": "true"},
    {"key": "EXECUTIONS_DATA_MAX_AGE", "value": "168"},
    {"key": "N8N_LOG_LEVEL", "value": "info"},
    {"key": "NODE_ENV", "value": "production"}
]
EOF
)
    fi

    # Replace SERVICE_NAME placeholder
    env_vars=$(echo "$env_vars" | sed "s/SERVICE_NAME/$web_name/g")

    local web_data=$(cat << EOF
{
    "type": "web",
    "name": "$web_name",
    "env": "docker",
    "plan": "$SERVICE_PLAN",
    "region": "$RENDER_REGION",
    "image": {
        "url": "$image_url"
    },
    "repo": "$GITHUB_REPO",
    "branch": "$GITHUB_BRANCH",
    "healthCheckPath": "/healthz",
    "autoDeploy": true,
    "envVars": $env_vars
}
EOF
)

    # Add disk configuration for disk deployment
    if [ "$DEPLOYMENT_TYPE" = "disk" ]; then
        web_data=$(echo "$web_data" | jq '. + {"disk": {"name": "n8n-data-disk", "mountPath": "/home/node/.n8n", "sizeGB": 1}}')
    fi

    if [ "$DRY_RUN" = true ]; then
        print_info "DRY RUN: Would create web service with:"
        echo "$web_data" | jq .
        return 0
    fi

    local response
    if response=$(render_api_call "POST" "/services" "$web_data"); then
        local web_id
        web_id=$(echo "$response" | jq -r '.id')
        print_success "Web service created with ID: $web_id"
        echo "$web_id" > "/tmp/n8n_web_id"
        
        # Get service URL
        local service_url
        service_url=$(echo "$response" | jq -r '.serviceDetails.url // empty')
        if [ -n "$service_url" ]; then
            print_success "Service URL: $service_url"
        fi
    else
        print_error "Failed to create web service"
        exit 1
    fi
}

wait_for_service_ready() {
    local service_id="$1"
    local max_wait=300  # 5 minutes
    local wait_time=0
    
    print_info "Waiting for service $service_id to be ready..."
    
    while [ $wait_time -lt $max_wait ]; do
        local response
        if response=$(render_api_call "GET" "/services/$service_id" ""); then
            local status
            status=$(echo "$response" | jq -r '.serviceDetails.status // .status')
            
            case "$status" in
                "running"|"live")
                    print_success "Service is ready!"
                    return 0
                    ;;
                "failed"|"error")
                    print_error "Service failed to start"
                    return 1
                    ;;
                *)
                    print_info "Service status: $status (waiting...)"
                    ;;
            esac
        fi
        
        sleep 10
        wait_time=$((wait_time + 10))
    done
    
    print_warning "Service did not become ready within $max_wait seconds"
    return 1
}

# === CONFIGURATION FUNCTIONS ===
update_environment_variables() {
    print_header "Updating Environment Variables"
    
    local web_id
    if [ -f "/tmp/n8n_web_id" ]; then
        web_id=$(cat "/tmp/n8n_web_id")
    else
        print_error "Web service ID not found"
        return 1
    fi

    print_info "Setting up authentication and encryption..."
    
    # Generate secure values
    local auth_password
    local encryption_key
    auth_password=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-16)
    encryption_key=$(openssl rand -hex 32)

    # Set sensitive environment variables
    local env_updates='[
        {"key": "N8N_BASIC_AUTH_USER", "value": "admin"},
        {"key": "N8N_BASIC_AUTH_PASSWORD", "value": "'$auth_password'"},
        {"key": "N8N_ENCRYPTION_KEY", "value": "'$encryption_key'"}
    ]'

    if [ "$DRY_RUN" = true ]; then
        print_info "DRY RUN: Would set environment variables"
        print_info "Auth User: admin"
        print_info "Auth Password: [generated]"
        print_info "Encryption Key: [generated]"
        return 0
    fi

    # Update environment variables
    for env_var in $(echo "$env_updates" | jq -r '.[] | @base64'); do
        local decoded
        decoded=$(echo "$env_var" | base64 --decode)
        local key
        local value
        key=$(echo "$decoded" | jq -r '.key')
        value=$(echo "$decoded" | jq -r '.value')
        
        local update_data='{"key": "'$key'", "value": "'$value'"}'
        
        if render_api_call "PUT" "/services/$web_id/env-vars/$key" "$update_data" > /dev/null; then
            print_success "Set $key"
        else
            print_warning "Failed to set $key"
        fi
    done

    # Save credentials for user
    cat > "/tmp/n8n_credentials.txt" << EOF
n8n Deployment Credentials
==========================

Service URL: https://${SERVICE_NAME}-app.onrender.com
Username: admin
Password: $auth_password

IMPORTANT: Save these credentials securely!
The password cannot be recovered from Render.

Encryption Key: $encryption_key
(Keep this secret and secure - needed for credential encryption)
EOF

    print_success "Credentials saved to /tmp/n8n_credentials.txt"
}

# === MAIN DEPLOYMENT FUNCTION ===
deploy_n8n() {
    print_header "Starting n8n Deployment"
    
    print_info "Deployment Configuration:"
    print_info "  Type: $DEPLOYMENT_TYPE"
    print_info "  Service Name: $SERVICE_NAME"
    print_info "  Repository: $GITHUB_REPO"
    print_info "  Branch: $GITHUB_BRANCH"
    print_info "  Region: $RENDER_REGION"
    print_info "  Web Plan: $SERVICE_PLAN"
    if [ "$DEPLOYMENT_TYPE" = "postgres" ]; then
        print_info "  Database Plan: $DATABASE_PLAN"
    fi

    if [ "$DRY_RUN" = true ]; then
        print_warning "DRY RUN MODE - No actual deployment will occur"
    fi

    # Create services based on deployment type
    if [ "$DEPLOYMENT_TYPE" = "postgres" ]; then
        create_postgres_database
    fi
    
    create_web_service
    update_environment_variables

    print_header "Deployment Summary"
    
    if [ "$DRY_RUN" = true ]; then
        print_success "DRY RUN completed successfully"
        print_info "Review the configuration above and run without --dry-run to deploy"
    else
        print_success "n8n deployment completed successfully!"
        print_info "Service URL: https://${SERVICE_NAME}-app.onrender.com"
        print_info "Credentials saved to: /tmp/n8n_credentials.txt"
        print_warning "Please save your credentials securely!"
        
        if [ -f "/tmp/n8n_web_id" ]; then
            local web_id
            web_id=$(cat "/tmp/n8n_web_id")
            print_info "Monitor deployment progress at: https://dashboard.render.com/web/$web_id"
        fi
    fi
}

# === CLEANUP ===
cleanup() {
    rm -f /tmp/n8n_*
    rm -f /tmp/render_response.json
}

trap cleanup EXIT

# === MAIN EXECUTION ===
print_header "n8n Render Deployment Tool"

validate_requirements
deploy_n8n

print_success "Script completed successfully!"
