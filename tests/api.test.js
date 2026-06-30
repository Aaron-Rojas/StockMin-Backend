import 'dotenv/config';
import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mockeo dinámico de la base de datos para aislar los tests de la base de datos de desarrollo
jest.unstable_mockModule('../src/db.js', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    inventoryMovement: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

// Importaciones asíncronas para respetar la carga de ES Modules mockeados
const { default: app } = await import('../src/app.js');
const { prisma } = await import('../src/db.js');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_stockmin_2026';

// Generamos un token JWT de prueba firmado con la clave secreta
const mockToken = jwt.sign(
  { id: 'user-uuid-123', email: 'admin@stockmin.com', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

describe('Tests de Integración y Validación de la API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    test('Debe rechazar el inicio de sesión si el correo no existe en la base de datos', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@stockmin.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Credenciales inválidas.' });
    });
  });

  describe('GET /api/productos', () => {
    test('Debe rechazar la consulta del catálogo con error 401 si no se proporciona el token JWT', async () => {
      const response = await request(app)
        .get('/api/productos');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Token de acceso no proporcionado.' });
    });
  });

  describe('POST /api/movimientos - Validación Estricta de Tipos', () => {
    test('Debe devolver error 400 si productoId es un número en lugar de una cadena de texto', async () => {
      const response = await request(app)
        .post('/api/movimientos')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          tipo: 'entrada',
          cantidad: 10,
          productoId: 1, // Tipo numérico inválido según la validación estricta
          proveedor: 'Proveedor Central',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'El productoId debe ser una cadena de texto válida.' });
    });

    test('Debe devolver error 400 si la cantidad no es numérica ni string convertible', async () => {
      const response = await request(app)
        .post('/api/movimientos')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          tipo: 'entrada',
          cantidad: { cantidad: 10 }, // Objeto inválido
          productoId: 'product-uuid-123',
          proveedor: 'Proveedor Central',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'La cantidad debe ser un número o una cadena numérica válida.' });
    });
  });
});
