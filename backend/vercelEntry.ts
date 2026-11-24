import { createApiApp } from './createApiApp';

const app = createApiApp();

// Fallback 404 for unknown API paths on Vercel
app.use('/api', (_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint API tidak ditemukan.',
    },
  });
});

export default app;
