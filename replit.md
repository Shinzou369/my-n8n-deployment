# n8n on Render Deployment Toolkit

## Overview

This repository provides a comprehensive toolkit for deploying and managing n8n (a workflow automation platform) on Render's cloud hosting platform. The project includes automated deployment scripts, configuration templates, monitoring tools, and detailed documentation to support both simple hobby deployments and production-grade setups.

**Latest Update (July 2025)**: Upgraded to n8n version 1.102.4 with new AI Agent Tools, built-in evaluations, Google Gemini integration, and enhanced security features.

## User Preferences

Preferred communication style: Simple, everyday language.

## Business Vision

**Ergovia TaskForce (ETF) Management Dashboard**: User plans to build an internal backend office for managing their n8n workflow automation business. The dashboard will:

1. **Template Management**: Manage pre-built n8n workflow templates ("Niche Agents") for different business verticals (Pet Clinic, Real Estate, etc.)
2. **Client Management**: Track and manage clients who receive customized workflow deployments
3. **Automated Deployment**: Core feature - automate the process of duplicating master templates, injecting client-specific data, and deploying customized workflows via n8n API
4. **Self-Service Control**: Eliminate dependency on n8n web interface for workflow management and client onboarding

**Business Model**: Each client gets their own customized copy of a template, running on user's server. This dashboard automates the manual, error-prone process of client onboarding and workflow customization.

## System Architecture

### Primary Deployment Strategies

The toolkit supports two main deployment approaches:

1. **PostgreSQL Database Strategy** (Recommended)
   - Uses a separate Render PostgreSQL service for data persistence
   - Enables zero-downtime deployments and horizontal scaling
   - Supports team collaboration through shared workflow data
   - Suitable for production environments

2. **Persistent Disk Strategy**
   - Uses SQLite database stored on attached persistent disk
   - Simpler single-service deployment
   - Limited to single instance scaling
   - More cost-effective for simple use cases

### Technology Stack

- **Container Runtime**: Docker with official n8nio/n8n:1.102.4 image
- **Database Options**: PostgreSQL (recommended) or SQLite
- **Infrastructure**: Render platform services
- **Configuration**: YAML-based render.yaml blueprints
- **Monitoring**: Python-based health check tools
- **API Management**: Custom Render API client for automation
- **New Features**: AI Agent Tools, Built-in Evaluations, Google Gemini node

## Key Components

### 1. Configuration Templates
- **render-postgres.yaml**: Blueprint for PostgreSQL-based deployment
- **render-disk.yaml**: Blueprint for persistent disk deployment
- Environment variable configurations for different scenarios

### 2. Deployment Automation
- **deploy.sh**: Main deployment script automating service creation
- **render-api.py**: Python client for Render API interactions
- Automated environment variable setup and service configuration

### 3. Monitoring and Health Checks
- **health-check.py**: Comprehensive monitoring tool with:
  - Service availability checking
  - Performance metric collection
  - Alert system integration
  - SQLite-based metrics storage

### 4. Documentation System
- **postgres-deployment-tutorial.md**: Step-by-step deployment guide
- **deployment-comparison.md**: Detailed strategy comparison
- **best-practices.md**: Production deployment guidelines
- **cost-estimation.md**: Cost planning and optimization
- **troubleshooting.md**: Common issue resolution

## Data Flow

### PostgreSQL Deployment Flow
1. Render PostgreSQL service stores all workflow data
2. n8n web service connects to database via environment variables
3. Multiple n8n instances can share the same database
4. Webhooks and executions persist across deployments
5. Health checks monitor both web service and database

### Persistent Disk Deployment Flow
1. SQLite database stored on mounted persistent disk
2. Single n8n instance with direct file system access
3. Workflow data persists through disk attachment
4. Simpler monitoring of single service endpoint

### Monitoring Data Flow
1. Health check tool queries service endpoints
2. Metrics stored in local SQLite database
3. Alert thresholds trigger notification systems
4. Performance data available for analysis and optimization

## External Dependencies

### Render Platform Services
- **Web Services**: Container hosting for n8n application
- **PostgreSQL Services**: Managed database instances
- **Persistent Disks**: Block storage for SQLite databases
- **Render API**: Service management and monitoring

### Third-Party Integrations
- **Docker Hub**: Official n8nio/n8n container images
- **GitHub**: Repository hosting and deployment triggers
- **SMTP Services**: Email notifications for monitoring alerts
- **n8n Cloud APIs**: Optional webhook and execution endpoints

### Python Dependencies
- **requests**: HTTP client for API interactions
- **psutil**: System performance monitoring
- **sqlite3**: Local metrics storage
- **PyYAML**: Configuration file parsing
- **smtplib**: Email notification support

## Deployment Strategy

### Automated Deployment Process
1. **Repository Setup**: Clone toolkit and configure environment
2. **Strategy Selection**: Choose PostgreSQL or persistent disk approach
3. **Configuration**: Copy appropriate render.yaml template
4. **Environment Variables**: Set required n8n and Render configurations
5. **Service Creation**: Use deploy.sh script or manual Render dashboard
6. **Health Verification**: Run monitoring tools to confirm deployment
7. **Production Setup**: Implement backup, monitoring, and maintenance procedures

### Environment Configuration
- **Required Variables**: WEBHOOK_URL, N8N_EDITOR_BASE_URL, database credentials
- **Optional Variables**: Authentication, SMTP, custom domains
- **Security Variables**: API keys, passwords stored as Render environment secrets

### Scaling Considerations
- **PostgreSQL Strategy**: Supports horizontal scaling with shared database
- **Persistent Disk Strategy**: Limited to vertical scaling of single instance
- **Resource Planning**: CPU and memory allocation based on workflow complexity
- **Cost Optimization**: Free tier limitations and paid plan benefits

### Backup and Recovery
- **PostgreSQL**: Automated Render database backups with point-in-time recovery
- **Persistent Disk**: Manual backup procedures for SQLite files
- **Workflow Export**: n8n's built-in workflow export/import capabilities
- **Disaster Recovery**: Documentation for service restoration procedures