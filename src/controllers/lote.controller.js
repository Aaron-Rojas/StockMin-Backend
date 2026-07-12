import { prisma } from '../db.js';

/**
 * Obtiene la lista completa de lotes activos (cantidadDisponible > 0).
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
 * Recupera los lotes activos de un producto particular ordenados cronológicamente por vencimiento (PEPS).
 * Params: productoId
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
        fechaVencimiento: 'asc'
      }
    });

    return res.status(200).json(lots);
  } catch (error) {
    return next(error);
  }
};

/**
 * Registra un nuevo lote de producto físico y registra su ingreso en auditoría.
 * Body: { productoId, cantidadDisponible, fechaVencimiento }
 */
export const createLot = async (req, res, next) => {
  try {
    const { productoId, cantidadDisponible, fechaVencimiento } = req.body;

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

    const product = await prisma.producto.findUnique({
      where: { id: prodId }
    });

    if (!product) {
      return res.status(404).json({
        error: 'El producto al que intenta asociar el lote no existe.'
      });
    }

    const expirationDate = fechaVencimiento ? new Date(fechaVencimiento) : null;
    if (fechaVencimiento && isNaN(expirationDate.getTime())) {
      return res.status(400).json({
        error: 'La fechaVencimiento proporcionada no es válida.'
      });
    }

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
 * Da de baja por completo un lote y genera el registro de merma correspondiente.
 * Params: id
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
