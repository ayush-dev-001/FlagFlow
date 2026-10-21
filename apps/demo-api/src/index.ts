import express from 'express';

// Phase 0 placeholder: flag-client integration and the SSE relay arrive in phase 8.
const port = Number(process.env.PORT ?? 4100);
const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`demo-api listening on http://localhost:${port}`);
});
