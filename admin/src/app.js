import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import learningRoutes from './routes/learning.js';
import adminRoutes from './routes/admin.js';
import teachingRoutes from './routes/teaching.js';
import aiRoutes from './routes/ai.js';
import { requestLogger } from './middleware/requestLogger.js';
import { touchActive } from './middleware/active.js';
import { uploadDir, UPLOAD_URL_PREFIX } from './config/uploads.js';
import { logger } from './utils/logger.js';

dotenv.config();

const app = express();

// FRP 等本机回环代理转发时才信任 X-Forwarded-For，避免任意来源伪造客户端 IP
app.set('trust proxy', 'loopback');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);
app.use(touchActive);
app.use(UPLOAD_URL_PREFIX, express.static(uploadDir, { maxAge: '1h', index: false }));

app.get('/api/health', (_req, res) => res.json({ code: 200, message: 'success', data: { status: 'ok' } }));
app.use('/api/auth', authRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/admin', adminRoutes);
// 教学查看区：教师与超管可读，全部只读（见 routes/teaching.js 顶部说明）
app.use('/api/teaching', teachingRoutes);
app.use('/api/ai', aiRoutes);

app.use((req, res) => res.status(404).json({ code: 404, message: `Not found: ${req.path}` }));
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  logger.error('HTTP request failed', {
    method: req.method,
    path: req.originalUrl,
    status,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
  // SSE 等场景下响应头已发出，无法再改状态码，只能终止连接
  if (res.headersSent) {
    res.end();
    return;
  }
  res.status(status).json({ code: status, message: err.message || 'Internal server error' });
});

export default app;
