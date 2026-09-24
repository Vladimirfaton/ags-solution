import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from './config/logger.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import assistanceRoutes from './routes/assistanceRoutes.js';
import platformRoutes from './routes/platformRoutes.js';
import directionRoutes from './routes/directionRoutes.js';
import secretariatRoutes from './routes/secretariatRoutes.js';
import comptabiliteRoutes from './routes/comptabiliteRoutes.js';
import censeurRoutes from './routes/censeurRoutes.js';
import { validateEnv } from './config/validateEnv.js';
import { PLATFORM_NAME } from './config/branding.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(projectRoot, '.env') });
validateEnv();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/uploads', express.static('./uploads'));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/assistance', assistanceRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/direction', directionRoutes);
app.use('/api/secretariat', secretariatRoutes);
app.use('/api/comptabilite', comptabiliteRoutes);
app.use('/api/censeur', censeurRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(notFound);
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: `${PLATFORM_NAME} backend` });
});
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
