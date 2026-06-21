# UCCX Migration Tool - Server Deployment Guide

**Version:** 1.0  
**Date:** September 2025  
**Application:** Unified Contact Center Express (UCCX) Migration Tool  

---

## Table of Contents

1. [Overview](#overview)
2. [Server Requirements](#server-requirements)
3. [Initial Server Setup](#initial-server-setup)
4. [Database Setup](#database-setup)
5. [Application Deployment](#application-deployment)
6. [Environment Configuration](#environment-configuration)
7. [Build the Application](#build-the-application)
8. [Process Management with PM2](#process-management-with-pm2)
9. [Nginx Reverse Proxy](#nginx-reverse-proxy)
10. [SSL Certificate Setup](#ssl-certificate-setup)
11. [Firewall Configuration](#firewall-configuration)
12. [Monitoring & Maintenance](#monitoring--maintenance)
13. [Initial Setup & Testing](#initial-setup--testing)
14. [Security Hardening](#security-hardening)
15. [Post-Deployment Checklist](#post-deployment-checklist)
16. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides comprehensive instructions for deploying the UCCX Migration Tool to your own production server. The application is a full-stack web solution that enables enterprise administrators to import, parse, and migrate UCCX configurations between systems.

**Key Features:**
- XML-based UCCX configuration file handling
- Real-time migration monitoring
- Comprehensive audit logging
- UCCX API integration
- Web-based dashboard interface

---

## Server Requirements

### Minimum System Requirements

- **Operating System:** Ubuntu 20.04+ / CentOS 8+ / RHEL 8+
- **Node.js:** Version 18+ (recommend 20.x LTS)
- **Database:** PostgreSQL 14+
- **Memory:** 4GB RAM minimum (8GB recommended)
- **Storage:** 20GB+ (depending on configuration file sizes)
- **Network:** SSL certificate (Let's Encrypt recommended)
- **Ports:** 80 (HTTP), 443 (HTTPS), 22 (SSH), 5432 (PostgreSQL if remote access needed)

### Recommended Production Specifications

- **CPU:** 4+ cores
- **Memory:** 8GB+ RAM
- **Storage:** 50GB+ SSD
- **Network:** Dedicated public IP with domain name

---

## Initial Server Setup

### System Update and Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install curl wget git unzip -y
```

### Node.js Installation

```bash
# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### PostgreSQL Installation

```bash
# Install PostgreSQL and contrib packages
sudo apt install postgresql postgresql-contrib -y

# Verify installation
sudo systemctl status postgresql
```

### Web Server Setup

```bash
# Install Nginx (reverse proxy)
sudo apt install nginx -y

# Install PM2 (Node.js process manager)
sudo npm install -g pm2

# Verify installations
nginx -v
pm2 --version
```

---

## Database Setup

### Create Database and User

```bash
# Switch to PostgreSQL user
sudo -u postgres psql
```

Execute the following SQL commands:

```sql
-- Create database
CREATE DATABASE uccx_migration;

-- Create dedicated user
CREATE USER uccx_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE uccx_migration TO uccx_user;

-- Exit PostgreSQL
\q
```

### Configure PostgreSQL Service

```bash
# Enable PostgreSQL to start on boot
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Verify service status
sudo systemctl status postgresql
```

---

## Application Deployment

### Create Application Directory

```bash
# Create application directory
sudo mkdir -p /opt/uccx-migration
sudo chown $USER:$USER /opt/uccx-migration
cd /opt/uccx-migration
```

### Deploy Application Files

Transfer your application files to the server using one of these methods:

**Option 1: Git Clone (if using version control)**
```bash
git clone <your-repository-url> .
```

**Option 2: File Transfer (SCP/SFTP)**
```bash
# From your local machine
scp -r /path/to/uccx-migration/* user@your-server:/opt/uccx-migration/
```

**Option 3: Archive Upload**
```bash
# Upload and extract archive
wget <your-archive-url>
unzip uccx-migration.zip
```

### Install Dependencies

```bash
# Navigate to application directory
cd /opt/uccx-migration

# Install Node.js dependencies
npm install

# Verify installation
npm list --depth=0
```

---

## Environment Configuration

### Create Environment File

```bash
# Create environment configuration
touch .env
chmod 600 .env  # Secure permissions
```

### Environment Variables

Add the following configuration to `.env`:

```env
# Application Configuration
NODE_ENV=production
PORT=5000

# Database Configuration
DATABASE_URL=postgresql://uccx_user:your_secure_password@localhost:5432/uccx_migration

# Session Security
SESSION_SECRET=your-super-secure-session-secret-minimum-32-characters

# Google Cloud Storage (Optional - if using cloud storage)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name

# Default UCCX Configuration (Optional - can be set via UI)
DEFAULT_UCCX_HOST=your-uccx-server.example.com
DEFAULT_UCCX_PORT=8443
DEFAULT_UCCX_USERNAME=admin
DEFAULT_UCCX_PASSWORD=secure_password

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=/var/log/uccx-migration/app.log
```

### Security Considerations

- Use strong, unique passwords (minimum 16 characters)
- Generate session secret with: `openssl rand -hex 32`
- Store sensitive credentials securely
- Regularly rotate passwords and secrets

---

## Build the Application

### Production Build

```bash
# Build the application for production
npm run build

# Verify build output
ls -la dist/
```

### Database Schema Setup

```bash
# Push database schema to PostgreSQL
npm run db:push

# Verify database tables
sudo -u postgres psql -d uccx_migration -c "\dt"
```

### Test Build

```bash
# Test production build
npm run start

# Verify application starts (then stop with Ctrl+C)
# Check for any error messages
```

---

## Process Management with PM2

### PM2 Configuration

Create `ecosystem.config.js` in your application directory:

```javascript
module.exports = {
  apps: [{
    name: 'uccx-migration',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/log/pm2/uccx-migration-error.log',
    out_file: '/var/log/pm2/uccx-migration-out.log',
    log_file: '/var/log/pm2/uccx-migration.log',
    time: true,
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false,
    ignore_watch: ['node_modules', 'logs', '*.log'],
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

### PM2 Setup and Configuration

```bash
# Create PM2 log directory
sudo mkdir -p /var/log/pm2
sudo chown $USER:$USER /var/log/pm2

# Start application with PM2
pm2 start ecosystem.config.js

# Verify application is running
pm2 status

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions provided by the command
```

### PM2 Management Commands

```bash
# View application status
pm2 status

# View logs in real-time
pm2 logs uccx-migration

# Restart application
pm2 restart uccx-migration

# Stop application
pm2 stop uccx-migration

# Monitor resources
pm2 monit
```

---

## Nginx Reverse Proxy

### Nginx Configuration

Create `/etc/nginx/sites-available/uccx-migration`:

```nginx
# HTTP server - redirect to HTTPS
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Redirect all HTTP traffic to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server - main configuration
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Certificate Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Compression Settings
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # File Upload Settings (for UCCX configuration files)
    client_max_body_size 50M;
    client_body_timeout 60s;
    client_header_timeout 60s;

    # Main Application Proxy
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;
    }

    # Static Files Optimization
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary "Accept-Encoding";
    }

    # API Endpoints
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Health Check Endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### Enable Nginx Configuration

```bash
# Test nginx configuration
sudo nginx -t

# Enable the site
sudo ln -s /etc/nginx/sites-available/uccx-migration /etc/nginx/sites-enabled/

# Remove default site if present
sudo rm -f /etc/nginx/sites-enabled/default

# Restart nginx
sudo systemctl restart nginx

# Enable nginx to start on boot
sudo systemctl enable nginx
```

---

## SSL Certificate Setup

### Install Certbot

```bash
# Install certbot for Let's Encrypt
sudo apt install certbot python3-certbot-nginx -y
```

### Obtain SSL Certificate

```bash
# Get SSL certificate for your domain
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow the prompts to:
# 1. Enter email address
# 2. Agree to terms of service
# 3. Choose redirect option (recommended: redirect HTTP to HTTPS)
```

### Test Certificate Renewal

```bash
# Test automatic renewal
sudo certbot renew --dry-run

# Set up automatic renewal (certbot usually sets this up automatically)
sudo systemctl status certbot.timer
```

---

## Firewall Configuration

### Configure UFW (Ubuntu Firewall)

```bash
# Enable UFW
sudo ufw enable

# Allow SSH (adjust port if you use non-standard SSH port)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow PostgreSQL (only if remote database access is needed)
# sudo ufw allow 5432/tcp

# Check firewall status
sudo ufw status verbose
```

### Alternative: iptables Configuration

```bash
# If using iptables instead of UFW
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
sudo iptables -P INPUT DROP

# Save iptables rules
sudo iptables-save > /etc/iptables/rules.v4
```

---

## Monitoring & Maintenance

### Create Backup Script

Create `/opt/uccx-migration/scripts/backup.sh`:

```bash
#!/bin/bash

# Configuration
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/uccx-migration"
APP_DIR="/opt/uccx-migration"
LOG_FILE="/var/log/uccx-migration/backup.log"

# Create backup directory
mkdir -p $BACKUP_DIR
mkdir -p /var/log/uccx-migration

echo "$(date): Starting backup process" >> $LOG_FILE

# Database backup
echo "$(date): Backing up database" >> $LOG_FILE
pg_dump -h localhost -U uccx_user -d uccx_migration > $BACKUP_DIR/db_backup_$DATE.sql

if [ $? -eq 0 ]; then
    echo "$(date): Database backup completed successfully" >> $LOG_FILE
else
    echo "$(date): Database backup failed" >> $LOG_FILE
    exit 1
fi

# Application files backup
echo "$(date): Backing up application files" >> $LOG_FILE
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz -C /opt uccx-migration --exclude=node_modules --exclude=dist

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "app_backup_*.tar.gz" -mtime +7 -delete

echo "$(date): Backup process completed" >> $LOG_FILE
echo "$(date): Backup files created:" >> $LOG_FILE
echo "  - Database: $BACKUP_DIR/db_backup_$DATE.sql" >> $LOG_FILE
echo "  - Application: $BACKUP_DIR/app_backup_$DATE.tar.gz" >> $LOG_FILE
```

### Create Monitoring Script

Create `/opt/uccx-migration/scripts/monitor.sh`:

```bash
#!/bin/bash

LOG_FILE="/var/log/uccx-migration/monitor.log"
APP_NAME="uccx-migration"

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S'): $1" >> $LOG_FILE
}

# Check if PM2 process is running
if ! pm2 describe $APP_NAME > /dev/null 2>&1; then
    log_message "ERROR: $APP_NAME is not running, attempting restart"
    pm2 restart $APP_NAME
    
    # Wait a moment and check again
    sleep 5
    if pm2 describe $APP_NAME > /dev/null 2>&1; then
        log_message "SUCCESS: $APP_NAME restarted successfully"
    else
        log_message "CRITICAL: Failed to restart $APP_NAME"
        # Send alert (add your notification method here)
        # mail -s "UCCX Migration Tool Down" admin@yourdomain.com < /dev/null
    fi
else
    # Check if application is responding
    if curl -f -s http://localhost:5000/health > /dev/null; then
        log_message "INFO: $APP_NAME health check passed"
    else
        log_message "WARNING: $APP_NAME health check failed"
        pm2 restart $APP_NAME
        log_message "INFO: $APP_NAME restarted due to health check failure"
    fi
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    log_message "WARNING: Disk usage is ${DISK_USAGE}%"
fi

# Check memory usage
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3/$2*100}')
if [ $MEMORY_USAGE -gt 80 ]; then
    log_message "WARNING: Memory usage is ${MEMORY_USAGE}%"
fi
```

### Make Scripts Executable

```bash
# Create scripts directory
mkdir -p /opt/uccx-migration/scripts

# Make scripts executable
chmod +x /opt/uccx-migration/scripts/backup.sh
chmod +x /opt/uccx-migration/scripts/monitor.sh

# Create log directory
sudo mkdir -p /var/log/uccx-migration
sudo chown $USER:$USER /var/log/uccx-migration
```

### Configure Cron Jobs

```bash
# Edit crontab
crontab -e

# Add the following lines:
# Backup database daily at 2:00 AM
0 2 * * * /opt/uccx-migration/scripts/backup.sh

# Monitor application every 5 minutes
*/5 * * * * /opt/uccx-migration/scripts/monitor.sh

# Restart application weekly on Sunday at 3:00 AM (optional)
0 3 * * 0 /usr/bin/pm2 restart uccx-migration
```

---

## Initial Setup & Testing

### Start Application

```bash
# Navigate to application directory
cd /opt/uccx-migration

# Start with PM2
pm2 restart uccx-migration

# Check PM2 status
pm2 status

# View logs
pm2 logs uccx-migration --lines 50
```

### Test Application Access

```bash
# Test local access
curl -I http://localhost:5000

# Test external access (replace with your domain)
curl -I https://your-domain.com

# Test specific endpoints
curl https://your-domain.com/health
curl https://your-domain.com/api/statistics
```

### Verify Services

```bash
# Check Nginx status
sudo systemctl status nginx

# Check PostgreSQL status
sudo systemctl status postgresql

# Check SSL certificate
sudo certbot certificates

# Test database connection
sudo -u postgres psql -d uccx_migration -c "SELECT current_database();"
```

---

## Security Hardening

### System Security

```bash
# Update all packages
sudo apt update && sudo apt upgrade -y

# Install and configure fail2ban for SSH protection
sudo apt install fail2ban -y

# Create custom fail2ban configuration
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local
# Modify settings as needed (bantime, findtime, maxretry)

# Start fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### SSH Security

```bash
# Backup SSH configuration
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# Disable root login
sudo sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

# Disable password authentication (if using SSH keys)
# sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

# Change default SSH port (optional)
# sudo sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config

# Restart SSH service
sudo systemctl restart ssh
```

### PostgreSQL Security

```bash
# Set strong password for postgres user
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'new_secure_password';"

# Restrict PostgreSQL access (edit pg_hba.conf)
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Ensure local connections use md5 authentication

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Application Security

```bash
# Set secure permissions on application files
chmod 600 /opt/uccx-migration/.env
chmod 755 /opt/uccx-migration/scripts/*.sh

# Create dedicated user for application (optional)
sudo useradd -r -s /bin/false uccx
sudo chown -R uccx:uccx /opt/uccx-migration
# Adjust PM2 configuration to run as uccx user
```

---

## Post-Deployment Checklist

### Functional Testing

- [ ] Application loads correctly at your domain
- [ ] SSL certificate is valid and secure
- [ ] Database connection is working
- [ ] File uploads function properly
- [ ] UCCX API connections can be configured and tested
- [ ] All navigation links work correctly
- [ ] Import functionality works with sample files
- [ ] Migration jobs can be created and monitored
- [ ] Audit logs are being recorded

### System Health

- [ ] PM2 process is running and stable
- [ ] Nginx is serving requests correctly
- [ ] PostgreSQL is accepting connections
- [ ] SSL certificate auto-renewal is configured
- [ ] Firewall rules are properly configured
- [ ] Backup scripts are working
- [ ] Monitoring scripts are active
- [ ] Log rotation is configured

### Security Verification

- [ ] Strong passwords are set for all accounts
- [ ] SSH root login is disabled
- [ ] Fail2ban is active and configured
- [ ] SSL security headers are present
- [ ] Database access is restricted
- [ ] File permissions are secure
- [ ] Regular security updates are scheduled

### Performance Optimization

- [ ] Static file caching is working
- [ ] Gzip compression is enabled
- [ ] Database queries are optimized
- [ ] Resource monitoring is in place
- [ ] Log files are being rotated
- [ ] Backup retention policies are set

---

## Troubleshooting

### Common Issues and Solutions

#### Application Won't Start

```bash
# Check PM2 logs
pm2 logs uccx-migration

# Check environment variables
cat /opt/uccx-migration/.env

# Test database connection
sudo -u postgres psql -d uccx_migration -c "SELECT version();"

# Check Node.js version
node --version

# Verify build files exist
ls -la /opt/uccx-migration/dist/
```

#### Database Connection Issues

```bash
# Check PostgreSQL service
sudo systemctl status postgresql

# Test database connection
sudo -u postgres psql -d uccx_migration -c "\dt"

# Check database URL format
echo $DATABASE_URL

# Verify user permissions
sudo -u postgres psql -c "\du"
```

#### Nginx/SSL Issues

```bash
# Check Nginx configuration
sudo nginx -t

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check SSL certificate
sudo certbot certificates

# Test SSL configuration
openssl s_client -connect your-domain.com:443
```

#### Performance Issues

```bash
# Check system resources
htop
free -h
df -h

# Monitor application performance
pm2 monit

# Check database performance
sudo -u postgres psql -d uccx_migration -c "SELECT * FROM pg_stat_activity;"

# Review slow query log
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

### Log File Locations

- **Application Logs:** `/var/log/pm2/uccx-migration.log`
- **Nginx Access:** `/var/log/nginx/access.log`
- **Nginx Error:** `/var/log/nginx/error.log`
- **PostgreSQL:** `/var/log/postgresql/postgresql-*-main.log`
- **System Log:** `/var/log/syslog`
- **Authentication:** `/var/log/auth.log`

### Diagnostic Commands

```bash
# System information
uname -a
lsb_release -a

# Network connectivity
netstat -tulpn | grep LISTEN
ss -tulpn

# Process information
ps aux | grep node
ps aux | grep nginx
ps aux | grep postgres

# Disk and memory usage
df -h
free -h
du -sh /opt/uccx-migration/

# Service status
systemctl status nginx postgresql pm2-$USER

# Check open files
lsof -i :5000
lsof -i :80
lsof -i :443
```

### Emergency Recovery

#### Application Recovery

```bash
# Stop all services
pm2 stop all
sudo systemctl stop nginx

# Restore from backup
cd /opt/backups/uccx-migration
tar -xzf app_backup_YYYYMMDD_HHMMSS.tar.gz -C /opt/

# Restore database
sudo -u postgres psql -d uccx_migration < db_backup_YYYYMMDD_HHMMSS.sql

# Restart services
sudo systemctl start nginx
pm2 restart uccx-migration
```

#### Database Recovery

```bash
# Create new database
sudo -u postgres createdb uccx_migration_new

# Restore from backup
sudo -u postgres psql -d uccx_migration_new < db_backup_YYYYMMDD_HHMMSS.sql

# Update database URL and restart application
```

---

## Support and Maintenance

### Regular Maintenance Tasks

**Daily:**
- Monitor application logs
- Check system resources
- Verify backup completion

**Weekly:**
- Review security logs
- Update system packages
- Check SSL certificate status
- Review performance metrics

**Monthly:**
- Update Node.js dependencies
- Review and rotate log files
- Test backup and recovery procedures
- Security audit and updates

### Contact Information

For technical support and questions:

- **Documentation:** This deployment guide
- **Application Logs:** `/var/log/pm2/uccx-migration.log`
- **System Administrator:** [Your contact information]

---

## Conclusion

This deployment guide provides a complete production-ready setup for the UCCX Migration Tool. Following these instructions will result in a secure, monitored, and maintainable installation suitable for enterprise use.

Remember to:
- Keep all software components updated
- Monitor system performance regularly  
- Maintain regular backups
- Follow security best practices
- Document any customizations made to your specific environment

---

**Document Version:** 1.0  
**Last Updated:** September 2025  
**Next Review:** December 2025