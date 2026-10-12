import express from 'express';
import path from 'path';
import { app } from './app';

const PORT = Number(process.env.PORT) || 3000;

app.use(express.static(path.resolve('dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.resolve('dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
