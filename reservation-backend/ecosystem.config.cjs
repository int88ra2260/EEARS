/**
 * PM2 process file for EEARS backend (Windows IIS reverse-proxy → Node :3000).
 *
 * First-time setup (from repo root or backend dir):
 *   powershell -File scripts/ops/setup-pm2.ps1
 *
 * Daily:
 *   pm2 restart eears-backend
 *   # or: powershell -File scripts/ops/restart-backend.ps1
 */
module.exports = {
  apps: [
    {
      name: 'eears-backend',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      time: true,
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Taipei',
      },
    },
  ],
};
