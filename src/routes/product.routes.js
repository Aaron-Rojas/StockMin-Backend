import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Endpoint de salud o depuración no requiere token, pero las rutas del catálogo están totalmente protegidas
router.use(authenticateToken);

// Expresión regular para validar el precio con formato decimal estricto ("X.XX" o "X")
const PRICE_REGEX = /^\d+(\.\d{2})?$/;

// Imagen por defecto en caso de que no se provea en el registro del producto
const DEFAULT_IMAGE_URL = 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=256';

/**
 * Formatea un producto de base de datos para cumplir con el contrato de comunicación JSON.
 * Convierte el precio Decimal a string con 2 decimales y asegura que imageUrl no sea nulo.
 * 
 * @param {object} product - Producto directo de Prisma.
 * @returns {object} Producto formateado según el contrato API.
 */
const formatProductResponse = (product) => ({
  id: product.id,
  nombre: product.name,
  precio: product.price.toFixed(2),
  stock: product.stock,
  imagenUrl: product.imageUrl || DEFAULT_IMAGE_URL,
  codigoBarras: product.barcode,
});

/**
 * @openapi
 * /api/productos:
 *   get:
 *     summary: Obtiene el catálogo completo de productos
 */
router.get('/', async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const formattedProducts = products.map(formatProductResponse);
    return res.status(200).json(formattedProducts);
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /api/productos/barcode/{barcode}:
 *   get:
 *     summary: Busca un producto único por su código de barras (cámara)
 */
router.get('/barcode/:barcode', async (req, res, next) => {
  try {
    const { barcode } = req.params;

    const product = await prisma.product.findUnique({
      where: { barcode },
    });

    if (!product) {
      return res.status(404).json({
        error: 'El código de barras no coincide con ningún producto registrado.',
      });
    }

    return res.status(200).json(formatProductResponse(product));
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /api/productos:
 *   post:
 *     summary: Registra un nuevo producto en el catálogo
 */
router.post('/', async (req, res, next) => {
  try {
    const { nombre, precio, stock, imagenUrl, codigoBarras } = req.body;

    // Validaciones de presencia requeridas por el contrato
    if (!nombre || precio === undefined || stock === undefined || !codigoBarras) {
      return res.status(400).json({ error: 'Faltan campos obligatorios en la petición.' });
    }

    if (nombre.trim().length < 2) {
      return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres.' });
    }

    // Validación del formato de precio decimal tipo string ("X.XX")
    if (!PRICE_REGEX.test(precio)) {
      return res.status(400).json({ error: 'El precio debe ser un string numérico decimal válido (ej. 7.50).' });
    }

    if (parseInt(stock, 10) < 0) {
      return res.status(400).json({ error: 'El stock no puede ser negativo.' });
    }

    // Verificación de unicidad del código de barras para evitar colisiones
    const existingProduct = await prisma.product.findUnique({
      where: { barcode: codigoBarras },
    });

    if (existingProduct) {
      return res.status(409).json({
        error: 'El código de barras ingresado ya pertenece a otro producto.',
      });
    }

    const newProduct = await prisma.product.create({
      data: {
        name: nombre,
        price: precio,
        stock: parseInt(stock, 10),
        imageUrl: imagenUrl || null,
        barcode: codigoBarras,
      },
    });

    return res.status(201).json(formatProductResponse(newProduct));
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /api/productos/{id}:
 *   put:
 *     summary: Actualiza parcialmente o totalmente la información de un producto
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, precio, stock, imagenUrl, codigoBarras } = req.body;

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return res.status(404).json({
        error: 'Producto no encontrado para actualización.',
      });
    }

    const updateData = {};

    if (nombre !== undefined) {
      if (nombre.trim().length < 2) {
        return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres.' });
      }
      updateData.name = nombre;
    }

    if (precio !== undefined) {
      if (!PRICE_REGEX.test(precio)) {
        return res.status(400).json({ error: 'El precio debe ser un string numérico decimal válido.' });
      }
      updateData.price = precio;
    }

    if (stock !== undefined) {
      if (parseInt(stock, 10) < 0) {
        return res.status(400).json({ error: 'El stock no puede ser negativo.' });
      }
      updateData.stock = parseInt(stock, 10);
    }

    if (imagenUrl !== undefined) {
      updateData.imageUrl = imagenUrl || null;
    }

    if (codigoBarras !== undefined) {
      // Verificación de unicidad si se está intentando cambiar el código de barras
      if (codigoBarras !== existingProduct.barcode) {
        const barcodeConflict = await prisma.product.findUnique({
          where: { barcode: codigoBarras },
        });

        if (barcodeConflict) {
          return res.status(409).json({
            error: 'El código de barras ingresado ya pertenece a otro producto.',
          });
        }
      }
      updateData.barcode = codigoBarras;
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json(formatProductResponse(updatedProduct));
  } catch (error) {
    return next(error);
  }
});

export default router;
