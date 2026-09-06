import { buildServer } from './server.js';

const app = buildServer();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

app.listen({ host, port }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
