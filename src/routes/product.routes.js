import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import {
  getProducts,
  getProductByBarcode,
  getProductAlerts,
  createProduct,
  updateProduct,
} from '../controllers/product.controller.js';

const router = Router();

// ANÁLISIS CRÍTICO DE FALLOS Y ENFOQUE PEDAGÓGICO:
// Anteriormente, este archivo contenía toda la lógica de negocio, validaciones y queries de Prisma inline.
// Esto violaba el principio de Responsabilidad Única (SRP) y acoplaba la capa de transporte HTTP (Express)
// con el acceso a datos. 
// CÓMO Y POR QUÉ: Se refactoriza delegando el comportamiento al controlador modular (product.controller.js).
// Se mantiene el uso de authenticateToken en la parte superior para conservar la estructura del pipeline,
// aunque actualmente actúe como un middleware de pasarela sin bloqueos (Cero Fricción).

router.use(authenticateToken);

// Nota: Registramos el endpoint fijo /alertas antes de cualquier posible colisión de rutas
router.get('/alertas', getProductAlerts);

router.get('/', getProducts);
router.get('/barcode/:barcode', getProductByBarcode);
router.post('/', createProduct);
router.put('/:id', updateProduct);

export default router;

