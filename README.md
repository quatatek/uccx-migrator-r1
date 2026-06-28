# UCCX Migration Tool

A web-based utility for migrating supported Cisco Unified Contact Center Express (UCCX) configuration from an existing cluster to a new cluster.

The application allows administrators to import configuration from a live UCCX system or an exported XML file, review and validate the imported data, and migrate supported objects to a target UCCX cluster. It also provides migration progress tracking, project-based access control, and audit logs.

## Features

- Import configuration from a live UCCX system through the REST API
- Import configuration from exported XML files
- Review, edit, and validate imported configuration
- Organise migration work into projects
- Control user and project permissions
- Track migration progress
- Maintain operational and audit logs
- Manage source and target UCCX connections

## Supported Configuration Types

- Skills
- Resource Groups
- Contact Service Queues (CSQs)
- Resources and agents
- Teams
- Applications
- Triggers

> **Important:** System configuration, high-availability configuration, CUCM integration, CTI port configuration, and other system-specific settings are outside the scope of this tool and must be migrated separately.

## Common Use Cases

- Migrating from an older UCCX cluster to a newly built cluster
- Avoiding a complex multi-stage in-place upgrade
- Moving UCCX services to new virtualisation infrastructure
- Recreating a production configuration in a lab or test environment
- Reviewing and validating configuration before migration

## Server Requirements

The automated installer is intended for a fresh Ubuntu or Debian server.

Recommended starting point:

- Ubuntu Server 22.04 LTS or 24.04 LTS
- Debian 12
- 2 vCPUs
- 2 GB RAM or more
- 20 GB available disk space
- A static IP address or DNS record
- Network access to the source and target UCCX systems

### Internet Connection Required

The server must have working internet access during installation.

The installer downloads:

- The UCCX Migration Tool source code from GitHub
- Ubuntu or Debian operating system packages
- Node.js and npm packages
- PostgreSQL components
- PM2
- Nginx
- Other build and runtime prerequisites

The server must be able to access GitHub, NodeSource, npm, the QuataTek installer URL, and the configured Ubuntu or Debian package repositories.

## Installation

The automated installer performs the complete setup, including:

- Installing Git, Node.js, npm, PostgreSQL, PM2, Nginx, and build tools
- Cloning the application repository
- Creating the PostgreSQL database and application user
- Generating database, session, and administrator credentials
- Installing application dependencies
- Applying the database schema
- Building the application
- Starting the application with PM2
- Registering PM2 for startup after reboot
- Configuring Nginx as a reverse proxy
- Running installation health checks

Run the installer as your normal Linux user. It will request `sudo` access when required.

Do not start the entire installer as the root user, because PM2 should be configured for the normal account that will manage the application.

### Easy Installation

On a fresh Ubuntu or Debian server:

```bash
sudo apt update
sudo apt install -y curl

curl -fsSL https://quatatek.com.au/devops/UCCXMigrate-r1-Install.sh | bash
```

> **Security note:** Piping a remote script directly to Bash is convenient, but it does not give you an opportunity to inspect the script first. For security-sensitive environments, use the download method below.

### Download, Review, and Run the Installer

Download the installer:

```bash
curl -fL \
  -o UCCXMigrate-r1-Install.sh \
  https://quatatek.com.au/devops/UCCXMigrate-r1-Install.sh
```

Review the installer:

```bash
less UCCXMigrate-r1-Install.sh
```

Validate its Bash syntax:

```bash
bash -n UCCXMigrate-r1-Install.sh
```

Make it executable and run it:

```bash
chmod +x UCCXMigrate-r1-Install.sh
./UCCXMigrate-r1-Install.sh
```

The installer clones the GitHub repository automatically. You do not need to clone the repository manually.

## After Installation

Open the application in a browser:

```text
http://SERVER-IP/
```

Replace `SERVER-IP` with the IP address or DNS name of the Ubuntu or Debian server.

### Health Check

Run:

```bash
curl -fsS http://127.0.0.1/health
```

Expected output:

```text
healthy
```

### Check the Application Process

Run:

```bash
pm2 status
```

The `uccx-migration` process should show as `online`.

### Retrieve the Generated Credentials

The installer stores the generated database and initial administrator credentials in:

```text
/root/uccx-migrator-install-credentials.txt
```

Read the file with:

```bash
sudo cat /root/uccx-migrator-install-credentials.txt
```

The file is restricted to the root user. Store the credentials securely and change the initial administrator password after the first login.

## Installation Locations

The default installation uses:

```text
Application directory:  /opt/uccx-migration
Environment file:       /opt/uccx-migration/.env
Uploaded files:         /opt/uccx-migration/uploads
PM2 data:               ~/.pm2
PM2 logs:               /var/log/pm2
Credentials file:       /root/uccx-migrator-install-credentials.txt
Nginx site:             /etc/nginx/sites-available/uccx-migration
```

## Application Management

### Check Status

```bash
pm2 status
```

### View Logs

Stream live logs:

```bash
pm2 logs uccx-migration
```

Show the latest 100 lines without following the log:

```bash
pm2 logs uccx-migration --lines 100 --nostream
```

### Restart the Application

```bash
pm2 restart uccx-migration
```

### Stop the Application

```bash
pm2 stop uccx-migration
```

### Save the PM2 Process List

```bash
pm2 save
```

### Check Automatic Startup

```bash
systemctl is-enabled pm2-"$(whoami)"
systemctl is-active pm2-"$(whoami)"
```

Expected output after successful startup registration:

```text
enabled
active
```

### Check Nginx

```bash
systemctl status nginx
sudo nginx -t
```

### Check PostgreSQL

```bash
systemctl status postgresql
```

## Network Requirements

The server may require the following connectivity:

| Direction | Port | Purpose |
|---|---:|---|
| Inbound | TCP 80 | HTTP access through Nginx |
| Inbound | TCP 443 | HTTPS access when TLS is configured |
| Local only | TCP 5000 | Application service behind Nginx |
| Outbound | TCP 443 | GitHub, npm, NodeSource, package downloads, and HTTPS UCCX APIs |
| Outbound | TCP 8443 | Common UCCX HTTPS REST API port |
| Outbound | TCP 8080 | Common UCCX HTTP REST API port |
| Local/Outbound | TCP 5432 | PostgreSQL, when using a local or remote database |

Port numbers for UCCX may vary by deployment. Confirm the REST API ports used by the source and target systems.

When Nginx is enabled, port 5000 should not normally be exposed to external networks.

## Updating the Application

The installer downloads the configured repository branch, which defaults to `main`.

Before updating a production system:

1. Back up the PostgreSQL database.
2. Back up `/opt/uccx-migration/.env`.
3. Back up any required files under `/opt/uccx-migration/uploads`.
4. Review the release notes or recent repository changes.
5. Run the latest installer again.

Example PostgreSQL backup:

```bash
sudo -u postgres pg_dump uccx_migration \
  > "uccx_migration-$(date +%Y%m%d-%H%M%S).sql"
```

For controlled production deployments, use a tested tagged release rather than an unreviewed development commit whenever versioned releases are available.

## Troubleshooting

### Application Is Not Online

```bash
pm2 status
pm2 logs uccx-migration --lines 100 --nostream
```

### Test the Application Directly

```bash
curl -fsS http://127.0.0.1:5000/
```

### Test Through Nginx

```bash
curl -fsS http://127.0.0.1/health
```

### Check Listening Ports

```bash
sudo ss -ltnp | grep -E ':80|:443|:5000|:5432'
```

### Check PM2 Startup Service

```bash
systemctl status pm2-"$(whoami)" --no-pager
sudo journalctl -u pm2-"$(whoami)" -n 100 --no-pager
```

### Test Nginx Configuration

```bash
sudo nginx -t
```

## Security Recommendations

- Change the initial administrator password immediately after first login.
- Keep `/opt/uccx-migration/.env` private and restricted to the application user.
- Do not commit database passwords, administrator passwords, session secrets, UCCX credentials, or customer configuration to Git.
- Do not place real credentials in `ecosystem.config.cjs` or other repository files.
- Use long, randomly generated database and session secrets.
- Use HTTPS for production deployments.
- Restrict direct external access to application port 5000.
- Restrict PostgreSQL port 5432 to authorised hosts.
- Use a dedicated UCCX API account with only the permissions required for migration.
- Test the application and migration process in a non-production environment first.
- Back up the target UCCX environment before performing a migration.
- Review all imported and mapped configuration before production cutover.

## Documentation

- [User Guide](USER_GUIDE.md)
- [Deployment Guide](UCCX-Migration-Tool-Deployment-Guide.md)

The User Guide covers projects, users, UCCX connections, XML and API imports, configuration review, migrations, permissions, audit logs, and troubleshooting.

## QuataTek Resources

- Website: [QuataTek](https://www.quatatek.com.au)
- YouTube: [QuataTek Devs](https://www.youtube.com/@devsQuataTek)

The QuataTek YouTube channel includes the installation process and demonstrations of the UCCX Migration Tool.

## License

The project package metadata declares the MIT License. A standalone `LICENSE` file should also be included in the repository root so that the licence terms are clear to users and contributors.

## Disclaimer

This project is an independent migration utility and is not affiliated with or endorsed by Cisco Systems, Inc.

Test all migrations in a non-production environment and validate the target configuration before production cutover. The user is responsible for verifying compatibility, data accuracy, backups, security controls, and migration results.
