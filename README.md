# n8n on Render Deployment Toolkit

A comprehensive toolkit for self-hosting n8n on Render with automated deployment, configuration templates, and detailed documentation.

**🚀 Latest Update**: Now using **n8n v1.102.4** (July 2025) with new AI Agent Tools, built-in evaluations, and enhanced security features.

## Overview

This toolkit provides everything you need to deploy and manage n8n on Render, including:

- **Configuration Templates**: Ready-to-use `render.yaml` files for different deployment strategies
- **Automated Deployment**: Scripts to automate the entire deployment process
- **Comprehensive Documentation**: Step-by-step tutorials and best practices
- **Monitoring Tools**: Health check and monitoring utilities
- **Cost Estimation**: Guidelines for estimating monthly costs

## Quick Start

1. **Choose Your Deployment Strategy**:
   - **Postgres Database** (Recommended): Better for scaling and zero-downtime deploys
   - **Persistent Disk**: Simpler setup but limited scaling

2. **Use the Configuration Templates**:
   ```bash
   # For Postgres deployment
   cp config/render-postgres.yaml render.yaml
   
   # For Persistent Disk deployment
   cp config/render-disk.yaml render.yaml
   ```

3. **Deploy Using Automation Script**:
   ```bash
   ./scripts/deploy.sh
   ```

4. **Follow the Tutorial**:
   See [Postgres Deployment Tutorial](docs/postgres-deployment-tutorial.md) for detailed steps.

## Version Information

- **n8n Version**: 1.102.4 (latest stable - July 2025)
- **New Features**: AI Agent Tools, Built-in Evaluations, Google Gemini integration
- **Compatibility**: Fully backward compatible with existing workflows
- **Security**: Enhanced with 2FA support and improved webhook sandboxing

## Directory Structure

