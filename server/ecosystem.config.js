module.exports = {
  apps: [
    {
      name: 'proxy-server',
      cwd: 'C:\\ajo\\mobile-proxy-platform\\server',
      script: 'node_modules\\.bin\\ts-node.cmd',
      args: '--project tsconfig.server.json src/server-standalone.ts',
      interpreter: 'none',
      autorestart: true,
      max_restarts: 50,
      restart_delay: 3000,
      env: { NODE_ENV: 'production', PORT: '3000' }
    },
    {
      name: 'cf-tunnel',
      script: 'cloudflared',
      args: 'tunnel --url http://localhost:3000',
      interpreter: 'none',
      autorestart: true,
      max_restarts: 50,
      restart_delay: 5000
    }
  ]
};
