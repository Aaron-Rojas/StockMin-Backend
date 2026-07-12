import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { getMovements } from '../controllers/movimiento.controller.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getMovements);

export default router;
