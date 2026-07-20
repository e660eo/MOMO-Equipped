/*
  Конфиг PM2 — держит Next.js живым на сервере: поднимает при старте системы,
  перезапускает при падении, пишет логи.

  Запуск:   pm2 start ecosystem.config.cjs
  Обновить: pm2 reload momo
  Логи:     pm2 logs momo
*/
module.exports = {
  apps: [
    {
      name: "momo",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // логи с временными метками — чтобы разбирать инциденты
      time: true,
      out_file: "logs/out.log",
      error_file: "logs/error.log",
      merge_logs: true,
    },
  ],
};
