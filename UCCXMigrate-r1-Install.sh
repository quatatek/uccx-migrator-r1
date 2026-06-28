#!/usr/bin/env bash
set -Eeuo pipefail

# UCCX Migration Tool all-in-one installer for Ubuntu/Debian.
# The script installs prerequisites, clones the GitHub repository, configures
# PostgreSQL, builds the application, starts it with PM2, and configures Nginx.

APP_NAME="${APP_NAME:-uccx-migration}"
APP_DIR="${APP_DIR:-/opt/uccx-migration}"
APP_USER="${APP_USER:-${SUDO_USER:-$(id -un)}}"
PORT="${PORT:-5000}"

REPO_URL="${REPO_URL:-https://github.com/quatatek/uccx-migrator-r1.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"

DB_NAME="${DB_NAME:-uccx_migration}"
DB_USER="${DB_USER:-uccx_user}"
DB_PASSWORD="${DB_PASSWORD:-}"
DATABASE_URL="${DATABASE_URL:-}"

SESSION_SECRET="${SESSION_SECRET:-}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"

DOMAIN="${DOMAIN:-_}"
CONFIGURE_NGINX="${CONFIGURE_NGINX:-true}"
NODE_MAJOR_REQUIRED="${NODE_MAJOR_REQUIRED:-22}"

APP_HOME=""
APP_GROUP=""
PM2_HOME_DIR=""
TEMP_DIR=""
SOURCE_COMMIT="unknown"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  local line_no="${1:-unknown}"
  printf '\nInstallation failed at line %s (exit code %s).\n' "$line_no" "$exit_code" >&2
  if command -v pm2 >/dev/null 2>&1 && [[ -n "${APP_HOME:-}" ]]; then
    printf 'PM2 logs, when available:\n' >&2
    printf '  sudo -u %s env HOME=%q PM2_HOME=%q pm2 logs %s --lines 100\n' \
      "$APP_USER" "$APP_HOME" "$PM2_HOME_DIR" "$APP_NAME" >&2
  fi
  exit "$exit_code"
}

cleanup() {
  if [[ -n "${TEMP_DIR:-}" && -d "$TEMP_DIR" ]]; then
    rm -rf -- "$TEMP_DIR"
  fi
}

trap 'on_error "$LINENO"' ERR
trap cleanup EXIT

require_identifier() {
  local name="$1"
  local value="$2"
  [[ "$value" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || \
    die "$name must contain only letters, numbers, and underscores, and cannot start with a number."
}

run_sudo() {
  if (( EUID == 0 )); then
    "$@"
  else
    sudo "$@"
  fi
}

run_as_user() {
  local user="$1"
  shift

  if [[ "$(id -un)" == "$user" ]]; then
    "$@"
  elif (( EUID == 0 )); then
    runuser -u "$user" -- "$@"
  else
    sudo -u "$user" -- "$@"
  fi
}

run_as_app_user() {
  run_as_user "$APP_USER" env \
    HOME="$APP_HOME" \
    PM2_HOME="$PM2_HOME_DIR" \
    PATH="$PATH" \
    "$@"
}

run_in_app_dir() {
  run_as_app_user bash -c 'cd -- "$1"; shift; exec "$@"' bash "$APP_DIR" "$@"
}

ensure_sudo() {
  if (( EUID != 0 )); then
    command -v sudo >/dev/null 2>&1 || \
      die "sudo is required. Re-run as root or install sudo."
    sudo -v
  fi
}

detect_os() {
  [[ -r /etc/os-release ]] || die "Cannot detect OS; /etc/os-release is missing."
  # shellcheck disable=SC1091
  . /etc/os-release

  case "${ID:-}" in
    ubuntu|debian) ;;
    *)
      case " ${ID_LIKE:-} " in
        *" debian "*) ;;
        *) die "This installer supports Ubuntu/Debian systems. Detected: ${PRETTY_NAME:-unknown}." ;;
      esac
      ;;
  esac
}

initialize_app_user() {
  id "$APP_USER" >/dev/null 2>&1 || die "Application user '$APP_USER' does not exist."
  APP_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"
  APP_GROUP="$(id -gn "$APP_USER")"
  [[ -n "$APP_HOME" ]] || die "Could not determine the home directory for '$APP_USER'."
  PM2_HOME_DIR="${APP_HOME}/.pm2"
}

random_secret() {
  openssl rand -hex 32
}

node_major_version() {
  if command -v node >/dev/null 2>&1; then
    node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || printf '0'
  else
    printf '0'
  fi
}

read_env_value() {
  local key="$1"
  local env_file="${APP_DIR}/.env"

  [[ -f "$env_file" ]] || return 0

  ENV_FILE="$env_file" ENV_KEY="$key" node --input-type=module <<'NODE'
import fs from 'node:fs';

const file = process.env.ENV_FILE;
const wanted = process.env.ENV_KEY;

for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;

  const index = rawLine.indexOf('=');
  if (index === -1) continue;

  const key = rawLine.slice(0, index).trim();
  if (key !== wanted) continue;

  let value = rawLine.slice(index + 1).trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1);
  }

  process.stdout.write(value);
  break;
}
NODE
}

load_existing_settings() {
  local existing_url existing_session existing_admin_password existing_admin_username

  [[ -f "${APP_DIR}/.env" ]] || return 0

  log "Loading existing settings from ${APP_DIR}/.env"

  existing_url="$(read_env_value DATABASE_URL || true)"
  existing_session="$(read_env_value SESSION_SECRET || true)"
  existing_admin_password="$(read_env_value ADMIN_PASSWORD || true)"
  existing_admin_username="$(read_env_value ADMIN_USERNAME || true)"

  if [[ -z "$DATABASE_URL" && -n "$existing_url" ]]; then
    DATABASE_URL="$existing_url"
  fi

  if [[ -z "$DB_PASSWORD" && -n "$existing_url" ]]; then
    DB_PASSWORD="$(DATABASE_URL_VALUE="$existing_url" node --input-type=module <<'NODE'
try {
  const url = new URL(process.env.DATABASE_URL_VALUE);
  process.stdout.write(decodeURIComponent(url.password));
} catch {
  process.exit(0);
}
NODE
)"
  fi

  SESSION_SECRET="${SESSION_SECRET:-$existing_session}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-$existing_admin_password}"
  if [[ "$ADMIN_USERNAME" == "admin" && -n "$existing_admin_username" ]]; then
    ADMIN_USERNAME="$existing_admin_username"
  fi
}

install_system_packages() {
  log "Installing system prerequisites"
  run_sudo apt-get update
  run_sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y \
    build-essential \
    ca-certificates \
    curl \
    git \
    gnupg \
    nginx \
    openssl \
    postgresql \
    postgresql-contrib \
    rsync \
    unzip \
    wget

  if (( "$(node_major_version)" < NODE_MAJOR_REQUIRED )); then
    local -a held_node_packages=()
    local package

    log "Installing Node.js ${NODE_MAJOR_REQUIRED}.x from NodeSource"

    while IFS= read -r package; do
      [[ -n "$package" ]] && held_node_packages+=("$package")
    done < <(
      run_sudo apt-mark showhold 2>/dev/null |
        grep -E '^(nodejs|nodejs-doc|libnode-dev|libnode[0-9]+)$' || true
    )

    if (( ${#held_node_packages[@]} > 0 )); then
      log "Temporarily removing APT holds from: ${held_node_packages[*]}"
      run_sudo apt-mark unhold "${held_node_packages[@]}"
    fi

    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR_REQUIRED}.x" | run_sudo bash -

    if ! run_sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs; then
      if (( ${#held_node_packages[@]} > 0 )); then
        run_sudo apt-mark hold "${held_node_packages[@]}" || true
      fi
      die "Node.js installation failed."
    fi

    if (( ${#held_node_packages[@]} > 0 )); then
      log "Restoring APT holds: ${held_node_packages[*]}"
      run_sudo apt-mark hold "${held_node_packages[@]}"
    fi
  fi

  if (( "$(node_major_version)" < NODE_MAJOR_REQUIRED )); then
    die "Node.js ${NODE_MAJOR_REQUIRED} or newer is required; detected $(node --version 2>/dev/null || printf 'none')."
  fi

  log "Installing PM2"
  run_sudo npm install --global pm2@latest

  node --version
  npm --version
  pm2 --version
}

clone_and_deploy_repository() {
  local checkout_dir

  log "Cloning ${REPO_URL} (branch: ${REPO_BRANCH})"
  TEMP_DIR="$(mktemp -d -t uccx-migrator.XXXXXXXX)"
  checkout_dir="${TEMP_DIR}/repository"

  git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$checkout_dir"

  [[ -f "${checkout_dir}/package.json" ]] || \
    die "The cloned repository does not contain package.json at its root."
  [[ -f "${checkout_dir}/drizzle.config.ts" ]] || \
    die "The cloned repository does not contain drizzle.config.ts at its root."
  [[ -d "${checkout_dir}/client" && -d "${checkout_dir}/server" ]] || \
    die "The cloned repository is missing the client or server directory."

  SOURCE_COMMIT="$(git -C "$checkout_dir" rev-parse HEAD)"

  log "Deploying application files to ${APP_DIR}"
  run_sudo mkdir -p \
    "$APP_DIR" \
    "${APP_DIR}/uploads" \
    /var/log/pm2 \
    /var/log/uccx-migration

  # A previous run may have left unrelated files in APP_DIR. rsync --delete
  # makes APP_DIR match GitHub while preserving runtime data and secrets.
  run_sudo rsync -a --delete \
    --exclude '.git/' \
    --exclude '.env' \
    --exclude 'node_modules/' \
    --exclude 'dist/' \
    --exclude 'uploads/' \
    --exclude 'ecosystem.local.config.cjs' \
    "$checkout_dir/" "$APP_DIR/"

  printf '%s\n' "$SOURCE_COMMIT" | run_sudo tee "${APP_DIR}/.source-commit" >/dev/null

  run_sudo mkdir -p "${APP_DIR}/uploads"
  run_sudo chown -R "$APP_USER:$APP_GROUP" \
    "$APP_DIR" \
    /var/log/pm2 \
    /var/log/uccx-migration

  [[ -f "${APP_DIR}/package.json" ]] || \
    die "Deployment failed: ${APP_DIR}/package.json was not created."
}

setup_postgres() {
  require_identifier DB_NAME "$DB_NAME"
  require_identifier DB_USER "$DB_USER"

  DB_PASSWORD="${DB_PASSWORD:-$(random_secret)}"

  log "Configuring PostgreSQL database and user"
  run_sudo systemctl enable postgresql
  run_sudo systemctl start postgresql

  if ! run_as_user postgres psql -tAc \
    "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'" | grep -q 1; then
    run_as_user postgres createuser --login "$DB_USER"
  fi

  run_as_user postgres psql \
    -v ON_ERROR_STOP=1 \
    -v db_user="$DB_USER" \
    -v db_password="$DB_PASSWORD" <<'SQL'
ALTER ROLE :"db_user" WITH LOGIN PASSWORD :'db_password';
SQL

  if ! run_as_user postgres psql -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
    run_as_user postgres createdb --owner="$DB_USER" "$DB_NAME"
  fi

  run_as_user postgres psql \
    -v ON_ERROR_STOP=1 \
    -v db_name="$DB_NAME" \
    -v db_user="$DB_USER" <<'SQL'
ALTER DATABASE :"db_name" OWNER TO :"db_user";
GRANT ALL PRIVILEGES ON DATABASE :"db_name" TO :"db_user";
SQL

  run_as_user postgres psql \
    -v ON_ERROR_STOP=1 \
    -d "$DB_NAME" \
    -v db_user="$DB_USER" <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
GRANT USAGE, CREATE ON SCHEMA public TO :"db_user";
ALTER SCHEMA public OWNER TO :"db_user";
SQL
}

write_environment() {
  local encoded_password env_file existing_cookie_secure existing_trust_proxy
  env_file="${APP_DIR}/.env"

  SESSION_SECRET="${SESSION_SECRET:-$(random_secret)}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(random_secret)}"

  encoded_password="$(DB_PASSWORD_VALUE="$DB_PASSWORD" node --input-type=module <<'NODE'
process.stdout.write(encodeURIComponent(process.env.DB_PASSWORD_VALUE));
NODE
)"
  DATABASE_URL="postgresql://${DB_USER}:${encoded_password}@127.0.0.1:5432/${DB_NAME}"

  existing_cookie_secure="$(read_env_value COOKIE_SECURE || true)"
  existing_trust_proxy="$(read_env_value TRUST_PROXY || true)"

  log "Writing environment file ${env_file}"

  ENV_FILE="$env_file" \
  VALUE_NODE_ENV="production" \
  VALUE_PORT="$PORT" \
  VALUE_DATABASE_URL="$DATABASE_URL" \
  VALUE_SESSION_SECRET="$SESSION_SECRET" \
  VALUE_ADMIN_USERNAME="$ADMIN_USERNAME" \
  VALUE_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  VALUE_ADMIN_EMAIL="$ADMIN_EMAIL" \
  VALUE_COOKIE_SECURE="${existing_cookie_secure:-false}" \
  VALUE_TRUST_PROXY="${existing_trust_proxy:-false}" \
  node --input-type=module <<'NODE'
import fs from 'node:fs';

const file = process.env.ENV_FILE;
const order = [];
const values = new Map();

if (fs.existsSync(file)) {
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!rawLine || rawLine.trimStart().startsWith('#') || !rawLine.includes('=')) continue;
    const index = rawLine.indexOf('=');
    const key = rawLine.slice(0, index).trim();
    const value = rawLine.slice(index + 1);
    if (!values.has(key)) order.push(key);
    values.set(key, value);
  }
}

const updates = {
  NODE_ENV: process.env.VALUE_NODE_ENV,
  PORT: process.env.VALUE_PORT,
  DATABASE_URL: process.env.VALUE_DATABASE_URL,
  SESSION_SECRET: process.env.VALUE_SESSION_SECRET,
  ADMIN_USERNAME: process.env.VALUE_ADMIN_USERNAME,
  ADMIN_PASSWORD: process.env.VALUE_ADMIN_PASSWORD,
  COOKIE_SECURE: process.env.VALUE_COOKIE_SECURE,
  TRUST_PROXY: process.env.VALUE_TRUST_PROXY,
};

if (process.env.VALUE_ADMIN_EMAIL) {
  updates.ADMIN_EMAIL = process.env.VALUE_ADMIN_EMAIL;
}

for (const [key, value] of Object.entries(updates)) {
  if (!values.has(key)) order.push(key);
  values.set(key, value);
}

const content = order.map((key) => `${key}=${values.get(key)}`).join('\n') + '\n';
fs.writeFileSync(file, content, { mode: 0o600 });
NODE

  run_sudo chown "$APP_USER:$APP_GROUP" "$env_file"
  run_sudo chmod 600 "$env_file"
}

install_and_build_app() {
  log "Installing application dependencies"
  if [[ -f "${APP_DIR}/package-lock.json" ]]; then
    run_in_app_dir npm ci
  else
    run_in_app_dir npm install
  fi

  log "Applying database schema"
  run_in_app_dir env DATABASE_URL="$DATABASE_URL" npm run db:push

  log "Verifying database connection"
  run_in_app_dir env DATABASE_URL="$DATABASE_URL" node --input-type=module <<'NODE'
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const result = await pool.query('select current_user, current_database()');
console.log(result.rows[0]);
await pool.end();
NODE

  log "Building application"
  run_in_app_dir env NODE_ENV=production npm run build

  [[ -f "${APP_DIR}/dist/index.js" ]] || \
    die "Build completed without creating ${APP_DIR}/dist/index.js."
}

write_pm2_config() {
  log "Writing PM2 configuration"

  run_in_app_dir env \
    CONFIG_APP_NAME="$APP_NAME" \
    CONFIG_APP_DIR="$APP_DIR" \
    CONFIG_PORT="$PORT" \
    node --input-type=module <<'NODE'
import fs from 'node:fs';

const env = {};
for (const rawLine of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  if (!rawLine || rawLine.trimStart().startsWith('#')) continue;
  const index = rawLine.indexOf('=');
  if (index === -1) continue;
  env[rawLine.slice(0, index).trim()] = rawLine.slice(index + 1);
}

const config = {
  apps: [
    {
      name: process.env.CONFIG_APP_NAME,
      cwd: process.env.CONFIG_APP_DIR,
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env,
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
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};

fs.writeFileSync(
  'ecosystem.local.config.cjs',
  `module.exports = ${JSON.stringify(config, null, 2)};\n`,
  { mode: 0o600 },
);
NODE

  run_sudo chown "$APP_USER:$APP_GROUP" "${APP_DIR}/ecosystem.local.config.cjs"
  run_sudo chmod 600 "${APP_DIR}/ecosystem.local.config.cjs"
}

start_pm2() {
  log "Starting application with PM2 as ${APP_USER}"

  # Disable an older direct systemd service, if one was created by a previous installer.
  if systemctl list-unit-files --type=service 2>/dev/null |
    awk '{print $1}' | grep -qx "${APP_NAME}.service"; then
    run_sudo systemctl disable --now "${APP_NAME}.service" || true
  fi

  run_as_app_user pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
  run_in_app_dir pm2 start ecosystem.local.config.cjs --only "$APP_NAME" --update-env
  run_as_app_user pm2 save

  if command -v systemctl >/dev/null 2>&1; then
    log "Registering PM2 startup service"
    run_sudo env PATH="$PATH" PM2_HOME="$PM2_HOME_DIR" \
      pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME"
    run_as_app_user pm2 save
  fi
}

configure_nginx() {
  [[ "$CONFIGURE_NGINX" == "true" ]] || return 0

  log "Configuring Nginx reverse proxy"
  run_sudo tee /etc/nginx/sites-available/uccx-migration >/dev/null <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 50M;

    location = /health {
        access_log off;
        add_header Content-Type text/plain;
        return 200 "healthy\\n";
    }

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;
    }
}
NGINX

  run_sudo ln -sfn \
    /etc/nginx/sites-available/uccx-migration \
    /etc/nginx/sites-enabled/uccx-migration
  run_sudo rm -f /etc/nginx/sites-enabled/default
  run_sudo nginx -t
  run_sudo systemctl enable nginx
  run_sudo systemctl restart nginx
}

validate_installation() {
  local attempt

  log "Validating PM2 process"
  run_as_app_user pm2 describe "$APP_NAME" >/dev/null

  log "Waiting for the application to respond on port ${PORT}"
  for attempt in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
      break
    fi

    if (( attempt == 30 )); then
      run_as_app_user pm2 logs "$APP_NAME" --lines 100 --nostream || true
      die "The application did not respond at http://127.0.0.1:${PORT}/ within 60 seconds."
    fi

    sleep 2
  done

  if [[ "$CONFIGURE_NGINX" == "true" ]]; then
    curl -fsS "http://127.0.0.1/health" >/dev/null
  fi
}

write_credentials_file() {
  local credentials_file="/root/uccx-migrator-install-credentials.txt"

  {
    printf 'Application directory: %s\n' "$APP_DIR"
    printf 'Repository: %s\n' "$REPO_URL"
    printf 'Branch: %s\n' "$REPO_BRANCH"
    printf 'Commit: %s\n' "$SOURCE_COMMIT"
    printf 'Database name: %s\n' "$DB_NAME"
    printf 'Database user: %s\n' "$DB_USER"
    printf 'Database password: %s\n' "$DB_PASSWORD"
    printf 'Admin username: %s\n' "$ADMIN_USERNAME"
    printf 'Admin password: %s\n' "$ADMIN_PASSWORD"
    if [[ -n "$ADMIN_EMAIL" ]]; then
      printf 'Admin email: %s\n' "$ADMIN_EMAIL"
    fi
  } | run_sudo tee "$credentials_file" >/dev/null

  run_sudo chmod 600 "$credentials_file"
}

print_summary() {
  cat <<SUMMARY

UCCX Migration Tool setup complete.

Repository:            ${REPO_URL}
Branch:                ${REPO_BRANCH}
Installed commit:      ${SOURCE_COMMIT}
Application directory: ${APP_DIR}
Application user:      ${APP_USER}
Local app URL:         http://127.0.0.1:${PORT}
Nginx URL:             http://127.0.0.1/
PM2 app name:          ${APP_NAME}
Admin username:        ${ADMIN_USERNAME}
Admin password:        ${ADMIN_PASSWORD}

Credentials were saved to:
  /root/uccx-migrator-install-credentials.txt

Environment and secrets are stored in:
  ${APP_DIR}/.env

PM2 status:
  sudo -u ${APP_USER} env HOME=${APP_HOME} PM2_HOME=${PM2_HOME_DIR} pm2 status

PM2 logs:
  sudo -u ${APP_USER} env HOME=${APP_HOME} PM2_HOME=${PM2_HOME_DIR} pm2 logs ${APP_NAME}
SUMMARY
}

main() {
  detect_os
  ensure_sudo
  initialize_app_user
  install_system_packages
  load_existing_settings
  clone_and_deploy_repository
  setup_postgres
  write_environment
  install_and_build_app
  write_pm2_config
  start_pm2
  configure_nginx
  validate_installation
  write_credentials_file
  print_summary
}

main "$@"
