import { prisma } from '../src/db.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Carga de variables de entorno de .env para que PrismaClient conozca la DATABASE_URL
dotenv.config();

// ANÁLISIS CRÍTICO DE FALLOS Y ENFOQUE PEDAGÓGICO:
// Anteriormente, este script de seed cargaba un pool de conexiones crudas mediante 'pg' y 'PrismaPg'.
// Esto generaba código boilerplate redundante y propenso a errores de desconexión.
// Además, intentaba poblar la base de datos con campos obsoletos como 'stock' directo en la tabla 'Product'
// y utilizaba tablas antiguas (User, Product, InventoryMovement).
// CÓMO Y POR QUÉ: Se reescribe usando exclusivamente PrismaClient de forma directa para aprovechar
// capabilities del motor nativo (engineType = library).

async function main() {
  console.log('Iniciando el semillero de datos (Seeding)...');

  // Limpieza en cascada de datos antiguos
  await prisma.detalleVenta.deleteMany();
  await prisma.venta.deleteMany();
  await prisma.lote.deleteMany();
  await prisma.movimiento.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.usuario.deleteMany();

  console.log('🧹 Base de datos purgada.');

  // 1. Crear un usuario de prueba (Administrador)
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.usuario.create({
    data: {
      email: 'admin@tododar.com',
      password: hashedPassword,
      nombre: 'Admin Todo Dar',
    },
  });
  console.log(`✅ Usuario administrador creado: ${admin.email}`);

  // 2. Crear Productos
  const prodLeche = await prisma.producto.create({
    data: {
      nombre: 'Leche Gloria Evaporada 400g',
      precioBase: 4.20,
      codigoBarras: '7750102030405',
      categoria: 'Lácteos',
      stockMinimo: 10,
    },
  });

  const prodGalletas = await prisma.producto.create({
    data: {
      nombre: 'Galletas Oreo Rellenas 120g',
      precioBase: 2.20,
      codigoBarras: '7750908070605',
      categoria: 'Snacks',
      stockMinimo: 8,
    },
  });

  const prodGaseosa = await prisma.producto.create({
    data: {
      nombre: 'Gaseosa Inca Kola 1.5L',
      precioBase: 7.50,
      codigoBarras: '7750800000018',
      categoria: 'Bebidas',
      stockMinimo: 5,
    },
  });

  console.log('✅ Catálogo de productos creado.');

  // 3. Crear Lotes para cada producto para inicializar stock
  const fechaVencimientoLeche = new Date();
  fechaVencimientoLeche.setDate(fechaVencimientoLeche.getDate() + 45); // Vence en 45 días

  const fechaVencimientoGalletas = new Date();
  fechaVencimientoGalletas.setDate(fechaVencimientoGalletas.getDate() + 90); // Vence en 90 días

  // Gaseosa con vencimiento muy cercano para disparar alertas de prueba (ej. 4 días)
  const fechaVencimientoGaseosa = new Date();
  fechaVencimientoGaseosa.setDate(fechaVencimientoGaseosa.getDate() + 4);

  const loteLeche = await prisma.lote.create({
    data: {
      productoId: prodLeche.id,
      cantidadDisponible: 30,
      fechaVencimiento: fechaVencimientoLeche,
    },
  });

  const loteGalletas = await prisma.lote.create({
    data: {
      productoId: prodGalletas.id,
      cantidadDisponible: 50,
      fechaVencimiento: fechaVencimientoGalletas,
    },
  });

  const loteGaseosa = await prisma.lote.create({
    data: {
      productoId: prodGaseosa.id,
      cantidadDisponible: 4, // Hará saltar la alerta de stock mínimo ya que stockMinimo es 5
      fechaVencimiento: fechaVencimientoGaseosa, // Hará saltar la alerta de vencimiento (<= 7 días)
    },
  });

  console.log('✅ Lotes de inventario inicializados.');

  // 4. Registro de Movimiento de Auditoría
  await prisma.movimiento.create({
    data: {
      tipo: 'INGRESO_LOTE',
      descripcion: 'Carga inicial de sistema mediante Seed',
    },
  });

  console.log('✅ Log de movimiento inicial registrado.');
  console.log('🌱 Semillero ejecutado exitosamente al 100%.');
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    // Cerramos la conexión con el servidor de base de datos para liberar recursos.
    await prisma.$disconnect();
  });