#!/usr/bin/env python3
"""
Health Check and Monitoring Tool for n8n on Render

This tool provides comprehensive health monitoring for n8n deployments,
including service status, performance metrics, and automated alerts.
"""

import os
import sys
import time
import json
import argparse
import logging
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from urllib.parse import urljoin
import requests
import psutil
from pathlib import Path

# Try to import optional dependencies
try:
    import smtplib
    from email.mime.text import MimeText
    from email.mime.multipart import MimeMultipart
    SMTP_AVAILABLE = True
except ImportError:
    SMTP_AVAILABLE = False

try:
    from render_api import RenderAPIClient, N8nRenderManager
    RENDER_API_AVAILABLE = True
except ImportError:
    RENDER_API_AVAILABLE = False


@dataclass
class HealthCheckResult:
    """Represents a health check result"""
    timestamp: datetime
    service_name: str
    check_type: str
    status: str  # 'healthy', 'warning', 'critical'
    response_time: float
    message: str
    details: Dict[str, Any] = None
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data


@dataclass
class MetricData:
    """Represents a metric data point"""
    timestamp: datetime
    service_name: str
    metric_name: str
    value: float
    unit: str = ""
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data


class HealthChecker:
    """Core health checking functionality"""
    
    def __init__(self, timeout: int = 10):
        """
        Initialize the health checker
        
        Args:
            timeout: Request timeout in seconds
        """
        self.timeout = timeout
        self.session = requests.Session()
        self.session.timeout = timeout
        self.logger = logging.getLogger(__name__)
    
    def check_http_endpoint(self, url: str, expected_status: int = 200) -> HealthCheckResult:
        """
        Check HTTP endpoint health
        
        Args:
            url: URL to check
            expected_status: Expected HTTP status code
            
        Returns:
            Health check result
        """
        start_time = time.time()
        
        try:
            response = self.session.get(url)
            response_time = (time.time() - start_time) * 1000  # ms
            
            if response.status_code == expected_status:
                status = 'healthy'
                message = f"Endpoint responding normally ({response.status_code})"
            else:
                status = 'warning'
                message = f"Unexpected status code: {response.status_code}"
            
            return HealthCheckResult(
                timestamp=datetime.now(),
                service_name=self._extract_service_name(url),
                check_type='http_endpoint',
                status=status,
                response_time=response_time,
                message=message,
                details={
                    'url': url,
                    'status_code': response.status_code,
                    'headers': dict(response.headers)
                }
            )
            
        except requests.exceptions.Timeout:
            return HealthCheckResult(
                timestamp=datetime.now(),
                service_name=self._extract_service_name(url),
                check_type='http_endpoint',
                status='critical',
                response_time=self.timeout * 1000,
                message="Request timeout",
                details={'url': url, 'error': 'timeout'}
            )
            
        except requests.exceptions.ConnectionError:
            return HealthCheckResult(
                timestamp=datetime.now(),
                service_name=self._extract_service_name(url),
                check_type='http_endpoint',
                status='critical',
                response_time=0,
                message="Connection failed",
                details={'url': url, 'error': 'connection_error'}
            )
            
        except Exception as e:
            return HealthCheckResult(
                timestamp=datetime.now(),
                service_name=self._extract_service_name(url),
                check_type='http_endpoint',
                status='critical',
                response_time=0,
                message=f"Health check failed: {str(e)}",
                details={'url': url, 'error': str(e)}
            )
    
    def check_n8n_health(self, base_url: str, auth: tuple = None) -> HealthCheckResult:
        """
        Check n8n specific health endpoints
        
        Args:
            base_url: n8n base URL
            auth: Optional basic auth tuple (username, password)
            
        Returns:
            Health check result
        """
        health_url = urljoin(base_url, '/healthz')
        
        # Set auth if provided
        if auth:
            self.session.auth = auth
        
        # First check the health endpoint
        health_result = self.check_http_endpoint(health_url)
        
        if health_result.status != 'healthy':
            return health_result
        
        # Additional n8n-specific checks
        try:
            # Check main interface
            main_url = urljoin(base_url, '/')
            main_response = self.session.get(main_url)
            
            # Check if n8n interface is loading
            if 'n8n' in main_response.text.lower() or main_response.status_code == 200:
                status = 'healthy'
                message = "n8n interface accessible"
            else:
                status = 'warning'
                message = "n8n interface may not be loading properly"
            
            health_result.status = status
            health_result.message = message
            health_result.details.update({
                'main_interface_status': main_response.status_code,
                'interface_check': 'passed' if status == 'healthy' else 'failed'
            })
            
        except Exception as e:
            health_result.status = 'warning'
            health_result.message = f"Health endpoint OK, but interface check failed: {str(e)}"
        
        finally:
            # Clear auth
            self.session.auth = None
        
        return health_result
    
    def check_database_connection(self, db_config: dict) -> HealthCheckResult:
        """
        Check database connection health
        
        Args:
            db_config: Database configuration
            
        Returns:
            Health check result
        """
        start_time = time.time()
        
        try:
            if db_config.get('type') == 'postgresql':
                # Check PostgreSQL connection
                import psycopg2
                
                conn = psycopg2.connect(
                    host=db_config['host'],
                    port=db_config.get('port', 5432),
                    database=db_config['database'],
                    user=db_config['user'],
                    password=db_config['password'],
                    connect_timeout=self.timeout
                )
                
                # Simple query to test connection
                cursor = conn.cursor()
                cursor.execute('SELECT 1')
                cursor.fetchone()
                cursor.close()
                conn.close()
                
                response_time = (time.time() - start_time) * 1000
                
                return HealthCheckResult(
                    timestamp=datetime.now(),
                    service_name=db_config.get('name', 'database'),
                    check_type='database_connection',
                    status='healthy',
                    response_time=response_time,
                    message="Database connection successful",
                    details={'type': 'postgresql', 'host': db_config['host']}
                )
                
            elif db_config.get('type') == 'sqlite':
                # Check SQLite file
                db_path = db_config['path']
                
                if not os.path.exists(db_path):
                    return HealthCheckResult(
                        timestamp=datetime.now(),
                        service_name=db_config.get('name', 'database'),
                        check_type='database_connection',
                        status='critical',
                        response_time=0,
                        message="SQLite database file not found",
                        details={'type': 'sqlite', 'path': db_path}
                    )
                
                # Test SQLite connection
                conn = sqlite3.connect(db_path, timeout=self.timeout)
                cursor = conn.cursor()
                cursor.execute('SELECT 1')
                cursor.fetchone()
                cursor.close()
                conn.close()
                
                response_time = (time.time() - start_time) * 1000
                
                return HealthCheckResult(
                    timestamp=datetime.now(),
                    service_name=db_config.get('name', 'database'),
                    check_type='database_connection',
                    status='healthy',
                    response_time=response_time,
                    message="SQLite database accessible",
                    details={'type': 'sqlite', 'path': db_path}
                )
            
            else:
                return HealthCheckResult(
                    timestamp=datetime.now(),
                    service_name=db_config.get('name', 'database'),
                    check_type='database_connection',
                    status='warning',
                    response_time=0,
                    message="Unknown database type",
                    details={'type': db_config.get('type', 'unknown')}
                )
                
        except ImportError as e:
            return HealthCheckResult(
                timestamp=datetime.now(),
                service_name=db_config.get('name', 'database'),
                check_type='database_connection',
                status='warning',
                response_time=0,
                message=f"Database driver not available: {str(e)}",
                details={'error': str(e)}
            )
            
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            
            return HealthCheckResult(
                timestamp=datetime.now(),
                service_name=db_config.get('name', 'database'),
                check_type='database_connection',
                status='critical',
                response_time=response_time,
                message=f"Database connection failed: {str(e)}",
                details={'error': str(e)}
            )
    
    def check_system_resources(self, service_name: str = "system") -> List[HealthCheckResult]:
        """
        Check system resource usage
        
        Args:
            service_name: Service name for reporting
            
        Returns:
            List of health check results for different resources
        """
        results = []
        timestamp = datetime.now()
        
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_status = 'healthy'
        if cpu_percent > 90:
            cpu_status = 'critical'
        elif cpu_percent > 75:
            cpu_status = 'warning'
        
        results.append(HealthCheckResult(
            timestamp=timestamp,
            service_name=service_name,
            check_type='system_cpu',
            status=cpu_status,
            response_time=0,
            message=f"CPU usage: {cpu_percent:.1f}%",
            details={'cpu_percent': cpu_percent}
        ))
        
        # Memory usage
        memory = psutil.virtual_memory()
        memory_status = 'healthy'
        if memory.percent > 90:
            memory_status = 'critical'
        elif memory.percent > 80:
            memory_status = 'warning'
        
        results.append(HealthCheckResult(
            timestamp=timestamp,
            service_name=service_name,
            check_type='system_memory',
            status=memory_status,
            response_time=0,
            message=f"Memory usage: {memory.percent:.1f}%",
            details={
                'memory_percent': memory.percent,
                'memory_available': memory.available,
                'memory_total': memory.total
            }
        ))
        
        # Disk usage
        disk = psutil.disk_usage('/')
        disk_percent = (disk.used / disk.total) * 100
        disk_status = 'healthy'
        if disk_percent > 90:
            disk_status = 'critical'
        elif disk_percent > 85:
            disk_status = 'warning'
        
        results.append(HealthCheckResult(
            timestamp=timestamp,
            service_name=service_name,
            check_type='system_disk',
            status=disk_status,
            response_time=0,
            message=f"Disk usage: {disk_percent:.1f}%",
            details={
                'disk_percent': disk_percent,
                'disk_free': disk.free,
                'disk_total': disk.total
            }
        ))
        
        return results
    
    def _extract_service_name(self, url: str) -> str:
        """Extract service name from URL"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            hostname = parsed.hostname
            if hostname and '.onrender.com' in hostname:
                return hostname.split('.')[0]
            return hostname or 'unknown'
        except:
            return 'unknown'


class MetricsCollector:
    """Collects and stores performance metrics"""
    
    def __init__(self, db_path: str = "/tmp/n8n_metrics.db"):
        """
        Initialize metrics collector
        
        Args:
            db_path: Path to SQLite database for storing metrics
        """
        self.db_path = db_path
        self.logger = logging.getLogger(__name__)
        self._init_database()
    
    def _init_database(self):
        """Initialize the metrics database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create metrics table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    service_name TEXT NOT NULL,
                    metric_name TEXT NOT NULL,
                    value REAL NOT NULL,
                    unit TEXT
                )
            ''')
            
            # Create health_checks table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS health_checks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    service_name TEXT NOT NULL,
                    check_type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    response_time REAL,
                    message TEXT,
                    details TEXT
                )
            ''')
            
            # Create indexes
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp ON health_checks(timestamp)')
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            self.logger.error(f"Failed to initialize database: {e}")
    
    def store_metric(self, metric: MetricData):
        """Store a metric data point"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO metrics (timestamp, service_name, metric_name, value, unit)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                metric.timestamp.isoformat(),
                metric.service_name,
                metric.metric_name,
                metric.value,
                metric.unit
            ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            self.logger.error(f"Failed to store metric: {e}")
    
    def store_health_check(self, result: HealthCheckResult):
        """Store a health check result"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            details_json = json.dumps(result.details) if result.details else None
            
            cursor.execute('''
                INSERT INTO health_checks (timestamp, service_name, check_type, status, response_time, message, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                result.timestamp.isoformat(),
                result.service_name,
                result.check_type,
                result.status,
                result.response_time,
                result.message,
                details_json
            ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            self.logger.error(f"Failed to store health check: {e}")
    
    def get_metrics(self, service_name: str = None, metric_name: str = None, 
                   since: datetime = None, limit: int = 1000) -> List[MetricData]:
        """Get stored metrics"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            query = "SELECT timestamp, service_name, metric_name, value, unit FROM metrics WHERE 1=1"
            params = []
            
            if service_name:
                query += " AND service_name = ?"
                params.append(service_name)
            
            if metric_name:
                query += " AND metric_name = ?"
                params.append(metric_name)
            
            if since:
                query += " AND timestamp >= ?"
                params.append(since.isoformat())
            
            query += " ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            conn.close()
            
            metrics = []
            for row in rows:
                metrics.append(MetricData(
                    timestamp=datetime.fromisoformat(row[0]),
                    service_name=row[1],
                    metric_name=row[2],
                    value=row[3],
                    unit=row[4] or ""
                ))
            
            return metrics
            
        except Exception as e:
            self.logger.error(f"Failed to get metrics: {e}")
            return []
    
    def cleanup_old_data(self, days: int = 30):
        """Clean up old metrics and health check data"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days)
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM metrics WHERE timestamp < ?", (cutoff_date.isoformat(),))
            cursor.execute("DELETE FROM health_checks WHERE timestamp < ?", (cutoff_date.isoformat(),))
            
            conn.commit()
            conn.close()
            
            self.logger.info(f"Cleaned up data older than {days} days")
            
        except Exception as e:
            self.logger.error(f"Failed to cleanup old data: {e}")


class AlertManager:
    """Manages alerts and notifications"""
    
    def __init__(self, config: dict = None):
        """
        Initialize alert manager
        
        Args:
            config: Alert configuration
        """
        self.config = config or {}
        self.logger = logging.getLogger(__name__)
    
    def should_alert(self, result: HealthCheckResult) -> bool:
        """
        Determine if an alert should be sent
        
        Args:
            result: Health check result
            
        Returns:
            True if alert should be sent
        """
        # Alert on critical status
        if result.status == 'critical':
            return True
        
        # Alert on warnings based on configuration
        if result.status == 'warning' and self.config.get('alert_on_warning', False):
            return True
        
        return False
    
    def send_email_alert(self, results: List[HealthCheckResult]):
        """Send email alert for health check results"""
        if not SMTP_AVAILABLE:
            self.logger.warning("SMTP not available, cannot send email alerts")
            return
        
        email_config = self.config.get('email', {})
        if not email_config.get('enabled', False):
            return
        
        # Filter results that need alerts
        alert_results = [r for r in results if self.should_alert(r)]
        if not alert_results:
            return
        
        try:
            # Create email message
            msg = MimeMultipart()
            msg['From'] = email_config['from']
            msg['To'] = ', '.join(email_config['to'])
            msg['Subject'] = f"n8n Health Alert - {len(alert_results)} issues detected"
            
            # Create email body
            body = self._create_email_body(alert_results)
            msg.attach(MimeText(body, 'plain'))
            
            # Send email
            server = smtplib.SMTP(email_config['smtp_server'], email_config.get('smtp_port', 587))
            server.starttls()
            server.login(email_config['username'], email_config['password'])
            server.send_message(msg)
            server.quit()
            
            self.logger.info(f"Sent email alert for {len(alert_results)} issues")
            
        except Exception as e:
            self.logger.error(f"Failed to send email alert: {e}")
    
    def _create_email_body(self, results: List[HealthCheckResult]) -> str:
        """Create email body for alerts"""
        body = "n8n Health Check Alert\n"
        body += "=" * 50 + "\n\n"
        body += f"Alert Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        body += f"Number of Issues: {len(results)}\n\n"
        
        # Group by status
        critical_results = [r for r in results if r.status == 'critical']
        warning_results = [r for r in results if r.status == 'warning']
        
        if critical_results:
            body += "CRITICAL ISSUES:\n"
            body += "-" * 20 + "\n"
            for result in critical_results:
                body += f"Service: {result.service_name}\n"
                body += f"Check: {result.check_type}\n"
                body += f"Message: {result.message}\n"
                body += f"Response Time: {result.response_time:.2f}ms\n\n"
        
        if warning_results:
            body += "WARNING ISSUES:\n"
            body += "-" * 20 + "\n"
            for result in warning_results:
                body += f"Service: {result.service_name}\n"
                body += f"Check: {result.check_type}\n"
                body += f"Message: {result.message}\n"
                body += f"Response Time: {result.response_time:.2f}ms\n\n"
        
        return body


class N8nMonitor:
    """Main monitoring orchestrator"""
    
    def __init__(self, config_file: str = None):
        """
        Initialize the monitor
        
        Args:
            config_file: Path to configuration file
        """
        self.config = self._load_config(config_file)
        self.health_checker = HealthChecker(timeout=self.config.get('timeout', 10))
        self.metrics_collector = MetricsCollector(self.config.get('metrics_db', '/tmp/n8n_metrics.db'))
        self.alert_manager = AlertManager(self.config.get('alerts', {}))
        self.logger = logging.getLogger(__name__)
        
        # Initialize Render API if available
        self.render_manager = None
        if RENDER_API_AVAILABLE and self.config.get('render_api_key'):
            self.render_manager = N8nRenderManager(self.config['render_api_key'])
    
    def _load_config(self, config_file: str) -> dict:
        """Load configuration from file"""
        default_config = {
            'timeout': 10,
            'check_interval': 300,  # 5 minutes
            'metrics_db': '/tmp/n8n_metrics.db',
            'services': [],
            'alerts': {
                'email': {'enabled': False}
            }
        }
        
        if config_file and os.path.exists(config_file):
            try:
                with open(config_file, 'r') as f:
                    file_config = json.load(f)
                default_config.update(file_config)
            except Exception as e:
                logging.error(f"Failed to load config file: {e}")
        
        return default_config
    
    def run_health_checks(self) -> List[HealthCheckResult]:
        """Run all configured health checks"""
        results = []
        
        # Check configured services
        for service_config in self.config.get('services', []):
            service_results = self._check_service(service_config)
            results.extend(service_results)
        
        # Check system resources
        if self.config.get('check_system_resources', True):
            system_results = self.health_checker.check_system_resources()
            results.extend(system_results)
        
        # Store results
        for result in results:
            self.metrics_collector.store_health_check(result)
        
        # Handle alerts
        self.alert_manager.send_email_alert(results)
        
        return results
    
    def _check_service(self, service_config: dict) -> List[HealthCheckResult]:
        """Check a single service"""
        results = []
        service_name = service_config.get('name', 'unknown')
        
        # HTTP endpoint check
        if 'url' in service_config:
            auth = None
            if 'auth' in service_config:
                auth = (service_config['auth']['username'], service_config['auth']['password'])
            
            if service_config.get('type') == 'n8n':
                result = self.health_checker.check_n8n_health(service_config['url'], auth)
            else:
                result = self.health_checker.check_http_endpoint(service_config['url'])
            
            results.append(result)
        
        # Database check
        if 'database' in service_config:
            db_result = self.health_checker.check_database_connection(service_config['database'])
            results.append(db_result)
        
        return results
    
    def collect_metrics(self):
        """Collect performance metrics"""
        timestamp = datetime.now()
        
        # Collect system metrics
        if psutil:
            cpu_percent = psutil.cpu_percent()
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            metrics = [
                MetricData(timestamp, 'system', 'cpu_percent', cpu_percent, '%'),
                MetricData(timestamp, 'system', 'memory_percent', memory.percent, '%'),
                MetricData(timestamp, 'system', 'disk_percent', (disk.used / disk.total) * 100, '%'),
                MetricData(timestamp, 'system', 'memory_available', memory.available, 'bytes'),
                MetricData(timestamp, 'system', 'disk_free', disk.free, 'bytes'),
            ]
            
            for metric in metrics:
                self.metrics_collector.store_metric(metric)
    
    def run_continuous(self, interval: int = None):
        """Run monitoring continuously"""
        interval = interval or self.config.get('check_interval', 300)
        
        self.logger.info(f"Starting continuous monitoring (interval: {interval}s)")
        
        try:
            while True:
                start_time = time.time()
                
                # Run health checks
                results = self.run_health_checks()
                
                # Collect metrics
                self.collect_metrics()
                
                # Clean up old data periodically
                if datetime.now().hour == 2:  # 2 AM
                    self.metrics_collector.cleanup_old_data()
                
                # Log summary
                healthy_count = sum(1 for r in results if r.status == 'healthy')
                warning_count = sum(1 for r in results if r.status == 'warning')
                critical_count = sum(1 for r in results if r.status == 'critical')
                
                self.logger.info(f"Health check complete: {healthy_count} healthy, {warning_count} warnings, {critical_count} critical")
                
                # Wait for next interval
                elapsed = time.time() - start_time
                sleep_time = max(0, interval - elapsed)
                time.sleep(sleep_time)
                
        except KeyboardInterrupt:
            self.logger.info("Monitoring stopped by user")


def setup_logging(verbose: bool = False):
    """Set up logging configuration"""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )


def main():
    """Main CLI interface"""
    parser = argparse.ArgumentParser(description="Health monitoring tool for n8n on Render")
    parser.add_argument("--config", help="Configuration file path")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--interval", type=int, default=300, help="Check interval in seconds")
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Check command
    check_parser = subparsers.add_parser("check", help="Run single health check")
    check_parser.add_argument("--url", help="URL to check")
    check_parser.add_argument("--type", choices=["http", "n8n"], default="http", help="Check type")
    check_parser.add_argument("--auth", nargs=2, metavar=("USERNAME", "PASSWORD"), help="Basic auth credentials")
    
    # Monitor command
    monitor_parser = subparsers.add_parser("monitor", help="Run continuous monitoring")
    
    # Metrics command
    metrics_parser = subparsers.add_parser("metrics", help="Show metrics")
    metrics_parser.add_argument("--service", help="Filter by service name")
    metrics_parser.add_argument("--metric", help="Filter by metric name")
    metrics_parser.add_argument("--hours", type=int, default=24, help="Hours of data to show")
    
    args = parser.parse_args()
    
    setup_logging(args.verbose)
    
    try:
        if args.command == "check":
            if not args.url:
                print("Error: --url required for check command")
                sys.exit(1)
            
            checker = HealthChecker()
            auth = tuple(args.auth) if args.auth else None
            
            if args.type == "n8n":
                result = checker.check_n8n_health(args.url, auth)
            else:
                result = checker.check_http_endpoint(args.url)
            
            print(f"Service: {result.service_name}")
            print(f"Status: {result.status}")
            print(f"Message: {result.message}")
            print(f"Response Time: {result.response_time:.2f}ms")
            
            if result.details:
                print("Details:")
                for key, value in result.details.items():
                    print(f"  {key}: {value}")
        
        elif args.command == "monitor":
            monitor = N8nMonitor(args.config)
            monitor.run_continuous(args.interval)
        
        elif args.command == "metrics":
            monitor = N8nMonitor(args.config)
            since = datetime.now() - timedelta(hours=args.hours)
            
            metrics = monitor.metrics_collector.get_metrics(
                service_name=args.service,
                metric_name=args.metric,
                since=since
            )
            
            if metrics:
                print(f"Found {len(metrics)} metrics:")
                for metric in metrics[-20:]:  # Show last 20
                    print(f"{metric.timestamp.strftime('%Y-%m-%d %H:%M:%S')} - "
                          f"{metric.service_name}.{metric.metric_name}: "
                          f"{metric.value} {metric.unit}")
            else:
                print("No metrics found")
        
        else:
            parser.print_help()
    
    except KeyboardInterrupt:
        print("\nOperation cancelled")
        sys.exit(1)
    except Exception as e:
        logging.error(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
