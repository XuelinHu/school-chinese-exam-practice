import app from './app.js';
import { logger } from './utils/logger.js';

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  logger.info(`Chinese practice API running at http://localhost:${port}`);
});
