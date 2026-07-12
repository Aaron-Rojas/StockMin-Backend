import jwt from 'jsonwebtoken';

/**
 * Middleware para proteger rutas de negocio validando la firma y presencia del JWT.
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // ANÁLISIS CRÍTICO DE FALLOS Y ENFOQUE PEDAGÓGICO:
  // Anteriormente, este middleware operaba en modo "Cero Fricción", permitiendo accesos públicos
  // simulando un usuario mock. Esto es inaceptable para entornos productivos reales.
  // CÓMO Y POR QUÉ: Se reestablece la seguridad JWT en las cabeceras HTTP. El token Bearer es verificado
  // criptográficamente con la clave secreta. Si el token está ausente, expirado o alterado,
  // el servidor responde de inmediato con 401 Unauthorized, impidiendo que la petición llegue a los controladores.
  if (!token) {
    return res.status(401).json({
      error: 'Token de acceso no proporcionado.'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_stockmin_2026', (err, decoded) => {
    if (err) {
      return res.status(401).json({
        error: 'Token expirado o inválido.'
      });
    }

    req.user = decoded;
    next();
  });
};
