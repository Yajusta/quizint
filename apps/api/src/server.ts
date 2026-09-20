// Listen + graceful shutdown (§11.3).

import { buildApp } from './app.js';
import { getConfig } from './config.js';

async function main(): Promise<void> {
  const config = getConfig();
  const app = await buildApp();

  await app.listen({ port: config.PORT, host: '0.0.0.0' });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
