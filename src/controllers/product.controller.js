import { prisma } from '../db.js';

const PRICE_REGEX = /^\d+(\.\d{2})?$/;

/**
 * Formatea un producto para cumplir con el contrato de la API.
 * Convierte el precio base a un string decimal de dos dígitos y calcula el stock dinámicamente.
 */
const formatProduct = (product) => {
  const stock = product.lotes
    ? product.lotes.reduce((sum, lot) => sum + lot.cantidadDisponible, 0)
    : 0;

  return {
    id: product.id,
    nombre: product.nombre,
    precioBase: parseFloat(product.precioBase).toFixed(2),
    codigoBarras: product.codigoBarras,
    categoria: product.categoria,
    imagenUrl: product.imagenUrl,
    stockMinimo: product.stockMinimo,
    stock: stock,
  };
};

/**
 * Obtiene la lista completa de productos con su stock acumulado calculado dinámicamente.
 */
export const getProducts = async (req, res, next) => {
  try {
    const products = await prisma.producto.findMany({
      include: {
        lotes: {
          where: { cantidadDisponible: { gt: 0 } }
        }
      },
      orderBy: { id: 'desc' },
    });

    const formatted = products.map(formatProduct);
    return res.status(200).json(formatted);
  } catch (error) {
    return next(error);
  }
};

/**
 * Busca un producto único por su código de barras.
 * Params: barcode
 */
export const getProductByBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.params;

    const product = await prisma.producto.findUnique({
      where: { codigoBarras: barcode },
      include: {
        lotes: {
          where: { cantidadDisponible: { gt: 0 } }
        }
      },
    });

    if (!product) {
      return res.status(404).json({
        error: 'El código de barras no coincide con ningún producto registrado.',
      });
    }

    return res.status(200).json(formatProduct(product));
  } catch (error) {
    return next(error);
  }
};

/**
 * Obtiene las alertas de vencimiento (lotes <= 7 días de vencer) y bajo stock (stock total <= stockMinimo).
 */
export const getProductAlerts = async (req, res, next) => {
  try {
    const now = new Date();
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() + 7);

    const expiringLots = await prisma.lote.findMany({
      where: {
        cantidadDisponible: { gt: 0 },
        fechaVencimiento: {
          lte: limitDate,
        },
      },
      include: {
        producto: true,
      },
    });

    const alertsVencimiento = expiringLots.map((lot) => {
      const timeDiff = new Date(lot.fechaVencimiento).getTime() - now.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      return {
        loteId: lot.id,
        productoId: lot.productoId,
        nombreProducto: lot.producto.nombre,
        codigoBarras: lot.producto.codigoBarras,
        cantidadDisponible: lot.cantidadDisponible,
        fechaVencimiento: lot.fechaVencimiento.toISOString(),
        diasParaVencer: daysDiff < 0 ? 0 : daysDiff,
      };
    });

    const products = await prisma.producto.findMany({
      include: {
        lotes: {
          where: { cantidadDisponible: { gt: 0 } }
        }
      }
    });

    const alertsStockMinimo = products
      .map((prod) => {
        const stockActual = prod.lotes.reduce((sum, lot) => sum + lot.cantidadDisponible, 0);
        return {
          productoId: prod.id,
          nombreProducto: prod.nombre,
          codigoBarras: prod.codigoBarras,
          stockMinimo: prod.stockMinimo,
          stockActual: stockActual,
        };
      })
      .filter((prodAlert) => prodAlert.stockActual <= prodAlert.stockMinimo);

    return res.status(200).json({
      alertasVencimiento: alertsVencimiento,
      alertasStockMinimo: alertsStockMinimo,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Registra un nuevo producto comercial.
 * Body: { nombre, precioBase, codigoBarras, categoria, imagenUrl, stockMinimo }
 */
export const createProduct = async (req, res, next) => {
  try {
    const { nombre, precioBase, codigoBarras, categoria, imagenUrl, stockMinimo } = req.body;

    if (!nombre || precioBase === undefined || !codigoBarras) {
      return res.status(400).json({
        error: 'El nombre, precioBase y codigoBarras son campos obligatorios.',
      });
    }

    if (nombre.trim().length < 2) {
      return res.status(400).json({
        error: 'El nombre del producto debe tener al menos 2 caracteres.',
      });
    }

    if (!PRICE_REGEX.test(precioBase)) {
      return res.status(400).json({
        error: 'El precioBase debe ser un string numérico decimal válido (ej. 7.50 o 7).',
      });
    }

    const minStock = stockMinimo !== undefined ? parseInt(stockMinimo, 10) : 5;
    if (isNaN(minStock) || minStock < 0) {
      return res.status(400).json({
        error: 'El stockMinimo debe ser un número entero no negativo.',
      });
    }

    const duplicateBarcode = await prisma.producto.findUnique({
      where: { codigoBarras },
    });

    if (duplicateBarcode) {
      return res.status(400).json({
        error: `El código de barras '${codigoBarras}' ya pertenece a otro producto.`,
      });
    }

    const duplicateName = await prisma.producto.findFirst({
      where: { nombre: { equals: nombre, mode: 'insensitive' } },
    });

    if (duplicateName) {
      return res.status(400).json({
        error: `El producto con el nombre '${nombre}' ya existe en el catálogo.`,
      });
    }

    const newProduct = await prisma.producto.create({
      data: {
        nombre,
        precioBase: parseFloat(precioBase),
        codigoBarras,
        categoria: categoria || null,
        imagenUrl: imagenUrl || null,
        stockMinimo: minStock,
      },
      include: {
        lotes: true,
      }
    });

    return res.status(201).json(formatProduct(newProduct));
  } catch (error) {
    return next(error);
  }
};

/**
 * Actualiza la información estática de un producto.
 * Params: id
 * Body: { nombre, precioBase, codigoBarras, categoria, imagenUrl, stockMinimo }
 */
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, precioBase, codigoBarras, categoria, imagenUrl, stockMinimo } = req.body;

    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      return res.status(400).json({
        error: 'El ID del producto proporcionado debe ser un número entero válido.',
      });
    }

    const existingProduct = await prisma.producto.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      return res.status(404).json({
        error: 'El producto solicitado para actualización no existe.',
      });
    }

    const updateData = {};

    if (nombre !== undefined) {
      if (nombre.trim().length < 2) {
        return res.status(400).json({
          error: 'El nombre del producto debe tener al menos 2 caracteres.',
        });
      }

      const duplicateName = await prisma.producto.findFirst({
        where: {
          nombre: { equals: nombre, mode: 'insensitive' },
          id: { not: productId },
        },
      });

      if (duplicateName) {
        return res.status(400).json({
          error: `El nombre '${nombre}' ya está registrado en otro producto.`,
        });
      }
      updateData.nombre = nombre;
    }

    if (precioBase !== undefined) {
      if (!PRICE_REGEX.test(precioBase)) {
        return res.status(400).json({
          error: 'El precioBase debe ser un string numérico decimal válido (ej. 7.50 o 7).',
        });
      }
      updateData.precioBase = parseFloat(precioBase);
    }

    if (codigoBarras !== undefined) {
      const duplicateBarcode = await prisma.producto.findFirst({
        where: {
          codigoBarras,
          id: { not: productId },
        },
      });

      if (duplicateBarcode) {
        return res.status(400).json({
          error: `El código de barras '${codigoBarras}' ya pertenece a otro producto.`,
        });
      }
      updateData.codigoBarras = codigoBarras;
    }

    if (categoria !== undefined) {
      updateData.categoria = categoria || null;
    }

    if (imagenUrl !== undefined) {
      updateData.imagenUrl = imagenUrl || null;
    }

    if (stockMinimo !== undefined) {
      const minStock = parseInt(stockMinimo, 10);
      if (isNaN(minStock) || minStock < 0) {
        return res.status(400).json({
          error: 'El stockMinimo debe ser un número entero no negativo.',
        });
      }
      updateData.stockMinimo = minStock;
    }

    const updatedProduct = await prisma.producto.update({
      where: { id: productId },
      data: updateData,
      include: {
        lotes: {
          where: { cantidadDisponible: { gt: 0 } }
        }
      }
    });

    return res.status(200).json(formatProduct(updatedProduct));
  } catch (error) {
    return next(error);
  }
};
