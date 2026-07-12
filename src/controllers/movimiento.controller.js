import { prisma } from '../db.js';

/**
 * GET /api/movimientos
 * Módulo de Auditoría de Inventario (Solo Lectura).
 * Recupera el historial completo de logs de movimientos ordenados cronológicamente
 * del más reciente al más antiguo.
 */
export const getMovements = async (req, res, next) => {
  try {
    const { tipo } = req.query;

    const whereClause = {};
    if (tipo) {
      whereClause.tipo = tipo;
    }

    // ANÁLISIS CRÍTICO DE FALLOS Y ENFOQUE PEDAGÓGICO:
    // Anteriormente, este enrutador agrupaba los movimientos en memoria formateando
    // fechas en un formato personalizado de día/mes. Con el nuevo modelo relacional simplificado
    // y la lógica de negocio trasladada al backend ("Lógica Oculta"), el controlador ahora lee
    // de forma directa y eficiente logs pre-redactados y estructurados.
    // CÓMO Y POR QUÉ: Se realiza una consulta limpia a la tabla Movimiento con un ordenamiento
    // explícito por 'fecha DESC' (orden histórico) para agilizar el consumo del frontend
    // y optimizar el plan de ejecución en PostgreSQL.
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
