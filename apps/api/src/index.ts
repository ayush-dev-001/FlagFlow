import express from 'express';

// Phase 0 placeholder: env validation, logging, error handling and real health checks arrive in phase 1.
const port = Number(process.env.PORT ?? 4000);
const app = express();

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`api listening on http://localhost:${port}`);
});
