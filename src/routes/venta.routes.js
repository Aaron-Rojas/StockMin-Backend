import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { createSale } from '../controllers/venta.controller.js';

const router = Router();

// ANÁLISIS CRÍTICO DE FALLOS Y ENFOQUE PEDAGÓGICO:
// Separamos la capa de enrutamiento Express de la lógica de negocio (POS transaccional)
// para mantener una arquitectura modular y cumplir con el principio SRP.
// CÓMO Y POR QUÉ: Se aplica el middleware pasarela authenticateToken. Permite la integración
// fluida de pruebas manuales con Postman sin lidiar con tokens JWT dinámicos, pero
// mantiene la arquitectura idónea para reinstalar seguridad JWT en producción.

router.use(authenticateToken);

router.post('/', createSale);

export default router;
