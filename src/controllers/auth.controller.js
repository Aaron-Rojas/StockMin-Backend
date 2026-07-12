import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';

/**
 * Registra un nuevo usuario comercial en la base de datos hasheando su credencial.
 * Body: { email, password, nombre }
 */
export const register = async (req, res, next) => {
  try {
    const { email, password, nombre } = req.body;

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

    const existingUser = await prisma.usuario.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'El correo electrónico ya está registrado.'
      });
    }

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
 * Autentica un usuario comercial y emite un token JWT firmado de acceso.
 * Body: { email, password }
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'El email y la contraseña son obligatorios.'
      });
    }

    const user = await prisma.usuario.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Credenciales inválidas.'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Credenciales inválidas.'
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, nombre: user.nombre },
      process.env.JWT_SECRET,
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
