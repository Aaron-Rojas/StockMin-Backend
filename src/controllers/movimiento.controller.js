import { prisma } from '../db.js';

/**
 * Recupera la bitácora completa de movimientos de inventario de forma cronológica descendente.
 * Query opcional: tipo (ej. "INGRESO_LOTE", "MERMA", "VENTA")
 */
export const getMovements = async (req, res, next) => {
  try {
    const { tipo } = req.query;

    const whereClause = {};
    if (tipo) {
      whereClause.tipo = tipo;
    }

    const movements = await prisma.movimiento.findMany({
      where: whereClause,
      orderBy: {
        fecha: 'desc'
      }
    });

    return res.status(200).json(movements);
  } catch (error) {
    return next(error);
  }
};
