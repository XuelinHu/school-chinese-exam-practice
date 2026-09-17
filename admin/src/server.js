import app from './app.js';
import { logger } from './utils/logger.js';

// 兜底：任何漏网的异步异常只记录，不让单个坏请求打挂整个服务
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { message: error.message, stack: error.stack });
});

const port = Number(process.env.PORT || 8033);
app.listen(port, () => {
  logger.info(`Chinese practice API running at http://localhost:${port}`);
});
