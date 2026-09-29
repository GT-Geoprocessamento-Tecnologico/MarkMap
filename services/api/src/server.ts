import { serve } from '@hono/node-server';

import { createApp } from './app.js';
import { loadEnv } from './env.js';

const env = loadEnv();
const app = createApp(env);

serve({ fetch: app.fetch, hostname: env.HOST, port: env.PORT }, (info) => {
  process.stdout.write(
    `${JSON.stringify({
      level: 'info',
      message: 'api_started',
      host: env.HOST,
      port: info.port,
      database: env.hasDatabase ? 'configured' : 'not_configured',
    })}\n`,
  );
});
