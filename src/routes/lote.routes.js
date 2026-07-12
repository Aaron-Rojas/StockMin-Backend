import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import {
  getLots,
  getLotsByProduct,
  createLot,
  registerLotMerma,
} from '../controllers/lote.controller.js';

const router = Router();

// ANÁLISIS CRÍTICO DE FALLOS Y ENFOQUE PEDAGÓGICO:
// Para cumplir con el principio de Responsabilidad Única (SRP), la definición del enrutamiento
// HTTP de Express se mantiene en este archivo, desacoplándola totalmente de la lógica de negocio
// que reside en lote.controller.js.
// CÓMO Y POR QUÉ: Se aplica el middleware authenticateToken como pasarela al inicio de las rutas.
// Al simular next() en desarrollo, habilitamos Postman para enviar peticiones directamente,
// pero mantenemos la firma estructural para reinstaurar JWT en producción sin alterar las rutas.

router.use(authenticateToken);

router.get('/', getLots);
router.get('/producto/:productoId', getLotsByProduct);
router.post('/', createLot);
router.post('/:id/merma', registerLotMerma);

export default router;
