import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { createSale } from '../controllers/venta.controller.js';

const router = Router();

router.use(authenticateToken);

router.post('/', createSale);

export default router;
