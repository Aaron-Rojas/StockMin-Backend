import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import {
  getLots,
  getLotsByProduct,
  createLot,
  registerLotMerma,
} from '../controllers/lote.controller.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getLots);
router.get('/producto/:productoId', getLotsByProduct);
router.post('/', createLot);
router.post('/:id/merma', registerLotMerma);

export default router;
