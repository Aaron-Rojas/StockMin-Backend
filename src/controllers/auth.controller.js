import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';

/**
 * POST /api/auth/register
 * Registra un nuevo usuario hasheando su contraseña.
 */
export const register = async (req, res, next) => {
  try {
    const { email, password, nombre } = req.body;

    // VALIDACIÓN DE CAMPOS OBLIGATORIOS (SRP)
    if (!email || !password || !nombre) {
      return res.status(400).json({
        error: 'El email, password y nombre son campos obligatorios.'
      });
    }

    if (password.trim().length < 6) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 6 caracteres.'
      });
    }

    // Verificar si el email ya existe en la base de datos
    const existingUser = await prisma.usuario.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'El correo electrónico ya está registrado.'
      });
    }

    // ANÁLISIS CRÍTICO DE FALLOS Y ENFOQUE PEDAGÓGICO:
    // Guardar contraseñas en texto plano representa la peor vulnerabilidad de seguridad.
    // CÓMO Y POR QUÉ: Se utiliza bcryptjs para hashear la contraseña con un factor de costo (salt rounds) de 10.
    // Esto genera un hash unidireccional criptográficamente seguro, impidiendo la recuperación de la contraseña
    // original incluso si la base de datos es comprometida.
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.usuario.create({
      data: {
        email,
        password: hashedPassword,
        nombre
      }
    });

    return res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      nombre: newUser.nombre
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/auth/login
 * Autentica al usuario y emite un token JWT firmado.
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'El email y la contraseña son obligatorios.'
      });
    }

    // Buscar al usuario por correo electrónico
    const user = await prisma.usuario.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Credenciales inválidas.'
      });
    }

    // Verificar contraseña usando comparación segura con bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Credenciales inválidas.'
      });
    }

    // CÓMO Y POR QUÉ: Tras verificar la contraseña con éxito, firmamos un token JWT (JSON Web Token)
    // conteniendo los datos de sesión en su payload. El token expira en 24 horas y se firma con
    // la llave secreta definida en variables de entorno, blindando la sesión de manipulaciones externas.
    const token = jwt.sign(
      { id: user.id, email: user.email, nombre: user.nombre },
      process.env.JWT_SECRET || 'super_secret_jwt_key_stockmin_2026',
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre
      }
    });
  } catch (error) {
    return next(error);
  }
};
