import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import learningRoutes from './routes/learning.js';
import adminRoutes from './routes/admin.js';
import { requestLogger } from './middleware/requestLogger.js';
import { logger } from './utils/logger.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get('/api/health', (_req, res) => res.json({ code: 200, message: 'success', data: { status: 'ok' } }));
app.use('/api/auth', authRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/admin', adminRoutes);

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
  res.status(status).json({ code: status, message: err.message || 'Internal server error' });
});

export default app;
