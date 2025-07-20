#!/usr/bin/env python3
"""
Render API Client for n8n Deployment Management

This tool provides a Python interface to the Render API for managing
n8n deployments, including service creation, monitoring, and maintenance.
"""

import os
import sys
import json
import time
import argparse
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from urllib.parse import urljoin
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


@dataclass
class RenderService:
    """Represents a Render service"""
    id: str
    name: str
    type: str
    status: str
    url: Optional[str] = None
    plan: Optional[str] = None
    region: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class RenderAPIError(Exception):
    """Custom exception for Render API errors"""
    def __init__(self, message: str, status_code: int = None, response_data: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data


class RenderAPIClient:
    """Render API client for n8n deployment management"""
    
    BASE_URL = "https://api.render.com/v1"
    
    def __init__(self, api_key: str, timeout: int = 30):
        """
        Initialize the Render API client
        
        Args:
            api_key: Render API key
            timeout: Request timeout in seconds
        """
        self.api_key = api_key
        self.timeout = timeout
        self.session = self._create_session()
        self.logger = logging.getLogger(__name__)
    
    def _create_session(self) -> requests.Session:
        """Create a requests session with retry strategy"""
        session = requests.Session()
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        # Set default headers
        session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "n8n-render-toolkit/1.0.0"
        })
        
        return session
    
    def _make_request(self, method: str, endpoint: str, data: dict = None) -> dict:
        """
        Make a request to the Render API
        
        Args:
            method: HTTP method
            endpoint: API endpoint
            data: Request data
            
        Returns:
            Response data
            
        Raises:
            RenderAPIError: On API errors
        """
        url = urljoin(self.BASE_URL, endpoint.lstrip('/'))
        
        try:
            self.logger.debug(f"Making {method} request to {url}")
            
            if data:
                response = self.session.request(
                    method, url, json=data, timeout=self.timeout
                )
            else:
                response = self.session.request(
                    method, url, timeout=self.timeout
                )
            
            # Handle response
            if response.status_code >= 400:
                error_data = {}
                try:
                    error_data = response.json()
                except:
                    pass
                
                error_message = error_data.get('message', f'API request failed with status {response.status_code}')
                raise RenderAPIError(error_message, response.status_code, error_data)
            
            # Return JSON response
            return response.json() if response.text else {}
            
        except requests.exceptions.RequestException as e:
            raise RenderAPIError(f"Request failed: {str(e)}")
    
    def get_services(self, service_type: str = None) -> List[RenderService]:
        """
        Get list of services
        
        Args:
            service_type: Filter by service type (web, pserv, cron, worker)
            
        Returns:
            List of services
        """
        params = {}
        if service_type:
            params['type'] = service_type
        
        endpoint = "/services"
        if params:
            query_string = "&".join(f"{k}={v}" for k, v in params.items())
            endpoint += f"?{query_string}"
        
        response = self._make_request("GET", endpoint)
        
        services = []
        for service_data in response.get('services', []):
            service = RenderService(
                id=service_data['id'],
                name=service_data['name'],
                type=service_data['type'],
                status=service_data.get('serviceDetails', {}).get('status', 'unknown'),
                url=service_data.get('serviceDetails', {}).get('url'),
                plan=service_data.get('serviceDetails', {}).get('plan'),
                region=service_data.get('serviceDetails', {}).get('region'),
                created_at=service_data.get('createdAt'),
                updated_at=service_data.get('updatedAt')
            )
            services.append(service)
        
        return services
    
    def get_service(self, service_id: str) -> RenderService:
        """
        Get service details
        
        Args:
            service_id: Service ID
            
        Returns:
            Service details
        """
        response = self._make_request("GET", f"/services/{service_id}")
        
        return RenderService(
            id=response['id'],
            name=response['name'],
            type=response['type'],
            status=response.get('serviceDetails', {}).get('status', 'unknown'),
            url=response.get('serviceDetails', {}).get('url'),
            plan=response.get('serviceDetails', {}).get('plan'),
            region=response.get('serviceDetails', {}).get('region'),
            created_at=response.get('createdAt'),
            updated_at=response.get('updatedAt')
        )
    
    def create_web_service(self, config: dict) -> RenderService:
        """
        Create a web service
        
        Args:
            config: Service configuration
            
        Returns:
            Created service
        """
        response = self._make_request("POST", "/services", config)
        
        return RenderService(
            id=response['id'],
            name=response['name'],
            type=response['type'],
            status=response.get('serviceDetails', {}).get('status', 'creating'),
            url=response.get('serviceDetails', {}).get('url'),
            plan=response.get('serviceDetails', {}).get('plan'),
            region=response.get('serviceDetails', {}).get('region'),
            created_at=response.get('createdAt'),
            updated_at=response.get('updatedAt')
        )
    
    def create_database_service(self, config: dict) -> RenderService:
        """
        Create a database service
        
        Args:
            config: Database configuration
            
        Returns:
            Created service
        """
        return self.create_web_service(config)  # Same API endpoint
    
    def delete_service(self, service_id: str) -> bool:
        """
        Delete a service
        
        Args:
            service_id: Service ID
            
        Returns:
            True if successful
        """
        try:
            self._make_request("DELETE", f"/services/{service_id}")
            return True
        except RenderAPIError:
            return False
    
    def get_environment_variables(self, service_id: str) -> dict:
        """
        Get environment variables for a service
        
        Args:
            service_id: Service ID
            
        Returns:
            Environment variables
        """
        response = self._make_request("GET", f"/services/{service_id}/env-vars")
        
        env_vars = {}
        for env_var in response.get('envVars', []):
            env_vars[env_var['key']] = env_var.get('value', '')
        
        return env_vars
    
    def set_environment_variable(self, service_id: str, key: str, value: str) -> bool:
        """
        Set an environment variable
        
        Args:
            service_id: Service ID
            key: Variable name
            value: Variable value
            
        Returns:
            True if successful
        """
        try:
            data = {"key": key, "value": value}
            self._make_request("PUT", f"/services/{service_id}/env-vars/{key}", data)
            return True
        except RenderAPIError:
            return False
    
    def get_deployments(self, service_id: str, limit: int = 10) -> List[dict]:
        """
        Get deployments for a service
        
        Args:
            service_id: Service ID
            limit: Number of deployments to return
            
        Returns:
            List of deployments
        """
        response = self._make_request("GET", f"/services/{service_id}/deploys?limit={limit}")
        return response.get('deploys', [])
    
    def trigger_deployment(self, service_id: str) -> dict:
        """
        Trigger a new deployment
        
        Args:
            service_id: Service ID
            
        Returns:
            Deployment details
        """
        return self._make_request("POST", f"/services/{service_id}/deploys")
    
    def wait_for_deployment(self, service_id: str, timeout: int = 600) -> bool:
        """
        Wait for a service to be ready
        
        Args:
            service_id: Service ID
            timeout: Maximum wait time in seconds
            
        Returns:
            True if service is ready, False if timeout
        """
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                service = self.get_service(service_id)
                
                if service.status in ['live', 'running']:
                    return True
                elif service.status in ['failed', 'error']:
                    self.logger.error(f"Service {service_id} failed to deploy")
                    return False
                
                self.logger.info(f"Service {service_id} status: {service.status}, waiting...")
                time.sleep(10)
                
            except RenderAPIError as e:
                self.logger.error(f"Error checking service status: {e}")
                time.sleep(5)
        
        self.logger.error(f"Timeout waiting for service {service_id} to be ready")
        return False
    
    def get_service_logs(self, service_id: str, lines: int = 100) -> List[str]:
        """
        Get service logs
        
        Args:
            service_id: Service ID
            lines: Number of log lines to return
            
        Returns:
            List of log lines
        """
        try:
            response = self._make_request("GET", f"/services/{service_id}/logs?lines={lines}")
            return response.get('logs', [])
        except RenderAPIError:
            return []


class N8nRenderManager:
    """High-level manager for n8n deployments on Render"""
    
    def __init__(self, api_key: str):
        """
        Initialize the n8n Render manager
        
        Args:
            api_key: Render API key
        """
        self.client = RenderAPIClient(api_key)
        self.logger = logging.getLogger(__name__)
    
    def list_n8n_services(self) -> List[RenderService]:
        """
        List all n8n-related services
        
        Returns:
            List of n8n services
        """
        all_services = self.client.get_services()
        
        # Filter services that look like n8n deployments
        n8n_services = []
        for service in all_services:
            if any(keyword in service.name.lower() for keyword in ['n8n', 'automation']):
                n8n_services.append(service)
        
        return n8n_services
    
    def create_postgres_deployment(self, name: str, config: dict) -> dict:
        """
        Create a complete n8n deployment with PostgreSQL
        
        Args:
            name: Deployment name
            config: Deployment configuration
            
        Returns:
            Deployment details
        """
        self.logger.info(f"Creating PostgreSQL deployment: {name}")
        
        # Create database service
        db_config = {
            "type": "pserv",
            "name": f"{name}-database",
            "env": "node",
            "plan": config.get('database_plan', 'starter'),
            "region": config.get('region', 'oregon'),
            "databases": [
                {
                    "name": "n8n_db",
                    "databaseName": "n8n",
                    "user": "n8n_user"
                }
            ]
        }
        
        database = self.client.create_database_service(db_config)
        self.logger.info(f"Created database service: {database.id}")
        
        # Wait for database to be ready
        if not self.client.wait_for_deployment(database.id, timeout=300):
            raise RenderAPIError("Database failed to become ready")
        
        # Create web service
        web_config = {
            "type": "web",
            "name": f"{name}-app",
            "env": "docker",
            "plan": config.get('web_plan', 'starter'),
            "region": config.get('region', 'oregon'),
            "image": {
                "url": config.get('n8n_image', 'docker.io/n8nio/n8n:1.54.0')
            },
            "healthCheckPath": "/healthz",
            "autoDeploy": config.get('auto_deploy', True),
            "envVars": self._get_postgres_env_vars(f"{name}-app", database.id)
        }
        
        if 'github_repo' in config:
            web_config['repo'] = config['github_repo']
            web_config['branch'] = config.get('github_branch', 'main')
        
        web_service = self.client.create_web_service(web_config)
        self.logger.info(f"Created web service: {web_service.id}")
        
        return {
            'database': database,
            'web_service': web_service,
            'deployment_name': name
        }
    
    def create_disk_deployment(self, name: str, config: dict) -> dict:
        """
        Create a complete n8n deployment with persistent disk
        
        Args:
            name: Deployment name
            config: Deployment configuration
            
        Returns:
            Deployment details
        """
        self.logger.info(f"Creating disk deployment: {name}")
        
        # Create web service with persistent disk
        web_config = {
            "type": "web",
            "name": f"{name}-app",
            "env": "docker",
            "plan": config.get('web_plan', 'starter'),
            "region": config.get('region', 'oregon'),
            "image": {
                "url": config.get('n8n_image', 'docker.io/n8nio/n8n:1.54.0')
            },
            "healthCheckPath": "/healthz",
            "autoDeploy": config.get('auto_deploy', True),
            "disk": {
                "name": f"{name}-data-disk",
                "mountPath": "/home/node/.n8n",
                "sizeGB": config.get('disk_size', 1)
            },
            "envVars": self._get_disk_env_vars(f"{name}-app")
        }
        
        if 'github_repo' in config:
            web_config['repo'] = config['github_repo']
            web_config['branch'] = config.get('github_branch', 'main')
        
        web_service = self.client.create_web_service(web_config)
        self.logger.info(f"Created web service: {web_service.id}")
        
        return {
            'web_service': web_service,
            'deployment_name': name
        }
    
    def _get_postgres_env_vars(self, service_name: str, database_id: str) -> List[dict]:
        """Get environment variables for PostgreSQL deployment"""
        return [
            {"key": "DB_TYPE", "value": "postgresdb"},
            {"key": "WEBHOOK_URL", "value": f"https://{service_name}.onrender.com"},
            {"key": "N8N_EDITOR_BASE_URL", "value": f"https://{service_name}.onrender.com"},
            {"key": "N8N_PROTOCOL", "value": "https"},
            {"key": "N8N_PORT", "value": "5000"},
            {"key": "N8N_LISTEN_ADDRESS", "value": "0.0.0.0"},
            {"key": "N8N_BASIC_AUTH_ACTIVE", "value": "true"},
            {"key": "EXECUTIONS_PROCESS", "value": "main"},
            {"key": "EXECUTIONS_MODE", "value": "regular"},
            {"key": "N8N_LOG_LEVEL", "value": "info"},
            {"key": "NODE_ENV", "value": "production"}
        ]
    
    def _get_disk_env_vars(self, service_name: str) -> List[dict]:
        """Get environment variables for disk deployment"""
        return [
            {"key": "WEBHOOK_URL", "value": f"https://{service_name}.onrender.com"},
            {"key": "N8N_EDITOR_BASE_URL", "value": f"https://{service_name}.onrender.com"},
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
    
    def setup_authentication(self, service_id: str, username: str = "admin", password: str = None) -> dict:
        """
        Set up authentication for n8n instance
        
        Args:
            service_id: Web service ID
            username: Auth username
            password: Auth password (generated if not provided)
            
        Returns:
            Authentication details
        """
        if not password:
            import secrets
            import string
            alphabet = string.ascii_letters + string.digits
            password = ''.join(secrets.choice(alphabet) for _ in range(16))
        
        # Generate encryption key
        import secrets
        encryption_key = secrets.token_hex(32)
        
        # Set environment variables
        env_vars = {
            "N8N_BASIC_AUTH_USER": username,
            "N8N_BASIC_AUTH_PASSWORD": password,
            "N8N_ENCRYPTION_KEY": encryption_key
        }
        
        for key, value in env_vars.items():
            if not self.client.set_environment_variable(service_id, key, value):
                self.logger.error(f"Failed to set {key}")
        
        return {
            "username": username,
            "password": password,
            "encryption_key": encryption_key
        }
    
    def get_deployment_status(self, deployment_name: str) -> dict:
        """
        Get status of a deployment
        
        Args:
            deployment_name: Name of the deployment
            
        Returns:
            Deployment status
        """
        services = self.list_n8n_services()
        
        deployment_services = []
        for service in services:
            if deployment_name in service.name:
                deployment_services.append(service)
        
        if not deployment_services:
            return {"status": "not_found", "services": []}
        
        # Determine overall status
        statuses = [service.status for service in deployment_services]
        
        if all(status in ['live', 'running'] for status in statuses):
            overall_status = "running"
        elif any(status in ['failed', 'error'] for status in statuses):
            overall_status = "failed"
        else:
            overall_status = "deploying"
        
        return {
            "status": overall_status,
            "services": deployment_services
        }


def setup_logging(verbose: bool = False):
    """Set up logging configuration"""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )


def main():
    """Main CLI interface"""
    parser = argparse.ArgumentParser(description="Render API client for n8n deployments")
    parser.add_argument("--api-key", help="Render API key", 
                       default=os.getenv("RENDER_API_KEY"))
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # List services command
    list_parser = subparsers.add_parser("list", help="List n8n services")
    list_parser.add_argument("--type", choices=["web", "pserv"], help="Filter by service type")
    
    # Create deployment command
    create_parser = subparsers.add_parser("create", help="Create n8n deployment")
    create_parser.add_argument("name", help="Deployment name")
    create_parser.add_argument("--type", choices=["postgres", "disk"], default="postgres",
                              help="Deployment type")
    create_parser.add_argument("--plan", default="starter", help="Service plan")
    create_parser.add_argument("--region", default="oregon", help="Render region")
    create_parser.add_argument("--github-repo", help="GitHub repository URL")
    create_parser.add_argument("--github-branch", default="main", help="GitHub branch")
    
    # Status command
    status_parser = subparsers.add_parser("status", help="Get deployment status")
    status_parser.add_argument("name", help="Deployment name")
    
    # Logs command
    logs_parser = subparsers.add_parser("logs", help="Get service logs")
    logs_parser.add_argument("service_id", help="Service ID")
    logs_parser.add_argument("--lines", type=int, default=100, help="Number of log lines")
    
    args = parser.parse_args()
    
    if not args.api_key:
        print("Error: Render API key required. Set RENDER_API_KEY environment variable or use --api-key")
        sys.exit(1)
    
    setup_logging(args.verbose)
    
    try:
        manager = N8nRenderManager(args.api_key)
        
        if args.command == "list":
            services = manager.list_n8n_services()
            if args.type:
                services = [s for s in services if s.type == args.type]
            
            print(f"Found {len(services)} n8n services:")
            for service in services:
                print(f"  {service.name} ({service.type}) - {service.status}")
                if service.url:
                    print(f"    URL: {service.url}")
        
        elif args.command == "create":
            config = {
                'web_plan': args.plan,
                'region': args.region,
                'github_repo': args.github_repo,
                'github_branch': args.github_branch
            }
            
            if args.type == "postgres":
                config['database_plan'] = args.plan
                deployment = manager.create_postgres_deployment(args.name, config)
                print(f"Created PostgreSQL deployment: {args.name}")
                print(f"  Database ID: {deployment['database'].id}")
                print(f"  Web Service ID: {deployment['web_service'].id}")
            else:
                deployment = manager.create_disk_deployment(args.name, config)
                print(f"Created disk deployment: {args.name}")
                print(f"  Web Service ID: {deployment['web_service'].id}")
        
        elif args.command == "status":
            status = manager.get_deployment_status(args.name)
            print(f"Deployment '{args.name}' status: {status['status']}")
            for service in status['services']:
                print(f"  {service.name}: {service.status}")
        
        elif args.command == "logs":
            logs = manager.client.get_service_logs(args.service_id, args.lines)
            for log in logs:
                print(log)
        
        else:
            parser.print_help()
    
    except RenderAPIError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nOperation cancelled")
        sys.exit(1)


if __name__ == "__main__":
    main()
