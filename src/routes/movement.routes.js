import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Protegemos todas las rutas con el middleware de autenticación JWT
router.use(authenticateToken);

/**
 * Formatea la hora de una fecha en formato 24h + am/pm según el contrato de la API ("16:35 pm")
 * 
 * @param {Date} date - Objeto fecha.
 * @returns {string} Hora formateada.
 */
const formatMovementTime = (date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = date.getHours() >= 12 ? 'pm' : 'am';
  return `${hours}:${minutes} ${ampm}`;
};

/**
 * Obtiene la etiqueta del día relativo ('Hoy', 'Ayer', o el nombre del día de la semana)
 * 
 * @param {string} dateStr - Cadena de fecha en formato YYYY-MM-DD.
 * @returns {string} Etiqueta del día.
 */
const getDayLabel = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - target.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';

  const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return daysOfWeek[target.getDay()];
};

/**
 * Obtiene el formato del mes en español (ej. "22 de Abril")
 * 
 * @param {string} dateStr - Cadena de fecha en formato YYYY-MM-DD.
 * @returns {string} Fecha con mes formateado.
 */
const getMonthLabel = (dateStr) => {
  const date = new Date(dateStr + 'T00:00:00');
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return `${date.getDate()} de ${months[date.getMonth()]}`;
};

/**
 * @openapi
 * /api/movimientos:
 *   get:
 *     summary: Obtiene la lista de movimientos agrupada por fecha
 */
router.get('/', async (req, res, next) => {
  try {
    const { tipo } = req.query;

    const whereClause = {};
    if (tipo === 'entrada' || tipo === 'salida') {
      whereClause.type = tipo;
    }

    const movements = await prisma.inventoryMovement.findMany({
      where: whereClause,
      include: {
        product: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Agrupación en memoria por día (YYYY-MM-DD)
    const grouped = {};
    for (const mov of movements) {
      const year = mov.createdAt.getFullYear();
      const month = String(mov.createdAt.getMonth() + 1).padStart(2, '0');
      const day = String(mov.createdAt.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          fechaDia: getDayLabel(dateKey),
          fechaMes: getMonthLabel(dateKey),
          totalQty: 0,
          productos: [],
        };
      }

      grouped[dateKey].totalQty += mov.quantity;
      grouped[dateKey].productos.push({
        nombre: mov.product.name,
        cantidad: String(mov.quantity),
        hora: formatMovementTime(mov.createdAt),
      });
    }

    // Convertimos el mapa agrupado a la estructura de array requerida por el contrato
    const result = Object.keys(grouped).map((dateKey) => ({
      fechaDia: grouped[dateKey].fechaDia,
      fechaMes: grouped[dateKey].fechaMes,
      cantidadTotal: String(grouped[dateKey].totalQty),
      productos: grouped[dateKey].productos,
    }));

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

/**
 * @openapi
 * /api/movimientos:
 *   post:
 *     summary: Registra un nuevo movimiento de inventario con actualización transaccional
 */
router.post('/', async (req, res, next) => {
  try {
    const { tipo, cantidad, productoId, proveedor } = req.body;
    const usuarioId = req.user.id;

    if (tipo === undefined || cantidad === undefined || productoId === undefined) {
      return res.status(400).json({ error: 'Faltan campos obligatorios en la petición.' });
    }

    // Validación estricta de tipos de datos para evitar colapso de consultas en Prisma
    if (typeof productoId !== 'string') {
      return res.status(400).json({ error: 'El productoId debe ser una cadena de texto válida.' });
    }

    if (typeof tipo !== 'string') {
      return res.status(400).json({ error: 'El tipo debe ser una cadena de texto válida.' });
    }

    if (typeof cantidad !== 'number' && typeof cantidad !== 'string') {
      return res.status(400).json({ error: 'La cantidad debe ser un número o una cadena numérica válida.' });
    }

    if (proveedor !== undefined && typeof proveedor !== 'string') {
      return res.status(400).json({ error: 'El proveedor debe ser una cadena de texto válida.' });
    }

    if (tipo !== 'entrada' && tipo !== 'salida') {
      return res.status(400).json({ error: 'Tipo de movimiento inválido. Debe ser entrada o salida.' });
    }

    const qty = parseInt(cantidad, 10);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({ error: 'La cantidad debe ser un número entero mayor o igual a 1.' });
    }

    if (tipo === 'entrada' && !proveedor) {
      return res.status(400).json({ error: 'El proveedor es obligatorio para movimientos de entrada.' });
    }

    // Transacción atómica en base de datos para asegurar consistencia del stock
    const newMovement = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productoId },
      });

      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      if (tipo === 'salida' && product.stock < qty) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          type: tipo,
          quantity: qty,
          productId: productoId,
          userId: usuarioId,
          supplier: tipo === 'entrada' ? proveedor : null,
        },
      });

      const updatedStock = tipo === 'entrada' ? product.stock + qty : product.stock - qty;

      await tx.product.update({
        where: { id: productoId },
        data: { stock: updatedStock },
      });

      return movement;
    });

    return res.status(201).json({
      id: newMovement.id,
      tipo: newMovement.type,
      cantidad: newMovement.quantity,
      productoId: newMovement.productId,
      usuarioId: newMovement.userId,
      proveedor: newMovement.supplier || undefined,
      fecha: newMovement.createdAt.toISOString(),
    });
  } catch (error) {
    if (error.message === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({ error: 'El producto especificado no existe.' });
    }
    if (error.message === 'INSUFFICIENT_STOCK') {
      return res.status(400).json({ error: 'Stock insuficiente para realizar la venta.' });
    }
    return next(error);
  }
});

export default router;
