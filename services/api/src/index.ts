import { createApp } from './app.js';
import { loadEnv } from './env.js';

export { createApp } from './app.js';
export { loadEnv } from './env.js';
export type { Env } from './env.js';
export * from './lib/errors.js';
export * from './lib/pagination.js';

const env = loadEnv();
const app = createApp(env);

export default app;
