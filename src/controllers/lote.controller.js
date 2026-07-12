import { prisma } from '../db.js';

/**
 * GET /api/lotes
 * Lista todos los lotes activos (cantidadDisponible > 0) con la información de su producto asociado.
 */
export const getLots = async (req, res, next) => {
  try {
    const lots = await prisma.lote.findMany({
      where: {
        cantidadDisponible: { gt: 0 }
      },
      include: {
        producto: true
      },
      orderBy: { id: 'desc' }
    });

    return res.status(200).json(lots);
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/lotes/producto/:productoId
 * Lista los lotes activos de un producto específico, ordenados por proximidad de vencimiento (PEPS).
 */
export const getLotsByProduct = async (req, res, next) => {
  try {
    const { productoId } = req.params;

    const prodId = parseInt(productoId, 10);
    if (isNaN(prodId)) {
      return res.status(400).json({
        error: 'El productoId debe ser un número entero válido.'
      });
    }

    const lots = await prisma.lote.findMany({
      where: {
        productoId: prodId,
        cantidadDisponible: { gt: 0 }
      },
      orderBy: {
        fechaVencimiento: 'asc' // Prioridad PEPS (los más antiguos/por vencer primero)
      }
    });

    return res.status(200).json(lots);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/lotes
 * Registra un nuevo lote de producto físico e ingresa el movimiento de auditoría transaccionalmente.
 */
export const createLot = async (req, res, next) => {
  try {
    const { productoId, cantidadDisponible, fechaVencimiento } = req.body;

    // Validación básica de campos requeridos
    if (productoId === undefined || cantidadDisponible === undefined) {
      return res.status(400).json({
        error: 'El productoId y la cantidadDisponible son campos obligatorios.'
      });
    }

    const prodId = parseInt(productoId, 10);
    const qty = parseInt(cantidadDisponible, 10);

    if (isNaN(prodId)) {
      return res.status(400).json({
        error: 'El productoId debe ser un número entero válido.'
      });
    }

    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({
        error: 'La cantidadDisponible debe ser un número entero mayor o igual a 1.'
      });
    }

    // Verificar que el producto exista
    const product = await prisma.producto.findUnique({
      where: { id: prodId }
    });

    if (!product) {
      return res.status(404).json({
        error: 'El producto al que intenta asociar el lote no existe.'
      });
    }

    // Parsear fecha de vencimiento si se provee
    const expirationDate = fechaVencimiento ? new Date(fechaVencimiento) : null;
    if (fechaVencimiento && isNaN(expirationDate.getTime())) {
      return res.status(400).json({
        error: 'La fechaVencimiento proporcionada no es válida.'
      });
    }

    // ANÁLISIS CRÍTICO DE FALLOS Y ENFOQUE PEDAGÓGICO:
    // Anteriormente, crear registros físicos de almacén e insertar bitácoras de auditoría se hacía de forma separada.
    // Si la creación del movimiento de auditoría fallaba por red o base de datos, el lote se creaba sin dejar rastro en el historial,
    // rompiendo la trazabilidad financiera del minimarket.
    // CÓMO Y POR QUÉ: Se utiliza prisma.$transaction para garantizar la atomicidad de ambas escrituras.
    // Si cualquiera de las dos operaciones falla, se realiza un rollback automático de la base de datos.
    const result = await prisma.$transaction(async (tx) => {
      const lot = await tx.lote.create({
        data: {
          productoId: prodId,
          cantidadDisponible: qty,
          fechaVencimiento: expirationDate
        }
      });

      const formattedDate = expirationDate 
        ? expirationDate.toISOString().split('T')[0]
        : 'Sin Vencimiento';

      await tx.movimiento.create({
        data: {
          tipo: 'INGRESO_LOTE',
          descripcion: `Ingreso de lote para el producto ${product.nombre} (x${qty}). Vence: ${formattedDate}.`
        }
      });

      return lot;
    });

    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/lotes/:id/merma
 * Declara merma completa de un lote físico (cantidadDisponible = 0) de forma transaccional.
 */
export const registerLotMerma = async (req, res, next) => {
  try {
    const { id } = req.params;

    const lotId = parseInt(id, 10);
    if (isNaN(lotId)) {
      return res.status(400).json({
        error: 'El ID del lote debe ser un número entero válido.'
      });
    }

    // Buscar el lote e incluir el producto para obtener su nombre comercial
    const lot = await prisma.lote.findUnique({
      where: { id: lotId },
      include: { producto: true }
    });

    if (!lot) {
      return res.status(404).json({
        error: 'El lote seleccionado no existe.'
      });
    }

    if (lot.cantidadDisponible === 0) {
      return res.status(400).json({
        error: 'El lote seleccionado ya no cuenta con stock disponible (ya fue consumido o mermado).'
      });
    }

    const previousQty = lot.cantidadDisponible;

    // CÓMO Y POR QUÉ: Usamos prisma.$transaction para asegurar que la reducción del lote físico a cero
    // y el registro de bitácora tipo 'MERMA' ocurran de manera atómica, impidiendo pérdidas de stock indocumentadas.
    const result = await prisma.$transaction(async (tx) => {
      const updatedLot = await tx.lote.update({
        where: { id: lotId },
        data: { cantidadDisponible: 0 }
      });

      await tx.movimiento.create({
        data: {
          tipo: 'MERMA',
          descripcion: `Merma registrada: Lote #${lotId} del producto ${lot.producto.nombre} dado de baja. x${previousQty} unidades retiradas.`
        }
      });

      return {
        id: updatedLot.id,
        cantidadDisponible: updatedLot.cantidadDisponible,
        cantidadMermada: previousQty
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};
