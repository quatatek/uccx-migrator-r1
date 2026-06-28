module.exports = {
  apps: [
    {
      name: "uccx-migration",

      cwd: "/opt/uccx-migration",
      script: "dist/index.js",

      instances: 1,
      exec_mode: "fork",

      env: {
        NODE_ENV: "production",
        PORT: 5000
      },

      error_file: "/var/log/pm2/uccx-migration-error.log",
      out_file: "/var/log/pm2/uccx-migration-out.log",
      log_file: "/var/log/pm2/uccx-migration.log",

      time: true,
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: "10s",

      watch: false,
      ignore_watch: [
        "node_modules",
        "logs",
        "uploads",
        "*.log"
      ]
    }
  ]
};
