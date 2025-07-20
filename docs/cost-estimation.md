# n8n on Render Cost Estimation Guide

This guide helps you estimate the monthly costs of running n8n on Render based on different usage scenarios and requirements.

## Table of Contents

1. [Render Pricing Overview](#render-pricing-overview)
2. [Cost Scenarios](#cost-scenarios)
3. [Cost Calculator](#cost-calculator)
4. [Usage-Based Estimation](#usage-based-estimation)
5. [Cost Optimization Strategies](#cost-optimization-strategies)
6. [ROI Considerations](#roi-considerations)

## Render Pricing Overview

### Web Services

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0/month | 750 hours/month, sleeps after 15min inactivity, 512MB RAM, 0.1 CPU |
| **Starter** | $7/month | Always-on, custom domains, 512MB RAM, 0.5 CPU |
| **Standard** | $25/month | 2GB RAM, 1 CPU, priority support |
| **Pro** | $85/month | 4GB RAM, 2 CPU, advanced features |
| **Pro Plus** | $185/month | 8GB RAM, 4 CPU, dedicated resources |

### PostgreSQL Databases

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0/month | 1GB storage, 1-month retention, shared resources |
| **Starter** | $7/month | 1GB storage, daily backups, better performance |
| **Standard** | $20/month | 10GB storage, point-in-time recovery |
| **Pro** | $65/month | 100GB storage, high availability |
| **Pro Max** | $120/month | 200GB storage, dedicated resources |

### Persistent Disks (Alternative to Database)

| Size | Price | Use Case |
|------|-------|----------|
| **1GB** | $1/month | Basic SQLite storage |
| **10GB** | $10/month | Moderate workflow data |
| **100GB** | $100/month | Large datasets |

## Cost Scenarios

### Scenario 1: Personal/Hobby Use

**Use Case:**
- Personal automation tasks
- 1-5 simple workflows
- Low execution frequency (< 1000/month)
- No uptime requirements

**Recommended Setup:**
```yaml
# Free Tier Setup
Web Service: Free Plan ($0/month)
Database: Free Plan ($0/month)
Total: $0/month
