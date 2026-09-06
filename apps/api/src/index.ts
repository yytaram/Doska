import 'dotenv/config';

import { getConfig } from './config.js';
import { buildServer } from './server.js';

const config = getConfig();
const app = buildServer({ config });

app.listen({ host: config.HOST, port: config.PORT }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
