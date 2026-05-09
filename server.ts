import 'dotenv/config';
import { createServer as createViteServer } from 'vite';
import app from './api/index';

const PORT = process.env.PORT || 3000;

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const { default: express } = await import('express');
    const { default: path } = await import('path');
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (_req: any, res: any) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')));
  }
  app.listen(PORT, () => console.log(`WashTech v2 running on http://localhost:${PORT}`));
}

start();
