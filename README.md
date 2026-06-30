# StockMin - API REST Backend

![Node.js](https://img.shields.io/badge/Node.js-v20-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-v5-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v16-4169E1?logo=postgresql&logoColor=white)
![Prisma ORM](https://img.shields.io/badge/Prisma-v7-2D3748?logo=prisma&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-v30-C21325?logo=jest&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-alpine-2496ED?logo=docker&logoColor=white)
![Render](https://img.shields.io/badge/Render-deploy-46E3B7?logo=render&logoColor=white)

Esta aplicación corresponde a la API REST de **StockMin**, el núcleo de lógica de negocio y persistencia de datos diseñado para dar soporte a un sistema de control y auditoría de inventario para minimarkets. La solución técnica centraliza la gestión de accesos mediante autenticación criptográfica, implementa validaciones estrictas de payloads para blindar la capa de datos de PostgreSQL, y automatiza las transacciones de almacén (actualizaciones de stock) bajo un esquema atómico y consistente.

Para examinar el historial del desarrollo paso a paso por fases y diagramas de arquitectura de base de datos en PlantUML, consulte el [ROADMAP.md](./ROADMAP.md).

---

## 🛠️ Stack Tecnológico

- **Entorno de Ejecución**: Node.js (arquitectura basada en ES Modules nativos).
- **Servidor Web**: Express.js (configuración modularizada en rutas y controladores).
- **Base de Datos**: PostgreSQL (proveedor Neon DB en la nube).
- **Mapeo Objeto-Relacional (ORM)**: Prisma ORM (versión 7.x, integrada con Driver Adapters de PostgreSQL para conectividad optimizada sin motores Rust locales).
- **Seguridad**: JSON Web Tokens (JWT) para control de accesos de rol y cifrado de contraseñas mediante `bcryptjs`.
- **Pruebas Automatizadas**: Jest y Supertest (suite de tests de integración con aislamiento de base de datos física mediante mockeos dinámicos).
- **Contenedores**: Docker (construcción multi-etapa optimizada con base Node Alpine).
- **Automatización**: GitHub Actions (tubería de CI/CD integrada).

---

## 🚀 Despliegue y CI/CD

- **URL de Producción**: [https://stockmin-backend.onrender.com](https://stockmin-backend.onrender.com)
- **Integración y Despliegue Continuo**: Al hacer un `push` a la rama `deploy` en GitHub, se dispara una tubería automatizada que realiza el checkout del código, monta Node.js, descarga e instala las dependencias de desarrollo, compila el cliente Prisma, ejecuta la suite de tests unitarios, y gatilla un deploy webhook en Render para reconstruir el contenedor Docker en producción únicamente si todas las verificaciones son exitosas.

---

## 🔑 Funcionalidades y Endpoints

🔐 **Autenticación**: `POST /api/auth/login`
- Validación de credenciales de usuario (email y password) y emisión de token JWT firmado con validez de 24 horas.

📦 **Catálogo (Listar)**: `GET /api/productos`
- Recuperación del catálogo completo de productos con formateo decimal de precios a string para evitar imprecisiones aritméticas flotantes. Protegido por JWT.

📦 **Catálogo (Buscar Código)**: `GET /api/productos/barcode/:barcode`
- Búsqueda unitaria por código de barras para la lectura rápida mediante la cámara de la aplicación móvil. Protegido por JWT.

📦 **Catálogo (Crear)**: `POST /api/productos`
- Registro de un nuevo producto validando unicidad de código de barras, longitud mínima de caracteres en nombre, consistencia decimal de precios y stock no negativo. Protegido por JWT.

📦 **Catálogo (Actualizar)**: `PUT /api/productos/:id`
- Modificación parcial o total de la información de catálogo controlando que no se generen duplicidades de códigos de barras existentes. Protegido por JWT.

🔄 **Transacciones**: `POST /api/movimientos`
- Registro de entradas (compras) o salidas (ventas/mermas) bajo una transacción atómica de base de datos (`prisma.$transaction`). Captura la identidad del usuario directamente del token JWT, exige proveedor para ingresos, valida disponibilidad de existencias para salidas y actualiza automáticamente el stock consolidado del producto. Protegido por JWT.

📊 **Auditoría**: `GET /api/movimientos`
- Historial agrupado cronológicamente por día relativo ("Hoy", "Ayer", o día de la semana) y mes, con suma consolidada de existencias transferidas diaria y formateo de hora AM/PM para reportería. Protegido por JWT.

---

## 💻 Instalación y Ejecución Local

### 1. Clonar e Instalar Dependencias
```bash
npm install
```

### 2. Configurar Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto y define los siguientes parámetros:
```env
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/stockmin?schema=public"
PORT=5000
JWT_SECRET="clave_secreta_jwt"
```

### 3. Generar Modelos del ORM
```bash
npx prisma generate
```

### 4. Iniciar el Servidor en Desarrollo
```bash
npm run dev
```

### 5. Ejecutar Suite de Pruebas
```bash
npm test
```
