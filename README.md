# UCCX Migration Tool

A web-based migration utility for moving Cisco Unified Contact Center Express (UCCX) configuration from an existing cluster to a new cluster.

The tool helps administrators import configuration from a live UCCX system or XML files, review and validate the imported data, and migrate supported objects to a target UCCX cluster with progress tracking and audit logs.

## Supported Configuration Types

- Skills
- Resource Groups
- Contact Service Queues (CSQs)
- Resources and agents
- Teams
- Applications
- Triggers

> **Important:** System configuration, high-availability configuration, CUCM integration, and CTI port configuration are outside the scope of this tool and must be migrated separately.

## Common Use Cases

- Migrating from an older UCCX cluster to a newly built cluster
- Avoiding a complex multi-stage in-place upgrade
- Moving UCCX services to new virtualisation infrastructure
- Recreating a production configuration in a lab or test environment
- Reviewing and validating configuration before migration

## Installation

The automated installer is designed for a fresh Ubuntu or Debian server.

It installs and configures the required components, including:

- Git
- Node.js and npm
- PostgreSQL
- PM2
- Nginx
- Application dependencies
- Database schema
- UCCX Migration Tool source code

The installer also builds the application, starts it with PM2, configures automatic startup, and creates an Nginx reverse proxy.

### Easy Installation

Run the following commands as your normal Linux user. The installer will request `sudo` access when required.

```bash
sudo apt update
sudo apt install -y curl

curl -fsSL https://quatatek.com.au/devops/UCCXMigrate-r1-Install.sh | bash
```

> Do not run the entire installer as the root user. Running it as your normal user ensures that PM2 is configured for the correct account.

### Download and Run the Installer

Download the installer first if you would like to inspect it before execution:

```bash
curl -fL \
  -o UCCXMigrate-r1-Install.sh \
  https://quatatek.com.au/devops/UCCXMigrate-r1-Install.sh

chmod +x UCCXMigrate-r1-Install.sh
./UCCXMigrate-r1-Install.sh
```

The installer clones the application repository automatically. You do not need to clone the repository manually.

## After Installation

Open the application in a browser using the server IP address or DNS name:

```text
http://SERVER-IP/
```

Check the health endpoint:

```bash
curl -fsS http://127.0.0.1/health
```

Expected output:

```text
healthy
```

Check the PM2 process:

```bash
pm2 status
```

The `uccx-migration` process should show as `online`.

## Application Management

View application logs:

```bash
pm2 logs uccx-migration
```

Restart the application:

```bash
pm2 restart uccx-migration
```

Save the PM2 process list:

```bash
pm2 save
```

Check whether the PM2 startup service is enabled:

```bash
systemctl is-enabled pm2-"$(whoami)"
```

Check the Nginx service:

```bash
systemctl status nginx
```

Check the PostgreSQL service:

```bash
systemctl status postgresql
```

## Installation Locations

The default installation uses:

```text
Application:  /opt/uccx-migration
Environment:  /opt/uccx-migration/.env
PM2 data:     ~/.pm2
```

Generated credentials and secrets are displayed at the end of the installation. Store them securely and change the initial administrator password after the first login.

## Network Requirements

The server must be able to:

- Accept HTTP traffic on TCP port 80
- Accept HTTPS traffic on TCP port 443 when TLS is configured
- Reach the source and target UCCX REST API services
- Access GitHub and the required Ubuntu or Debian package repositories during installation

Port 5000 is used internally by the application and is normally accessed through Nginx.

## Troubleshooting

Check application status:

```bash
pm2 status
```

View recent logs:

```bash
pm2 logs uccx-migration --lines 100 --nostream
```

Confirm that the application is listening:

```bash
curl -fsS http://127.0.0.1:5000/
```

Confirm that Nginx can reach the application:

```bash
curl -fsS http://127.0.0.1/health
```

Test the Nginx configuration:

```bash
sudo nginx -t
```

## Documentation

See [USER_GUIDE.md](USER_GUIDE.md) for application usage, projects, UCCX connections, configuration imports, migrations, permissions, and troubleshooting.

See [UCCX-Migration-Tool-Deployment-Guide.md](UCCX-Migration-Tool-Deployment-Guide.md) for detailed deployment information.

## QuataTek Resources

- Website: [QuataTek](https://www.quatatek.com.au)
- YouTube: [QuataTek Devs](https://www.youtube.com/@devsQuataTek)

## Security Notes

- Change the initial administrator password immediately after first login.
- Keep `/opt/uccx-migration/.env` private.
- Do not commit database passwords, session secrets, or administrator credentials to Git.
- Use HTTPS for production deployments.
- Restrict direct access to application port 5000 when Nginx is in use.
- Use a dedicated UCCX API account with only the permissions required for migration.

## Disclaimer

This project is an independent migration utility and is not affiliated with or endorsed by Cisco Systems, Inc. Test all migrations in a non-production environment and validate the target configuration before production cutover.
