import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { getMovements } from '../controllers/movimiento.controller.js';

const router = Router();

// ANÁLISIS CRÍTICO DE FALLOS Y ENFOQUE PEDAGÓGICO:
// Anteriormente, este módulo contenía lógica de negocio para la creación de movimientos
// y mutaciones de inventario física inline de forma desorganizada.
// Para cumplir con el principio de Responsabilidad Única (SRP) y blindar la bitácora ante alteraciones indocumentadas,
// este módulo ha sido refactorizado a SOLO LECTURA (GET). La creación de logs se delega
// a los respectivos controladores de Lotes y Ventas de forma transaccional.
// CÓMO Y POR QUÉ: Se aplica el middleware pasarela authenticateToken y se mapea únicamente
// la ruta GET '/' delegando el comportamiento al controlador modular de movimientos.

router.use(authenticateToken);

router.get('/', getMovements);

export default router;
