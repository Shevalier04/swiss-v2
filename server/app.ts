import express from 'express';
import { apiRouter, handleSyncHomework } from './api';

export const app = express();
app.use(express.json());

// Support /sync-homework and /api/sync-homework directly
app.post('/sync-homework', handleSyncHomework);
app.get('/sync-homework', handleSyncHomework);
app.post('/api/sync-homework', handleSyncHomework);
app.get('/api/sync-homework', handleSyncHomework);

app.use('/api', apiRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});
