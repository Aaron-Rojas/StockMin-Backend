import pkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// CÓMO: Cargar manualmente las variables de entorno de .env.
// POR QUÉ: Al ejecutarse este script de forma aislada a través del CLI, Node.js no carga
// automáticamente el archivo .env a menos que invoquemos explícitamente a dotenv.config().
dotenv.config();

const { PrismaClient } = pkg;
const { Pool } = pg;

// CÓMO: Crear un Pool de conexiones físicas usando la biblioteca nativa 'pg'.
// POR QUÉ: Administra de manera eficiente los sockets TCP de conexión con PostgreSQL, 
// reciclando y manteniendo canales de comunicación abiertos para optimizar el rendimiento.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// CÓMO: Instanciar el adaptador PrismaPg pasando el pool de conexión.
// POR QUÉ: Prisma 7.x requiere un Driver Adapter para delegar las llamadas SQL nativas a la base de datos 
// en entornos locales y productivos, reduciendo la dependencia de motores de consulta binarios.
const adapter = new PrismaPg(pool);

// Inicialización de Prisma Client utilizando la interfaz del adaptador PostgreSQL
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando el semillero de datos (Seeding)...');


  await prisma.inventoryMovement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@stockmin.com',
      password: hashedPassword,
      name: 'Admin Principal',
      role: 'admin',
    },
  });
  console.log(`✅ Usuario admin creado: ${admin.email}`);

  const productos = await prisma.product.createMany({
    data: [
      { name: 'Inca Kola 1.5L', price: 7.50, stock: 50, barcode: '775080000001' },
      { name: 'Coca Cola 1.5L', price: 7.50, stock: 45, barcode: '775080000002' },
      { name: 'Agua San Luis 2.5L', price: 3.50, stock: 30, barcode: '775080000003' },
      { name: 'Galletas Oreo', price: 1.50, stock: 100, barcode: '775080000004' },
      { name: 'Papas Lays Clásicas', price: 2.00, stock: 80, barcode: '775080000005' },
      { name: 'Leche Gloria Evaporada', price: 4.20, stock: 60, barcode: '775080000006' },
      { name: 'Arroz Costeño 1kg', price: 4.80, stock: 40, barcode: '775080000007' },
      { name: 'Aceite Primor Premium 1L', price: 9.50, stock: 25, barcode: '775080000008' },
      { name: 'Atún Florida Trozos', price: 5.50, stock: 50, barcode: '775080000009' },
      { name: 'Fideos Don Vittorio Espagueti', price: 2.80, stock: 70, barcode: '775080000010' },
    ],
  });
  
  console.log(`✅ ${productos.count} productos creados exitosamente en el catálogo.`);
  console.log('Semillero ejecutado al 100%.');
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    // Cerramos la conexión con el servidor de base de datos para no dejar sockets abiertos e impedir fugas de memoria.
    await prisma.$disconnect();
    // Cerramos también el pool de conexiones de pg para liberar los sockets y que el proceso de Node finalice limpiamente.
    await pool.end();
  });