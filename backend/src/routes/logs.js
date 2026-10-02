import { Router } from 'express';
import { db } from '../db.js';
import { soAdmin } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.get('/api/logs', soAdmin, asyncHandler(async (req, res) => res.json((await db.all('logs')).reverse().slice(0, 200))));
export default router;
