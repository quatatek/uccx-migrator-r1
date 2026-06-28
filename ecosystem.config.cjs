module.exports = {
  apps: [{
    name: 'uccx-migration',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env_file: '.env',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      DATABASE_URL: 'postgresql://uccx_user:NEW_RANDOM_PASSWORD@localhost:5432/uccx_migration',
      SESSION_SECRET: 'uccx-migration-secure-session-key-2025'
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
