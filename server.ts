import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('memory_game.db');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    image_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get('/api/cards', (req, res) => {
    try {
      const cards = db.prepare('SELECT * FROM cards ORDER BY created_at DESC').all();
      res.json(cards);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch cards' });
    }
  });

  app.post('/api/cards', (req, res) => {
    const { id, image_data } = req.body;
    if (!id || !image_data) {
      return res.status(400).json({ error: 'ID and image data are required' });
    }

    try {
      const insert = db.prepare('INSERT OR REPLACE INTO cards (id, image_data) VALUES (?, ?)');
      insert.run(id, image_data);
      res.json({ success: true, id });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save card' });
    }
  });

  app.delete('/api/cards/:id', (req, res) => {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM cards WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete card' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
