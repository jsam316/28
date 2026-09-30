import { configFromEnv, createGameServer } from './app.js';

const PORT = Number(process.env.PORT ?? 4000);
const config = configFromEnv();
const server = createGameServer(config);

server.listen(PORT).then((port) => {
  const origins = Array.isArray(config.origins) ? config.origins.join(', ') : config.origins;
  console.log(`28 game server listening on :${port} (allowed origins: ${origins})`);
});

// Let Render stop the service cleanly on redeploys.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close().finally(() => process.exit(0));
  });
}
