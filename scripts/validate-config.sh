#!/bin/bash
# Configuration validation script for n8n Render deployments
# Validates render.yaml files and environment variable configurations

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
CONFIG_FILE=""
DEPLOYMENT_TYPE=""
VERBOSE=false
CHECK_SECRETS=false

# === UTILITY FUNCTIONS ===

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

print_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}🔍 $1${NC}"
    fi
}

# === HELP FUNCTION ===
show_help() {
    cat << EOF
n8n Render Configuration Validator

USAGE:
    ./validate-config.sh [OPTIONS] [CONFIG_FILE]

OPTIONS:
    -t, --type TYPE         Deployment type: postgres or disk
    -v, --verbose           Enable verbose output
    -s, --check-secrets     Check for required secrets/environment variables
    -h, --help              Show this help message

ARGUMENTS:
    CONFIG_FILE             Path to render.yaml file (optional, will auto-detect)

EXAMPLES:
    # Validate postgres configuration
    ./validate-config.sh -t postgres

    # Validate specific file
    ./validate-config.sh config/render-postgres.yaml

    # Verbose validation with secret checking
    ./validate-config.sh -t disk -v -s

VALIDATION CHECKS:
    - YAML syntax validation
    - Required service configurations
    - Environment variable completeness
    - Resource allocation consistency
    - Security configuration validation
    - Deployment-specific requirements

EOF
}

# === ARGUMENT PARSING ===
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            DEPLOYMENT_TYPE="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -s|--check-secrets)
            CHECK_SECRETS=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -*)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            CONFIG_FILE="$1"
            shift
            ;;
    esac
done

# === VALIDATION FUNCTIONS ===

check_dependencies() {
    print_verbose "Checking dependencies..."
    
    local missing_tools=()
    
    if ! command -v yq &> /dev/null && ! command -v python3 &> /dev/null; then
        missing_tools+=("yq or python3")
    fi

    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_info "Install with: sudo apt-get install yq python3-yaml"
        return 1
    fi
    
    print_verbose "Dependencies check passed"
    return 0
}

determine_config_file() {
    if [ -n "$CONFIG_FILE" ]; then
        if [ ! -f "$CONFIG_FILE" ]; then
            print_error "Configuration file not found: $CONFIG_FILE"
            return 1
        fi
        print_verbose "Using specified config file: $CONFIG_FILE"
        return 0
    fi

    if [ -n "$DEPLOYMENT_TYPE" ]; then
        CONFIG_FILE="$CONFIG_DIR/render-${DEPLOYMENT_TYPE}.yaml"
        if [ ! -f "$CONFIG_FILE" ]; then
            print_error "Configuration file not found: $CONFIG_FILE"
            return 1
        fi
        print_verbose "Using deployment type config: $CONFIG_FILE"
        return 0
    fi

    # Try to auto-detect
    if [ -f "render.yaml" ]; then
        CONFIG_FILE="render.yaml"
        print_verbose "Auto-detected config file: render.yaml"
        return 0
    fi

    if [ -f "$CONFIG_DIR/render-postgres.yaml" ]; then
        CONFIG_FILE="$CONFIG_DIR/render-postgres.yaml"
        DEPLOYMENT_TYPE="postgres"
        print_verbose "Auto-detected postgres config"
        return 0
    fi

    print_error "No configuration file found. Specify with -t or provide file path."
    return 1
}

validate_yaml_syntax() {
    print_verbose "Validating YAML syntax..."
    
    if command -v yq &> /dev/null; then
        if ! yq eval '.' "$CONFIG_FILE" > /dev/null 2>&1; then
            print_error "Invalid YAML syntax in $CONFIG_FILE"
            return 1
        fi
    elif command -v python3 &> /dev/null; then
        if ! python3 -c "import yaml; yaml.safe_load(open('$CONFIG_FILE'))" 2>/dev/null; then
            print_error "Invalid YAML syntax in $CONFIG_FILE"
            return 1
        fi
    else
        print_warning "Cannot validate YAML syntax - no YAML parser available"
        return 0
    fi
    
    print_success "YAML syntax is valid"
    return 0
}

extract_yaml_value() {
    local path="$1"
    local default="$2"
    
    if command -v yq &> /dev/null; then
        yq eval "$path // \"$default\"" "$CONFIG_FILE" 2>/dev/null
    elif command -v python3 &> /dev/null; then
        python3 -c "
import yaml, sys
try:
    with open('$CONFIG_FILE') as f:
        data = yaml.safe_load(f)
    
    # Navigate through the path
    current = data
    for key in '$path'.split('.'):
        if key.startswith('[') and key.endswith(']'):
            # Array index
            index = int(key[1:-1])
            current = current[index] if isinstance(current, list) and len(current) > index else None
        else:
            current = current.get(key) if isinstance(current, dict) else None
        if current is None:
            break
    
    print(current if current is not None else '$default')
except:
    print('$default')
" 2>/dev/null
    else
        echo "$default"
    fi
}

validate_service_structure() {
    print_verbose "Validating service structure..."
    
    # Check if services array exists
    local services_count
    services_count=$(extract_yaml_value "services | length" "0")
    
    if [ "$services_count" = "0" ]; then
        print_error "No services defined in configuration"
        return 1
    fi
    
    print_verbose "Found $services_count service(s)"
    
    # Validate each service
    local i=0
    while [ $i -lt "$services_count" ]; do
        validate_service_at_index $i
        i=$((i + 1))
    done
    
    print_success "Service structure validation passed"
    return 0
}

validate_service_at_index() {
    local index="$1"
    local service_name
    local service_type
    local service_plan
    
    service_name=$(extract_yaml_value "services[$index].name" "")
    service_type=$(extract_yaml_value "services[$index].type" "")
    service_plan=$(extract_yaml_value "services[$index].plan" "")
    
    print_verbose "Validating service $((index + 1)): $service_name ($service_type)"
    
    # Check required fields
    if [ -z "$service_name" ]; then
        print_error "Service $((index + 1)): Missing name"
        return 1
    fi
    
    if [ -z "$service_type" ]; then
        print_error "Service $service_name: Missing type"
        return 1
    fi
    
    if [ -z "$service_plan" ]; then
        print_warning "Service $service_name: Missing plan (will use default)"
    fi
    
    # Validate service type specific requirements
    case "$service_type" in
        "web")
            validate_web_service $index
            ;;
        "pserv")
            validate_database_service $index
            ;;
        *)
            print_warning "Service $service_name: Unknown service type '$service_type'"
            ;;
    esac
}

validate_web_service() {
    local index="$1"
    local service_name
    local image_url
    local env_vars_count
    
    service_name=$(extract_yaml_value "services[$index].name" "")
    image_url=$(extract_yaml_value "services[$index].image.url" "")
    env_vars_count=$(extract_yaml_value "services[$index].envVars | length" "0")
    
    print_verbose "Validating web service: $service_name"
    
    # Check image configuration
    if [ -z "$image_url" ]; then
        print_warning "Service $service_name: No image URL specified"
    else
        print_verbose "Image URL: $image_url"
        
        # Validate n8n image
        if [[ "$image_url" == *"n8nio/n8n"* ]]; then
            print_verbose "Using official n8n image"
        else
            print_warning "Service $service_name: Not using official n8n image"
        fi
    fi
    
    # Check environment variables
    if [ "$env_vars_count" = "0" ]; then
        print_warning "Service $service_name: No environment variables defined"
    else
        print_verbose "Found $env_vars_count environment variables"
        validate_environment_variables $index
    fi
    
    # Check for disk configuration if disk deployment
    local disk_mount
    disk_mount=$(extract_yaml_value "services[$index].disk.mountPath" "")
    if [ -n "$disk_mount" ]; then
        print_verbose "Persistent disk configured: $disk_mount"
        validate_disk_configuration $index
    fi
    
    # Check health check
    local health_path
    health_path=$(extract_yaml_value "services[$index].healthCheckPath" "")
    if [ -z "$health_path" ]; then
        print_warning "Service $service_name: No health check path defined"
    else
        print_verbose "Health check path: $health_path"
    fi
}

validate_database_service() {
    local index="$1"
    local service_name
    local databases_count
    
    service_name=$(extract_yaml_value "services[$index].name" "")
    databases_count=$(extract_yaml_value "services[$index].databases | length" "0")
    
    print_verbose "Validating database service: $service_name"
    
    if [ "$databases_count" = "0" ]; then
        print_error "Service $service_name: No databases defined"
        return 1
    fi
    
    print_verbose "Found $databases_count database(s)"
    
    # Validate database configuration
    local db_name
    local db_user
    db_name=$(extract_yaml_value "services[$index].databases[0].databaseName" "")
    db_user=$(extract_yaml_value "services[$index].databases[0].user" "")
    
    if [ -z "$db_name" ]; then
        print_warning "Service $service_name: Database name not specified"
    fi
    
    if [ -z "$db_user" ]; then
        print_warning "Service $service_name: Database user not specified"
    fi
}

validate_environment_variables() {
    local index="$1"
    local service_name
    service_name=$(extract_yaml_value "services[$index].name" "")
    
    print_verbose "Validating environment variables for $service_name"
    
    # Required environment variables for n8n
    local required_vars=(
        "WEBHOOK_URL"
        "N8N_EDITOR_BASE_URL"
        "N8N_PORT"
        "N8N_LISTEN_ADDRESS"
    )
    
    # Security-related variables
    local security_vars=(
        "N8N_BASIC_AUTH_ACTIVE"
        "N8N_BASIC_AUTH_USER"
        "N8N_BASIC_AUTH_PASSWORD"
        "N8N_ENCRYPTION_KEY"
    )
    
    # Check required variables
    for var in "${required_vars[@]}"; do
        if ! check_env_var_exists $index "$var"; then
            print_error "Service $service_name: Missing required environment variable: $var"
        else
            print_verbose "Found required variable: $var"
        fi
    done
    
    # Check security variables
    local auth_active
    auth_active=$(get_env_var_value $index "N8N_BASIC_AUTH_ACTIVE")
    
    if [ "$auth_active" = "true" ]; then
        print_verbose "Basic authentication is enabled"
        for var in "${security_vars[@]}"; do
            if ! check_env_var_exists $index "$var"; then
                if [ "$var" = "N8N_BASIC_AUTH_ACTIVE" ]; then
                    continue  # Already checked
                fi
                print_warning "Service $service_name: Missing security variable: $var"
            fi
        done
    else
        print_warning "Service $service_name: Basic authentication is disabled"
    fi
    
    # Check database configuration
    local db_type
    db_type=$(get_env_var_value $index "DB_TYPE")
    
    if [ "$db_type" = "postgresdb" ]; then
        print_verbose "PostgreSQL configuration detected"
        # Database variables are typically populated automatically
    else
        print_verbose "SQLite configuration (default)"
    fi
}

check_env_var_exists() {
    local index="$1"
    local var_name="$2"
    
    # This is a simplified check - in a real implementation, you'd parse the envVars array
    local env_vars_yaml
    if command -v yq &> /dev/null; then
        env_vars_yaml=$(yq eval ".services[$index].envVars[] | select(.key == \"$var_name\")" "$CONFIG_FILE" 2>/dev/null)
    fi
    
    [ -n "$env_vars_yaml" ]
}

get_env_var_value() {
    local index="$1"
    local var_name="$2"
    
    if command -v yq &> /dev/null; then
        yq eval ".services[$index].envVars[] | select(.key == \"$var_name\") | .value" "$CONFIG_FILE" 2>/dev/null || echo ""
    else
        echo ""
    fi
}

validate_disk_configuration() {
    local index="$1"
    local service_name
    local disk_size
    local mount_path
    
    service_name=$(extract_yaml_value "services[$index].name" "")
    disk_size=$(extract_yaml_value "services[$index].disk.sizeGB" "0")
    mount_path=$(extract_yaml_value "services[$index].disk.mountPath" "")
    
    print_verbose "Validating disk configuration for $service_name"
    
    if [ "$disk_size" = "0" ]; then
        print_error "Service $service_name: Disk size not specified"
        return 1
    fi
    
    if [ -z "$mount_path" ]; then
        print_error "Service $service_name: Disk mount path not specified"
        return 1
    fi
    
    # Check if mount path is appropriate for n8n
    if [[ "$mount_path" != "/home/node/.n8n"* ]]; then
        print_warning "Service $service_name: Mount path '$mount_path' may not be optimal for n8n"
    fi
    
    print_verbose "Disk configuration: ${disk_size}GB at $mount_path"
}

validate_security_configuration() {
    print_verbose "Validating security configuration..."
    
    local security_issues=0
    
    # Check for hardcoded secrets in the config
    if grep -q "password.*:" "$CONFIG_FILE" 2>/dev/null; then
        print_warning "Potential hardcoded passwords found in configuration"
        security_issues=$((security_issues + 1))
    fi
    
    if grep -q "key.*:" "$CONFIG_FILE" 2>/dev/null; then
        if grep -qE "N8N_ENCRYPTION_KEY.*value.*[a-f0-9]{64}" "$CONFIG_FILE" 2>/dev/null; then
            print_error "Hardcoded encryption key found in configuration file!"
            security_issues=$((security_issues + 1))
        fi
    fi
    
    # Check for sync: false on sensitive variables
    local sensitive_vars=("N8N_BASIC_AUTH_PASSWORD" "N8N_ENCRYPTION_KEY" "N8N_BASIC_AUTH_USER")
    for var in "${sensitive_vars[@]}"; do
        if grep -A2 -B2 "$var" "$CONFIG_FILE" | grep -q "sync: false"; then
            print_verbose "Good: $var is marked as sync: false"
        else
            print_warning "Consider marking $var with 'sync: false' for security"
        fi
    done
    
    if [ $security_issues -eq 0 ]; then
        print_success "Security configuration validation passed"
    else
        print_error "Found $security_issues security issues"
        return 1
    fi
    
    return 0
}

validate_deployment_consistency() {
    print_verbose "Validating deployment consistency..."
    
    # Detect deployment type from configuration
    local detected_type=""
    
    # Check for database service
    if grep -q "type: pserv" "$CONFIG_FILE"; then
        detected_type="postgres"
    fi
    
    # Check for disk configuration
    if grep -q "disk:" "$CONFIG_FILE"; then
        if [ -n "$detected_type" ]; then
            print_warning "Configuration contains both database service and disk configuration"
        else
            detected_type="disk"
        fi
    fi
    
    # Check for SQLite-specific environment variables
    if grep -q "DB_SQLITE" "$CONFIG_FILE"; then
        if [ "$detected_type" = "postgres" ]; then
            print_warning "PostgreSQL deployment with SQLite configuration detected"
        fi
    fi
    
    # Check for PostgreSQL-specific environment variables
    if grep -q "DB_POSTGRESDB" "$CONFIG_FILE"; then
        if [ "$detected_type" = "disk" ]; then
            print_warning "Disk deployment with PostgreSQL configuration detected"
        fi
    fi
    
    if [ -n "$DEPLOYMENT_TYPE" ] && [ "$DEPLOYMENT_TYPE" != "$detected_type" ]; then
        print_warning "Specified deployment type ($DEPLOYMENT_TYPE) doesn't match detected type ($detected_type)"
    fi
    
    print_verbose "Detected deployment type: ${detected_type:-unknown}"
    print_success "Deployment consistency validation completed"
}

check_secrets_and_environment() {
    if [ "$CHECK_SECRETS" != true ]; then
        return 0
    fi
    
    print_verbose "Checking secrets and environment variables..."
    
    # Check if required environment variables are set
    local missing_secrets=()
    
    # These would typically be set in Render dashboard
    local expected_secrets=(
        "N8N_BASIC_AUTH_USER"
        "N8N_BASIC_AUTH_PASSWORD"
        "N8N_ENCRYPTION_KEY"
    )
    
    for secret in "${expected_secrets[@]}"; do
        if [ -z "${!secret}" ]; then
            missing_secrets+=("$secret")
        fi
    done
    
    if [ ${#missing_secrets[@]} -gt 0 ]; then
        print_warning "Missing environment variables (should be set in Render dashboard):"
        for secret in "${missing_secrets[@]}"; do
            print_warning "  - $secret"
        done
    else
        print_success "All expected secrets are available"
    fi
}

generate_validation_report() {
    local config_file="$1"
    local deployment_type="$2"
    
    cat << EOF

=======================================
n8n Render Configuration Validation Report
=======================================

Configuration File: $config_file
Deployment Type: ${deployment_type:-auto-detected}
Validation Time: $(date)

Summary:
- Configuration file exists and is readable
- YAML syntax validation: $(validate_yaml_syntax > /dev/null 2>&1 && echo "PASSED" || echo "FAILED")
- Service structure validation: $(validate_service_structure > /dev/null 2>&1 && echo "PASSED" || echo "FAILED")
- Security configuration: $(validate_security_configuration > /dev/null 2>&1 && echo "PASSED" || echo "FAILED")
- Deployment consistency: $(validate_deployment_consistency > /dev/null 2>&1 && echo "PASSED" || echo "FAILED")

Next Steps:
1. Review any warnings or errors above
2. Set required environment variables in Render dashboard
3. Test deployment with: ./scripts/deploy.sh --dry-run
4. Deploy with: ./scripts/deploy.sh

EOF
}

# === MAIN VALIDATION FUNCTION ===
main() {
    echo "🔍 n8n Render Configuration Validator"
    echo "======================================"
    
    # Check dependencies
    if ! check_dependencies; then
        exit 1
    fi
    
    # Determine configuration file
    if ! determine_config_file; then
        exit 1
    fi
    
    print_info "Validating configuration: $CONFIG_FILE"
    
    # Run validation checks
    local validation_passed=true
    
    if ! validate_yaml_syntax; then
        validation_passed=false
    fi
    
    if ! validate_service_structure; then
        validation_passed=false
    fi
    
    if ! validate_security_configuration; then
        validation_passed=false
    fi
    
    if ! validate_deployment_consistency; then
        validation_passed=false
    fi
    
    # Check secrets if requested
    check_secrets_and_environment
    
    # Generate report
    if [ "$VERBOSE" = true ]; then
        generate_validation_report "$CONFIG_FILE" "$DEPLOYMENT_TYPE"
    fi
    
    # Final result
    if [ "$validation_passed" = true ]; then
        print_success "Configuration validation completed successfully!"
        exit 0
    else
        print_error "Configuration validation failed. Please review the errors above."
        exit 1
    fi
}

# Run main function
main "$@"
