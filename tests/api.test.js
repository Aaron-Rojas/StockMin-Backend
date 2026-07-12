import 'dotenv/config';
import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Instancia mock de Prisma compartida por todo el ciclo del test
export const mockPrisma = {
  usuario: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  producto: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  lote: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  venta: {
    create: jest.fn(),
  },
  detalleVenta: {
    create: jest.fn(),
  },
  movimiento: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

// ANÁLISIS CRÍTICO DE FALLOS Y ENFOQUE PEDAGÓGICO:
// Anteriormente, mockear el archivo relativo '../src/db.js' fallaba silenciosamente en ES Modules
// porque las rutas de los controladores importaban '../db.js', lo que causaba que Jest no asociara
// el mock y ejecutara llamadas reales a PostgreSQL en Neon.
// CÓMO Y POR QUÉ: Se mockea el paquete raíz '@prisma/client' directamente. Al interceptar el constructor
// de PrismaClient (tanto para named como default imports), garantizamos que todas las llamadas de base de datos
// en cualquier archivo del proyecto usen de forma homogénea el objeto mockPrisma mockeado.

jest.unstable_mockModule('@prisma/client', () => {
  const mockClientClass = jest.fn().mockImplementation(() => mockPrisma);
  return {
    __esModule: true,
    PrismaClient: mockClientClass,
    default: {
      PrismaClient: mockClientClass
    }
  };
});

// Importaciones asíncronas para cargar los módulos después del mockeo
const { default: app } = await import('../src/app.js');
const { prisma } = await import('../src/db.js');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_stockmin_2026';

// Generamos un token JWT de prueba firmado con la clave secreta
const mockToken = jwt.sign(
  { id: 'user-uuid-123', email: 'admin@tododar.com', nombre: 'Admin Prueba' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

describe('Suite de Pruebas Integradas y de Seguridad (POS StockMin)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/productos - Obtener Catálogo con Stock Dinámico', () => {
    test('Debe retornar la lista de productos si se proporciona un token válido', async () => {
      const mockDbProducts = [
        {
          id: 1,
          nombre: 'Leche Gloria',
          precioBase: 4.20,
          codigoBarras: '7750102030405',
          categoria: 'Lácteos',
          imagenUrl: 'https://image.url',
          stockMinimo: 10,
          lotes: [
            { id: 1, cantidadDisponible: 20 },
            { id: 2, cantidadDisponible: 15 }
          ]
        }
      ];

      mockPrisma.producto.findMany.mockResolvedValue(mockDbProducts);

      const response = await request(app)
        .get('/api/productos')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body[0].stock).toBe(35);
    });
  });

  describe('GET /api/productos/barcode/:barcode - Buscar por Código de Barras', () => {
    test('Debe retornar el producto si se proporciona token y existe el código', async () => {
      const mockProduct = {
        id: 2,
        nombre: 'Galletas Oreo',
        precioBase: 2.20,
        codigoBarras: '7750908070605',
        categoria: 'Snacks',
        imagenUrl: null,
        stockMinimo: 8,
        lotes: [{ id: 3, cantidadDisponible: 10 }]
      };

      mockPrisma.producto.findUnique.mockResolvedValue(mockProduct);

      const response = await request(app)
        .get('/api/productos/barcode/7750908070605')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.nombre).toBe('Galletas Oreo');
    });

    test('Debe devolver 404 si el código de barras no existe', async () => {
      mockPrisma.producto.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/productos/barcode/9999999999999')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('no coincide');
    });
  });

  describe('GET /api/productos/alertas - Alertas para el Home', () => {
    test('Debe retornar alertas autorizadas de vencimiento y de stock mínimo', async () => {
      const mockExpiringLots = [
        {
          id: 5,
          productoId: 1,
          cantidadDisponible: 10,
          fechaVencimiento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          producto: { nombre: 'Leche Gloria', codigoBarras: '7750102030405' }
        }
      ];

      const mockAllProducts = [
        {
          id: 2,
          nombre: 'Galletas Oreo',
          codigoBarras: '7750908070605',
          stockMinimo: 8,
          lotes: [{ cantidadDisponible: 3 }]
        }
      ];

      mockPrisma.lote.findMany.mockResolvedValue(mockExpiringLots);
      mockPrisma.producto.findMany.mockResolvedValue(mockAllProducts);

      const response = await request(app)
        .get('/api/productos/alertas')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.alertasVencimiento[0].nombreProducto).toBe('Leche Gloria');
    });
  });

  describe('POST /api/productos - Crear Catálogo', () => {
    test('Debe registrar un nuevo producto comercial con stock inicial en 0 si está autorizado', async () => {
      const payload = {
        nombre: 'Gaseosa Coca Cola',
        precioBase: '7.50',
        codigoBarras: '7750800000025',
        categoria: 'Bebidas',
        stockMinimo: 5
      };

      const mockCreated = {
        id: 3,
        nombre: payload.nombre,
        precioBase: 7.50,
        codigoBarras: payload.codigoBarras,
        categoria: payload.categoria,
        imagenUrl: null,
        stockMinimo: 5,
        lotes: []
      };

      mockPrisma.producto.findUnique.mockResolvedValue(null);
      mockPrisma.producto.findFirst.mockResolvedValue(null);
      mockPrisma.producto.create.mockResolvedValue(mockCreated);

      const response = await request(app)
        .post('/api/productos')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.stock).toBe(0);
    });

    test('Debe retornar 400 en creación si hay colisión de código de barras', async () => {
      const payload = {
        nombre: 'Gaseosa Sprite',
        precioBase: '7.00',
        codigoBarras: '7750800000025'
      };

      mockPrisma.producto.findUnique.mockResolvedValue({ id: 9 });

      const response = await request(app)
        .post('/api/productos')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('ya pertenece a otro producto');
    });
  });

  describe('PUT /api/productos/:id - Actualizar Producto', () => {
    test('Debe actualizar parcialmente el producto si tiene autorización', async () => {
      const payload = { nombre: 'Leche Gloria Deslactosada' };
      const mockExisting = { id: 1, nombre: 'Leche Gloria', codigoBarras: '7750102030405' };
      const mockUpdated = {
        id: 1,
        nombre: 'Leche Gloria Deslactosada',
        precioBase: 4.20,
        codigoBarras: '7750102030405',
        stockMinimo: 10,
        lotes: []
      };

      mockPrisma.producto.findUnique.mockResolvedValue(mockExisting);
      mockPrisma.producto.findFirst.mockResolvedValue(null);
      mockPrisma.producto.update.mockResolvedValue(mockUpdated);

      const response = await request(app)
        .put('/api/productos/1')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.nombre).toBe('Leche Gloria Deslactosada');
    });

    test('Debe retornar 400 si el ID provisto no es un entero', async () => {
      const response = await request(app)
        .put('/api/productos/no-valido')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ nombre: 'Prueba' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('debe ser un número entero válido');
    });
  });

  describe('POST /api/ventas - Módulo de Ventas POS', () => {
    test('Debe registrar una venta exitosa autorizada bajo PEPS', async () => {
      const mockProduct = { id: 1, nombre: 'Leche Gloria', precioBase: 4.20 };
      const mockLots = [
        { id: 1, productoId: 1, cantidadDisponible: 5, fechaVencimiento: new Date('2026-08-01') },
        { id: 2, productoId: 1, cantidadDisponible: 10, fechaVencimiento: new Date('2026-09-01') }
      ];
      const mockSale = { id: 12, fechaHora: new Date(), totalVenta: 21.00, metodoPago: 'Efectivo' };
      const mockDetail = { id: 101, ventaId: 12, productoId: 1, cantidadVendida: 5, precioUnitarioCongelado: 4.20 };

      mockPrisma.producto.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.lote.findMany.mockResolvedValue(mockLots);
      mockPrisma.venta.create.mockResolvedValue(mockSale);
      mockPrisma.detalleVenta.create.mockResolvedValue(mockDetail);

      const response = await request(app)
        .post('/api/ventas')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          metodoPago: 'Efectivo',
          detalles: [{ productoId: 1, cantidad: 5 }]
        });

      expect(response.status).toBe(201);
      expect(response.body.totalVenta).toBe('21.00');
    });

    test('Debe retornar 400 si el stock disponible consolidado es insuficiente', async () => {
      const mockProduct = { id: 1, nombre: 'Leche Gloria', precioBase: 4.20 };
      const mockLots = [
        { id: 1, productoId: 1, cantidadDisponible: 2, fechaVencimiento: new Date('2026-08-01') }
      ];

      mockPrisma.producto.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.lote.findMany.mockResolvedValue(mockLots);

      const response = await request(app)
        .post('/api/ventas')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          metodoPago: 'Yape',
          detalles: [{ productoId: 1, cantidad: 5 }]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Stock insuficiente');
    });
  });

  describe('GET /api/movimientos - Módulo de Auditoría', () => {
    test('Debe retornar la lista de movimientos si está autorizado', async () => {
      const mockMovements = [
        { id: 2, tipo: 'VENTA', descripcion: 'Venta ticket 12', fecha: new Date('2026-07-12T10:00:00Z') }
      ];

      mockPrisma.movimiento.findMany.mockResolvedValue(mockMovements);

      const response = await request(app)
        .get('/api/movimientos')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body[0].id).toBe(2);
    });
  });

  describe('🛡️ Módulo de Autenticación y Seguridad (JWT y Registro)', () => {
    test('POST /api/auth/register - Debe registrar un nuevo usuario y retornar sus datos sin contraseña', async () => {
      const payload = {
        email: 'nuevo@tododar.com',
        password: 'password123',
        nombre: 'Nuevo Empleado'
      };

      const mockDbUser = {
        id: 'user-uuid-999',
        email: payload.email,
        nombre: payload.nombre
      };

      mockPrisma.usuario.findUnique.mockResolvedValue(null);
      mockPrisma.usuario.create.mockResolvedValue(mockDbUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: 'user-uuid-999',
        email: 'nuevo@tododar.com',
        nombre: 'Nuevo Empleado'
      });
      expect(response.body.password).toBeUndefined();
    });

    test('POST /api/auth/register - Debe fallar si el correo electrónico ya existe', async () => {
      const payload = {
        email: 'duplicado@tododar.com',
        password: 'password123',
        nombre: 'Empleado'
      };

      mockPrisma.usuario.findUnique.mockResolvedValue({ id: 'user-uuid-existing' });

      const response = await request(app)
        .post('/api/auth/register')
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('ya está registrado');
    });

    test('POST /api/auth/login - Debe autenticar exitosamente y emitir un token JWT', async () => {
      const payload = {
        email: 'login@tododar.com',
        password: 'password123'
      };

      const hashedMockPassword = await bcrypt.hash(payload.password, 10);
      const mockDbUser = {
        id: 'user-uuid-777',
        email: payload.email,
        password: hashedMockPassword,
        nombre: 'Empleado Login'
      };

      mockPrisma.usuario.findUnique.mockResolvedValue(mockDbUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.nombre).toBe('Empleado Login');
    });

    test('POST /api/auth/login - Debe rechazar el inicio de sesión ante credenciales incorrectas', async () => {
      const payload = {
        email: 'login@tododar.com',
        password: 'password_erroneo'
      };

      const hashedMockPassword = await bcrypt.hash('password_correcto', 10);
      const mockDbUser = {
        id: 'user-uuid-777',
        email: payload.email,
        password: hashedMockPassword,
        nombre: 'Empleado Login'
      };

      mockPrisma.usuario.findUnique.mockResolvedValue(mockDbUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Credenciales inválidas');
    });

    test('Rutas Protegidas - Debe rechazar el acceso con error 401 si no se proporciona el token', async () => {
      const response = await request(app).get('/api/productos');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Token de acceso no proporcionado.'
      });
    });
  });
});
