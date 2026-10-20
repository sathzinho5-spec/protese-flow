import multer from 'multer';
import path from 'path';
import { config } from '../config.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.floor(Math.random() * 1e6)}${ext}`);
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Envie imagens JPG, PNG, WebP ou PDF'));
  }
});
