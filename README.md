# n8n on Render Deployment Toolkit

A comprehensive toolkit for self-hosting n8n on Render with automated deployment, configuration templates, and detailed documentation.

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

## Directory Structure

