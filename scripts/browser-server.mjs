import { createApp } from '../src/app.js';
import { createDatabase } from '../src/database.js';
const database = createDatabase({ filename: ':memory:', seed: false });
const server = createApp({ database }).listen(3384, '127.0.0.1');
function shutdown() { server.close(() => { database.close(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
