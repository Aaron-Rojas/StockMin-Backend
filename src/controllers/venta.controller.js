import { prisma } from '../db.js';

/**
 * Registra una venta en el POS de forma atómica. Descuenta stock de lotes bajo método PEPS (FIFO),
 * congela los precios unitarios de venta e ingresa la auditoría del ticket.
 * Body: { detalles: [{ productoId, cantidad }], metodoPago }
 */
export const createSale = async (req, res, next) => {
  try {
    const { detalles, metodoPago } = req.body;

    if (!metodoPago || !detalles || !Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({
        error: 'El método de pago y los detalles del carrito de compras son obligatorios.'
      });
    }

    if (metodoPago !== 'Efectivo' && metodoPago !== 'Yape') {
      return res.status(400).json({
        error: 'El método de pago debe ser "Efectivo" o "Yape".'
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      let totalVenta = 0;
      const detailsToCreate = [];
      const itemsSummaryList = [];

      for (const item of detalles) {
        const { productoId, cantidad } = item;

        const prodId = parseInt(productoId, 10);
        const qty = parseInt(cantidad, 10);

        if (isNaN(prodId)) {
          throw new Error('INVALID_PRODUCT_ID');
        }

        if (isNaN(qty) || qty < 1) {
          throw new Error('INVALID_QUANTITY');
        }

        const product = await tx.producto.findUnique({
          where: { id: prodId }
        });

        if (!product) {
          throw new Error(`PRODUCT_NOT_FOUND:${prodId}`);
        }

        const activeLots = await tx.lote.findMany({
          where: {
            productoId: prodId,
            cantidadDisponible: { gt: 0 }
          },
          orderBy: [
            { fechaVencimiento: 'asc' },
            { fechaIngreso: 'asc' }
          ]
        });

        const totalAvailableStock = activeLots.reduce((sum, lot) => sum + lot.cantidadDisponible, 0);
        if (totalAvailableStock < qty) {
          throw new Error(`INSUFFICIENT_STOCK:${product.nombre}:${qty}:${totalAvailableStock}`);
        }

        let remainingToDeduct = qty;
        for (const lot of activeLots) {
          if (remainingToDeduct <= 0) break;

          if (lot.cantidadDisponible >= remainingToDeduct) {
            await tx.lote.update({
              where: { id: lot.id },
              data: { cantidadDisponible: lot.cantidadDisponible - remainingToDeduct }
            });
            remainingToDeduct = 0;
          } else {
            remainingToDeduct -= lot.cantidadDisponible;
            await tx.lote.update({
              where: { id: lot.id },
              data: { cantidadDisponible: 0 }
            });
          }
        }

        const subtotal = qty * parseFloat(product.precioBase);
        totalVenta += subtotal;

        detailsToCreate.push({
          productoId: prodId,
          cantidadVendida: qty,
          precioUnitarioCongelado: product.precioBase
        });

        itemsSummaryList.push(`${product.nombre} (x${qty})`);
      }

      const sale = await tx.venta.create({
        data: {
          totalVenta,
          metodoPago
        }
      });

      const createdDetails = [];
      for (const detail of detailsToCreate) {
        const d = await tx.detalleVenta.create({
          data: {
            ventaId: sale.id,
            productoId: detail.productoId,
            cantidadVendida: detail.cantidadVendida,
            precioUnitarioCongelado: detail.precioUnitarioCongelado
          }
        });
        createdDetails.push(d);
      }

      const itemsDescription = itemsSummaryList.join(', ');
      await tx.movimiento.create({
        data: {
          tipo: 'VENTA',
          descripcion: `Venta POS registrada. Ticket #${sale.id}. Método: ${metodoPago}. Total: S/. ${totalVenta.toFixed(2)}. Productos: ${itemsDescription}.`
        }
      });

      return {
        id: sale.id,
        fechaHora: sale.fechaHora,
        totalVenta: parseFloat(sale.totalVenta).toFixed(2),
        metodoPago: sale.metodoPago,
        detalles: createdDetails.map(d => ({
          id: d.id,
          productoId: d.productoId,
          cantidadVendida: d.cantidadVendida,
          precioUnitarioCongelado: parseFloat(d.precioUnitarioCongelado).toFixed(2)
        }))
      };
    });

    return res.status(201).json(result);
  } catch (error) {
    if (error.message === 'INVALID_PRODUCT_ID') {
      return res.status(400).json({ error: 'Uno o más productoId no son números enteros válidos.' });
    }
    if (error.message === 'INVALID_QUANTITY') {
      return res.status(400).json({ error: 'La cantidad de venta debe ser un entero mayor o igual a 1.' });
    }
    if (error.message.startsWith('PRODUCT_NOT_FOUND:')) {
      const prodId = error.message.split(':')[1];
      return res.status(404).json({ error: `El producto con ID ${prodId} no existe en el catálogo.` });
    }
    if (error.message.startsWith('INSUFFICIENT_STOCK:')) {
      const [, productName, requested, available] = error.message.split(':');
      return res.status(400).json({
        error: `Stock insuficiente para el producto '${productName}'. Requerido: ${requested}, Disponible: ${available}.`
      });
    }

    return next(error);
  }
};
