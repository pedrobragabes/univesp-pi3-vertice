import { createApp } from './src/app.js';
import { createDatabase } from './src/database.js';

const requestedPort = Number(process.env.PORT);
const port = Number.isInteger(requestedPort) && requestedPort > 0 && requestedPort < 65536 ? requestedPort : 3002;
const database = createDatabase({
  filename: process.env.DATABASE_PATH,
  seed: process.env.SEED_DATABASE !== 'false',
});

const server = createApp({ database }).listen(port, () => {
  console.log(`Vértice disponível em http://localhost:${port}`);
});

function shutdown(signal) {
  console.log(`\n${signal} recebido. Encerrando...`);
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
