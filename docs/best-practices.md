# n8n on Render Best Practices

This document outlines production-ready best practices for deploying, managing, and maintaining n8n on Render.

## Table of Contents

1. [Production Deployment](#production-deployment)
2. [Security Best Practices](#security-best-practices)
3. [Performance Optimization](#performance-optimization)
4. [Monitoring and Alerting](#monitoring-and-alerting)
5. [Backup and Recovery](#backup-and-recovery)
6. [Cost Optimization](#cost-optimization)
7. [Workflow Management](#workflow-management)
8. [Team Collaboration](#team-collaboration)

## Production Deployment

### 1. Use Appropriate Service Plans

**Recommended Plans for Production:**

```yaml
# render.yaml for production
services:
  # Database - Starter plan minimum
  - type: pserv
    name: n8n-database
    plan: starter  # $7/month - always-on, backups
    databases:
      - name: n8n_db
        databaseName: n8n
        user: n8n_user

  # Web Service - Starter plan minimum  
  - type: web
    name: n8n-app
    plan: starter  # $7/month - no sleeping, custom domains
    image:
      url: docker.io/n8nio/n8n:1.54.0  # Pin to specific version
