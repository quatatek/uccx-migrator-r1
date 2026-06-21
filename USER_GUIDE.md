# UCCX Migration Tool — User Guide

Version 1.0 | Enterprise Configuration Management

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Requirements](#2-system-requirements)
3. [Installation & Setup](#3-installation--setup)
4. [First Login](#4-first-login)
5. [User Management](#5-user-management)
6. [Projects](#6-projects)
7. [Servers (UCCX Connections)](#7-servers-uccx-connections)
8. [Importing Configurations](#8-importing-configurations)
9. [Configurations](#9-configurations)
10. [Running a Migration](#10-running-a-migration)
11. [Logs & Audit Trail](#11-logs--audit-trail)
12. [Branding](#12-branding)
13. [Permissions Reference](#13-permissions-reference)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Overview

The UCCX Migration Tool is a web-based application for enterprise administrators who need to move Cisco Unified Contact Center Express (UCCX) configurations from one system to another. Instead of manually re-entering every skill, agent, queue, and application setting on the target system, this tool lets you:

- Import the full configuration from a live UCCX system via its API, or from an exported XML file
- Review, edit, and validate the configuration in a structured UI
- Push the configuration to a target UCCX system with full progress tracking
- Audit every action with a detailed log

**Supported configuration types:**
Skills · Resource Groups · CSQs (Contact Service Queues) · Resources (Agents) · Teams · Applications · Triggers

**Not supported:**
The following UCCX configuration areas are outside the scope of this tool and must be handled manually:

- System Configuration
- High Availability Configuration
- CUCM Integration Configuration
- CTI Port Configuration

---

## 2. System Requirements

### Recommended Operating System

**Linux is the recommended platform for self-hosting.** The instructions in this guide are written for:

- **Ubuntu 22.04 LTS** (Jammy Jellyfish) — recommended
- **Ubuntu 20.04 LTS** (Focal Fossa)
- **Debian 11** (Bullseye) or **Debian 12** (Bookworm)

Other Linux distributions work with minor adjustments to package manager commands. Windows and macOS are supported for development but not recommended for production.

---

### Hardware Requirements

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 1 vCPU | 2 vCPUs |
| RAM | 1 GB | 2 GB |
| Disk | 10 GB free | 20 GB free |
| Network | Must reach source and target UCCX REST API ports | Dedicated NIC with static IP |

---

### Software Requirements

| Component | Version | Purpose |
|---|---|---|
| **Node.js** | 20 LTS or later (18 minimum) | Runs the application server |
| **npm** | 9 or later (bundled with Node.js) | Installs JavaScript dependencies |
| **PostgreSQL** | 15 or later (14 minimum) | Stores all application data |
| **PM2** | Latest | Keeps the app running as a background service with auto-restart |
| **nginx** | Latest stable | Reverse proxy — handles HTTPS, forwards traffic to the app |
| **Git** | 2.x | Clones the repository |
| **certbot** | Latest | Obtains free Let's Encrypt SSL certificates (optional, for HTTPS) |

---

### Network / Firewall Requirements

The server hosting this tool must have:

| Direction | Port | Protocol | Purpose |
|---|---|---|---|
| Inbound | 80 | TCP | HTTP (redirected to HTTPS by nginx) |
| Inbound | 443 | TCP | HTTPS (nginx, if SSL is configured) |
| Inbound | 5000 | TCP | Direct app access (block externally if using nginx) |
| Outbound | 8443 or 8080 | TCP | UCCX REST API on source/target systems |
| Outbound | 5432 | TCP | PostgreSQL (only if using a remote database server) |

---

### UCCX Compatibility

The tool communicates with UCCX systems over their REST API (HTTP or HTTPS). Confirm the following before connecting:

- The UCCX REST API is enabled on the source and/or target system
- A dedicated UCCX administrator account with API access is available
- Firewall rules allow the tool to reach the UCCX host on the configured port (default: 8443)
- UCCX version 11.0 or later is required for full REST API support

---

### Browser Requirements

Any modern browser works. Tested on:

| Browser | Minimum Version |
|---|---|
| Google Chrome | 110+ |
| Microsoft Edge | 110+ |
| Mozilla Firefox | 110+ |
| Safari | 16+ |

---

## 3. Installation & Setup

### Option A — Replit (Recommended for Cloud)

1. Open the project in Replit.
2. Click **Run**. The application starts automatically.
3. The app is available at the URL shown in the Replit preview pane.
4. A default admin account is created on first run (see [First Login](#4-first-login)).

No additional software installation is required. Replit manages the database, runtime, and hosting automatically.

---

### Option B — Self-Hosted on Linux (Ubuntu / Debian)

Follow these steps in order on a fresh Ubuntu 22.04 or Debian 12 server.

---

#### Step 1 — Update the System

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

---

#### Step 2 — Install Node.js 20 LTS

Use the official NodeSource repository to get the current LTS version. Do **not** use the version from the default `apt` repository — it is usually outdated.

```bash
# Download and run the NodeSource setup script for Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js (npm is included automatically)
sudo apt install -y nodejs

# Verify the installation
node --version    # Should print v20.x.x
npm --version     # Should print 10.x.x or later
```

---

#### Step 3 — Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL and enable it to start on boot
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify it is running
sudo systemctl status postgresql
```

**Create the application database and user:**

```bash
# Switch to the postgres system account
sudo -i -u postgres

# Open the PostgreSQL interactive shell
psql

# Run the following commands inside psql:
CREATE DATABASE uccx_migration;
CREATE USER uccxapp WITH ENCRYPTED PASSWORD 'choose-a-strong-password';
GRANT ALL PRIVILEGES ON DATABASE uccx_migration TO uccxapp;

# Connect to the new database and grant schema permissions
\c uccx_migration
GRANT ALL ON SCHEMA public TO uccxapp;

# Exit psql
\q

# Exit the postgres user session
exit
```

**Verify you can connect with the new credentials:**

```bash
psql -U uccxapp -d uccx_migration -h localhost -W
# Enter the password you chose above; if you see the psql prompt, it works.
# Type \q to exit.
```

---

#### Step 4 — Install PM2 (Process Manager)

PM2 keeps the application running in the background, restarts it if it crashes, and starts it automatically on server reboot.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify the installation
pm2 --version
```

---

#### Step 5 — Install nginx (Reverse Proxy)

```bash
sudo apt install -y nginx

sudo systemctl start nginx
sudo systemctl enable nginx

# Verify nginx is running
sudo systemctl status nginx
```

---

#### Step 6 — Clone the Application

```bash
# Create a directory for the application
sudo mkdir -p /opt/uccx-migration
sudo chown $USER:$USER /opt/uccx-migration

# Clone the repository
git clone <repository-url> /opt/uccx-migration

# Enter the project directory
cd /opt/uccx-migration

# Install all JavaScript dependencies
npm install
```

---

#### Step 7 — Configure Environment Variables

Create a `.env` file in the project root. This file holds all sensitive configuration and must **never** be committed to version control.

```bash
nano /opt/uccx-migration/.env
```

Paste and edit the following content:

```env
# -------------------------------------------------------
# Database
# -------------------------------------------------------
# Replace 'choose-a-strong-password' with the password
# you set in Step 3.
DATABASE_URL=postgresql://uccxapp:choose-a-strong-password@localhost:5432/uccx_migration

# -------------------------------------------------------
# Application
# -------------------------------------------------------
NODE_ENV=production

# Port the app listens on internally (nginx proxies to this)
PORT=5000

# -------------------------------------------------------
# Admin account
# -------------------------------------------------------
# This password is used the FIRST time the app starts to
# create the default admin account. Change it immediately
# after first login, then you can remove this line.
ADMIN_PASSWORD=choose-a-very-strong-admin-password

# -------------------------------------------------------
# Session security
# -------------------------------------------------------
# Set both to true when serving over HTTPS (recommended)
COOKIE_SECURE=true
TRUST_PROXY=true

# A long random string used to sign session cookies.
# Generate one with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
SESSION_SECRET=replace-with-a-long-random-string
```

Save and close the file (`Ctrl+O`, `Enter`, `Ctrl+X` in nano).

**Restrict permissions** so only the current user can read the file:
```bash
chmod 600 /opt/uccx-migration/.env
```

---

#### Step 8 — Initialize the Database Schema

```bash
cd /opt/uccx-migration
npm run db:push
```

This creates all the required tables in PostgreSQL. You should see confirmation messages for each table. Run this command again any time the application is updated to apply schema changes.

---

#### Step 9 — Build the Application

```bash
cd /opt/uccx-migration
npm run build
```

This compiles the frontend and bundles the backend for production. The output goes into the `dist/` directory.

---

#### Step 10 — Start the Application with PM2

```bash
cd /opt/uccx-migration

# Start the app under PM2
pm2 start dist/index.js --name uccx-migration --env production

# Save the PM2 process list so it restarts after a server reboot
pm2 save

# Configure PM2 to start automatically on system boot
pm2 startup
# PM2 will print a command — copy it and run it (it starts with "sudo env PATH=...")
```

**Useful PM2 commands:**

```bash
pm2 status                        # Show all running processes
pm2 logs uccx-migration           # Stream live application logs
pm2 logs uccx-migration --lines 100  # Show last 100 log lines
pm2 restart uccx-migration        # Restart the app
pm2 stop uccx-migration           # Stop the app
pm2 delete uccx-migration         # Remove from PM2 entirely
```

---

#### Step 11 — Configure nginx as a Reverse Proxy

nginx sits in front of the application and handles incoming web requests. This lets you serve the app on port 80/443 without running Node.js as root.

**Create an nginx site configuration:**

```bash
sudo nano /etc/nginx/sites-available/uccx-migration
```

Paste the following (replace `your-domain.com` with your actual domain or server IP):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Increase the upload size limit to match the app's 10 MB limit
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (required for live reload / real-time updates)
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 120s;
    }
}
```

**Enable the site and reload nginx:**

```bash
# Create a symlink to enable the site
sudo ln -s /etc/nginx/sites-available/uccx-migration /etc/nginx/sites-enabled/

# Remove the default placeholder site (optional)
sudo rm -f /etc/nginx/sites-enabled/default

# Test the configuration for syntax errors
sudo nginx -t

# Reload nginx to apply the changes
sudo systemctl reload nginx
```

The application should now be accessible at `http://your-domain.com`.

---

#### Step 12 — Enable HTTPS with Let's Encrypt (Recommended)

HTTPS is strongly recommended for any production deployment. Certbot automates the certificate process.

```bash
# Install Certbot and the nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# Obtain and install a certificate
# Replace 'your-domain.com' with your actual domain
sudo certbot --nginx -d your-domain.com

# Follow the prompts:
# - Enter your email address (for renewal reminders)
# - Agree to the terms of service
# - Choose whether to redirect HTTP to HTTPS (choose Yes / option 2)
```

Certbot will automatically update your nginx configuration to handle HTTPS and set up a cron job to renew the certificate before it expires (certificates last 90 days and renew automatically).

**Verify automatic renewal:**
```bash
sudo certbot renew --dry-run
```

---

#### Step 13 — Configure the Firewall (ufw)

```bash
# Allow SSH so you don't lock yourself out
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS through nginx
sudo ufw allow 'Nginx Full'

# Block direct access to the app port (nginx handles it)
sudo ufw deny 5000

# Enable the firewall
sudo ufw enable

# Check the status
sudo ufw status
```

---

#### Updating the Application

When a new version is released:

```bash
cd /opt/uccx-migration

# Pull the latest code
git pull

# Install any new dependencies
npm install

# Apply any database schema changes
npm run db:push

# Rebuild the frontend and backend
npm run build

# Restart the app via PM2
pm2 restart uccx-migration
```

---

#### Quick-Start Summary (All Steps)

```bash
# 1. System update
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx

# 2. Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql

# 4. PM2
sudo npm install -g pm2

# 5. Clone and install
sudo mkdir -p /opt/uccx-migration && sudo chown $USER:$USER /opt/uccx-migration
git clone <repository-url> /opt/uccx-migration
cd /opt/uccx-migration && npm install

# 6. Configure .env (edit with your values)
cp .env.example .env   # or create manually as shown in Step 7
nano .env

# 7. Database schema
npm run db:push

# 8. Build
npm run build

# 9. Start with PM2
pm2 start dist/index.js --name uccx-migration --env production
pm2 save && pm2 startup

# 10. nginx config + HTTPS
sudo ln -s /etc/nginx/sites-available/uccx-migration /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com
```

---

## 4. First Login

![Login Page](docs/screenshots/01-login.jpg)

When the application starts for the first time it automatically creates a default administrator account:

| Field | Value |
|---|---|
| Username | `admin` |
| Password | Value of `ADMIN_PASSWORD` env var, or `admin` if not set |

**Steps:**

1. Navigate to the application URL in your browser.
2. Enter `admin` as the username and your configured password.
3. Click **Sign In**.
4. You will be taken to the **Projects** page to create your first project.

> **Security note:** Change the admin password immediately after the first login. Go to the user menu (top-right) → **Users** → find the `admin` account → **Edit** → enter a new password.

---

## 5. User Management

![User Management](docs/screenshots/15-users.jpg)

*Requires admin role.*

Navigate to the user menu (top-right corner) → **Users**.

### Creating a User

1. Click **Add User**.
2. Fill in the required fields:
   - **Username** — must be unique, minimum 3 characters
   - **Password** — minimum 6 characters
   - **Role** — choose `admin` (full access) or `user` (standard access)
   - **First name, Last name, Email** — optional but recommended
3. Click **Create User**.

### Editing a User

Click the **Edit** (pencil) icon on any user row. You can change the name, email, role, and active status. Leave the password field blank to keep the existing password.

### Disabling a User

Toggle **Active** to off in the edit dialog. Disabled users cannot log in but their data and audit history are preserved.

### Deleting a User

Click the **Delete** (trash) icon. This action is permanent. You cannot delete your own account.

### Roles

| Role | Capabilities |
|---|---|
| `admin` | Everything: user management, all projects, branding, system settings |
| `user` | Access only to projects they own or are invited to, with permissions set by the project admin |

---

## 6. Projects

![Projects](docs/screenshots/02-projects.jpg)

All configuration data is organized inside **projects**. After selecting a project you land on the **Dashboard**, which shows a summary of all imported configurations and recent activity.

![Dashboard](docs/screenshots/03-dashboard.jpg)

A project represents one migration effort — for example, migrating the London contact center to a new UCCX cluster.

### Creating a Project

1. After login you land on the **Projects** page. You can always return here from the header logo or the user menu → **Projects**.
2. Click **New Project**.
3. Enter a **Name** and optional **Description**.
4. Choose a **Log Level** (the minimum severity of events written to the audit log):
   - `debug` — everything including verbose API calls
   - `info` — normal operations (recommended for most use)
   - `warning` — only warnings and errors
   - `error` — errors only
5. Click **Create Project**.

### Selecting a Project

Click **Open** (or the arrow button) on any project card to make it the active project. The active project name appears in the header. All subsequent work — importing, configurations, migrations — applies to the selected project.

### Inviting Team Members

1. Open a project and click **Manage Members** (or the team icon).
2. Search for a user by username.
3. Set their permissions (see [Permissions Reference](#13-permissions-reference)).
4. Click **Add Member**.

### Editing or Deleting a Project

- Click the **Edit** icon on the project card to rename or update the description.
- Click **Delete** to permanently remove the project and all its data. This cannot be undone.

---

## 7. Servers (UCCX Connections)

![Servers](docs/screenshots/04-servers.jpg)

Servers are the UCCX systems the tool communicates with. Each project maintains its own list of source and target servers.

Navigate to **Servers** in the top navigation bar.

### Server Types

| Type | Purpose |
|---|---|
| **Source** | The system you are migrating *from*. Used to import the current configuration via the live API. |
| **Target** | The system you are migrating *to*. The tool provisions configuration items here during migration. |

### Adding a Server

1. Select the **Source Systems** or **Target Systems** tab.
2. Click **Add Source System** (or **Add Target System**).
3. Fill in the form:
   - **Name** — a friendly label (e.g., "London UCCX Primary")
   - **Host** — IP address or FQDN of the UCCX server
   - **Port** — REST API port (typically `8443` for HTTPS or `8080` for HTTP)
   - **Username / Password** — UCCX administrator credentials
   - **Use HTTPS** — recommended; enable unless the server only supports plain HTTP
4. Click **Save**.

### Testing a Connection

After saving, click the **Test** (flask) icon next to the server. The tool attempts to authenticate against the UCCX REST API and reports success or failure. A failed test shows the specific error (authentication failure, host unreachable, SSL error, etc.).

### Editing or Removing a Server

Use the **Edit** (pencil) and **Delete** (trash) icons in the server table. Credentials are stored encrypted in the database.

---

## 8. Importing Configurations

![Import Configuration](docs/screenshots/05-import.jpg)

Navigate to **Import Configuration** in the navigation bar.

There are two import methods. Both populate the same internal data store.

---

### Method 1 — File Upload (XML)

Use this when you have an exported UCCX configuration XML file.

1. Select the **File Upload** tab.
2. Give the import a **Name** (e.g., "London UCCX Backup 2026-05-07").
3. Optionally add a **Description**.
4. Drag and drop the XML file onto the upload area, or click to browse.
5. Leave **Auto Process** checked to parse and store the data immediately.
6. Click **Import Configuration**.

The tool will parse the XML, detect all configuration types present, and store the records in the project. A progress indicator shows the import status.

---

### Method 2 — API Import (Live System)

Use this to pull the current configuration directly from a running UCCX system.

1. Select the **API Import** tab.
2. Choose a **Source System** from the dropdown (systems you added in [Servers](#7-servers-uccx-connections)).
3. Select which configuration types to import using the checkboxes:
   - Skills
   - Resource Groups
   - CSQs
   - Resources (Agents)
   - Teams
   - Applications
   - Triggers
4. Click **Import from API**.

The tool connects to the UCCX API, retrieves each selected configuration type, and stores the results. Depending on the number of records, this typically takes 10–60 seconds.

---

### Snapshots

Before making large changes, you can take a **snapshot** of the current project data to preserve it as a restore point.

- Click **Create Snapshot** at the top of the Import page.
- Existing snapshots are listed below. Click **Restore** on any snapshot to roll back all project configuration data to that point.

> Snapshots capture all configuration records (Skills, CSQs, Resources, etc.) but not server connections or migration job history.

---

## 9. Configurations

![Configurations Overview](docs/screenshots/06-configurations.jpg)

Navigate to **Configurations** in the navigation bar to see an overview of all configuration types with their record counts.

Click any configuration type (or use the sub-navigation) to view and manage its records.

---

### Skills

![Skills](docs/screenshots/07-skills.jpg)

Skills represent competencies assigned to agents (e.g., "Spanish", "Billing", "Technical Support").

**Columns:** Name · Competence Level · Active status · Source connection · Created date

**Actions:**
- **View** — opens a detail dialog showing all fields and the raw XML
- **Edit** — inline editing of name and competence level
- **Delete** — removes the skill record

---

### Resource Groups

Resource Groups are organizational containers for agents.

**Columns:** Name · Active status · Source connection

**Actions:** View · Edit · Delete

---

### CSQs (Contact Service Queues)

![CSQs](docs/screenshots/08-csqs.jpg)

CSQs define how incoming calls are routed to agents. Each CSQ specifies a selection algorithm and is associated with either Skills or a Resource Group.

**Columns:** Name · Algorithm · Type (skill-based or resource group-based) · Active status

**Actions:**
- **View** — shows the full CSQ definition including associated skills/resource group and thresholds
- **Edit** — update name, algorithm, and queue parameters
- **Delete**

---

### Resources (Agents)

![Resources](docs/screenshots/09-resources.jpg)

Resources are the agents that handle contacts.

**Columns:** Name · User ID · Extension · Active status · Skills assigned

**Actions:**
- **View** — shows agent details, assigned skills with competence levels, and team membership
- **Edit** — update agent attributes
- **Delete**

---

### Teams

![Teams](docs/screenshots/10-teams.jpg)

Teams group agents together for reporting and management purposes.

**Columns:** Name · Agent count · Active status

**Actions:** View · Edit · Delete

---

### Applications

![Applications](docs/screenshots/11-applications.jpg)

Applications are the call-handling scripts associated with triggers on UCCX.

**Columns:** Name · Type · Description · Script

**Actions:** View · Edit · Delete

---

### Triggers

![Triggers](docs/screenshots/12-triggers.jpg)

Triggers are the entry points (phone numbers or CTI route points) that invoke Applications when a call arrives.

**Columns:** Name · Type · Application · Active status

**Actions:** View · Edit · Delete

> **Important — Call Control Group ID:** The Call Control Group ID is system-specific and cannot be mapped automatically. Before running a trigger migration, you must:
> 1. Manually create the required CTI ports on the **target UCCX system**.
> 2. Edit each trigger in the app and update its Call Control Group ID to match the newly created CTI port on the target system.
> 3. Only then run the trigger migration.
>
> Skipping this step will result in triggers being created on the target system with an incorrect or missing Call Control Group ID.

---

### Bulk Operations

On any configuration page you can:
- Use the **search bar** to filter records by name
- Select multiple rows with checkboxes and **delete** in bulk
- Click **View XML** on any record to see the raw XML representation as it would appear in a UCCX export

---

## 10. Running a Migration

![Migration](docs/screenshots/13-migration.jpg)

Navigate to **Migration** in the navigation bar.

Migration pushes the configuration stored in the tool out to a **target UCCX system**.

### Before You Start

Make sure you have:
- At least one **Target System** configured under [Servers](#7-servers-uccx-connections)
- Configuration data imported (via file or API)
- Tested the target system connection successfully

### Creating a Migration Job

1. Under **New Migration Job**, fill in the form:

   **Target System** — select the destination UCCX system from the dropdown.

   **Configuration Items** — check each type you want to migrate:
   - Skills
   - Resource Groups
   - CSQs
   - Resources (Agents)
   - Teams
   - Applications
   - Triggers

   Leave all unchecked to migrate everything.

   **Migration Type:**
   - `Full` — migrate all records of the selected types
   - `Incremental` — migrate only records that have changed since the last migration

   **Migration Mode:**
   - `Live` — immediately provisions records on the target UCCX system via its API
   - `Offline / Dry Run` — simulates the migration and reports what would happen, without making any changes

2. Click **Start Migration**.

### Monitoring Progress

The **Active Migrations** panel shows all currently running or recently completed jobs with:
- Overall progress bar (%)
- Current status: Pending · Running · Completed · Failed · Cancelled
- Start time and elapsed duration
- Error message if the job failed

Click **Cancel** on any running job to stop it. Completed records already provisioned on the target system will remain; the migration simply stops processing further items.

### Migration History

Below the active panel, the **Migration History** table lists all past jobs. For each job you can see:
- Configuration items that were included
- Target system
- Final status and completion time
- Error details for failed jobs

### Dependency Order

The tool automatically provisions configuration types in the correct dependency order regardless of what you selected:

1. Skills (no dependencies)
2. Resource Groups (no dependencies)
3. Resources — requires Skills and Resource Groups to exist first
4. Teams — requires Resources
5. CSQs — requires Skills or Resource Groups
6. Applications (no dependencies)
7. Triggers — requires Applications

If a required dependency is missing on the target system the job will report the specific missing item in the error log.

---

## 11. Logs & Audit Trail

![Logs & Audit](docs/screenshots/14-logs.jpg)

Navigate to **Logs & Audit** in the navigation bar.

Every significant action in the system is recorded — imports, migrations, API calls, configuration changes, and errors.

### Filtering Logs

Use the filter bar at the top to narrow results:

| Filter | Options |
|---|---|
| **Level** | All · Error · Warning · Info · Debug |
| **Category** | All · Import · Migration · API · System |
| **Date Range** | Start date and end date pickers |
| **Search** | Free-text search across message content |

### Log Columns

| Column | Description |
|---|---|
| Timestamp | Date and time the event occurred |
| Level | Error / Warning / Info / Debug |
| Category | Import / Migration / API / System |
| Message | Human-readable description of the event |
| Source | Component that generated the log (e.g., `migration-queue`, `xml-parser`) |

### Pagination

Use the **Previous / Next** buttons at the bottom to page through results. Up to 50 logs are shown per page.

### Downloading Logs

Click **Download** to export the current filtered log view as a CSV file for offline analysis or compliance records.

---

## 12. Branding

![Branding](docs/screenshots/16-branding.jpg)

*Requires admin role.*

Administrators can customize the application name, subtitle, and logo that appears in the header and on the login page.

1. Click the user menu (top-right) → **Branding**.
2. The page shows a live **Preview** of how the header will look.

### Uploading a Logo

1. Click **Upload Image** under the Logo section.
2. Select a PNG, JPG, or SVG file. Maximum size: 2 MB.
3. The preview updates immediately.

### Changing the App Name and Subtitle

Edit the **Application Name** and **Subtitle** fields. Changes are reflected in the live preview in real time.

### Saving

Click **Save Changes** to apply the branding across the entire application. All users will see the updated name, subtitle, and logo on their next page load.

### Resetting to Defaults

Click **Reset to Defaults** to restore the original name ("UCCX Migration Tool"), subtitle ("Enterprise Configuration Management"), and remove any uploaded logo.

---

## 13. Permissions Reference

When adding a team member to a project, the following permissions can be granted independently:

| Permission | What it allows |
|---|---|
| **View** | Read-only access to all project data (configurations, logs, servers) |
| **Manage Connections** | Add, edit, and delete source and target UCCX server connections |
| **Import** | Upload XML files and trigger API imports |
| **Update** | Edit individual configuration records (skills, CSQs, agents, etc.) |
| **Migrate** | Create and run migration jobs to target systems |
| **Admin** | All of the above, plus managing project members and project settings |

A user with no permissions assigned to a project can see the project in their list but cannot open it.

---

## 14. Troubleshooting

### Login fails with "Invalid username or password"
- Confirm you are using the correct username and password.
- If you have not changed the default admin password, try `admin` / `admin`.
- If the `ADMIN_PASSWORD` environment variable was set, use that value.

### "Request entity too large" when uploading a logo or XML file
- The file exceeds the 10 MB upload limit.
- For logos, resize the image to under 2 MB before uploading.
- For XML configuration files, split very large files and import in parts.

### API Import fails with "Connection refused" or "Timeout"
- Confirm the UCCX host and port are correct in the Server configuration.
- Verify network connectivity: the server running this tool must be able to reach the UCCX system on the specified port.
- Check that the UCCX REST API service is enabled on the source system.
- If using HTTPS, confirm the UCCX certificate is valid (or that your environment allows self-signed certificates).

### Connection test passes but API Import returns empty results
- The UCCX user account may lack sufficient permissions to read configuration data. Use an account with the **UCCX Administrator** role.
- Confirm the UCCX version supports the REST API endpoints used (UCCX 11.0 and later are supported).

### Migration job stays "Pending" and never starts
- Check the **Logs & Audit** page for error messages from the `migration-queue` source.
- Verify the target system connection is active and the test passes.
- Ensure the user running the migration has the **Migrate** permission on the project.

### Configuration records are missing after import
- The XML file may be from an unsupported UCCX version or may use a non-standard schema.
- Check the Logs page (category: Import) for parse errors.
- Try importing specific configuration types individually using the API Import method.

### I accidentally deleted a configuration or imported wrong data
- Use the **Snapshots** feature on the Import page to restore a previous state.
- If no snapshot exists, re-import from the source system.

### Forgot the admin password
- If you have access to the server environment, set the `ADMIN_PASSWORD` environment variable and restart the application. The seed script will not overwrite an existing admin account's password automatically — you must update it via the Users page once logged in with another admin account, or directly in the database.

---

## Appendix: Recommended Migration Workflow

The following is the recommended end-to-end process for a typical UCCX migration:

```
1. CREATE PROJECT
   Create a new project for the migration effort.

2. ADD SERVERS
   Add the source UCCX system (the one you are migrating from).
   Add the target UCCX system (the one you are migrating to).
   Test both connections.

3. IMPORT SOURCE CONFIGURATION
   Use API Import to pull all configuration types from the source.
   Review each type (Skills, CSQs, Resources, etc.) for accuracy.

4. TAKE A SNAPSHOT
   Create a snapshot before any edits as a restore point.

5. REVIEW & CLEAN UP
   Edit or remove any records that should not be migrated.
   Verify CSQ-to-skill and resource-to-team assignments are correct.

6. DRY RUN
   Create a migration job, select all types, set mode to "Offline / Dry Run".
   Review the log output for any dependency errors or warnings.

7. LIVE MIGRATION
   Create a migration job, select all types, set mode to "Live".
   Monitor the Active Migrations panel until the job completes.

8. VERIFY ON TARGET
   Log into the target UCCX system and confirm the configuration was applied correctly.
   Check the Logs & Audit page for any errors that need follow-up.
```

---

*For technical issues or feature requests, contact your system administrator or the tool's development team.*
