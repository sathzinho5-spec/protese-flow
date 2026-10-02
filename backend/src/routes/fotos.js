import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

router.delete('/api/fotos/:id', asyncHandler(async (req, res) => {
  const f = await db.find('fotos', req.params.id);
  if (f) {
    try { fs.unlinkSync(path.join(config.uploadDir, path.basename(f.url))); } catch {}
    await db.remove('fotos', req.params.id);
  }
  res.json({ ok: true });
}));

export default router;
