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

router.use(authenticateToken);

router.get('/alertas', getProductAlerts);

router.get('/', getProducts);
router.get('/barcode/:barcode', getProductByBarcode);
router.post('/', createProduct);
router.put('/:id', updateProduct);

export default router;

