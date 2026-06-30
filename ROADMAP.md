# Hoja de Ruta de Desarrollo (Roadmap) - StockMin Backend

Esta hoja de ruta detalla de manera estructurada e incremental las fases y tareas necesarias para construir el backend de la aplicación **StockMin** utilizando la arquitectura de **Node.js**, **Express** y **PostgreSQL (vía Prisma ORM)**, culminando con su despliegue seguro en la nube.

---

## Fase 1: Inicialización, Arquitectura y Modelado de Datos 📌 (Fase Actual)
El objetivo es sentar las bases del proyecto, definir las dependencias core y la estructura del esquema relacional de datos.

- [x] **1.1. Inicialización del Entorno**:
  - Configuración inicial de Node.js (`package.json`) y definición de dependencias (`express`, `cors`, `dotenv`, `@prisma/client`, `prisma`, `nodemon`).
  - Habilitar soporte para ES Modules (`"type": "module"`) para un estándar de desarrollo moderno y limpio.
- [x] **1.2. Diseño y Configuración del ORM (Prisma)**:
  - Inicialización de Prisma (`npx prisma init`).
  - Configuración del proveedor de base de datos PostgreSQL en el archivo `schema.prisma`.
  - Definición de modelos (`User`, `Product`, `InventoryMovement`) de acuerdo al modelo relacional, omitiendo categorías no especificadas en el contrato.
- [x] **1.3. Documentación del Modelo**:
  - Creación del diagrama de entidad-relación (ERD) en PlantUML (`docs/entidades.puml`) representando el catálogo de productos, usuarios y movimientos.

---

## Fase 2: Conexión a Base de Datos y Migraciones 🗄️
Establecer la comunicación física con PostgreSQL y aplicar la estructura diseñada en la base de datos de desarrollo.

- [ ] **2.1. Conexión a la Base de Datos**:
  - Configuración de la variable de entorno `DATABASE_URL` en el archivo `.env`.
- [ ] **2.2. Migraciones con Prisma**:
  - Ejecutar las migraciones iniciales (`npx prisma migrate dev --name init`) para crear las tablas físicas en PostgreSQL.
- [ ] **2.3. Semillero de Datos (Seeding)**:
  - Desarrollar un script en JS (`prisma/seed.js`) para poblar la base de datos con un usuario administrador por defecto (`admin`) y algunos productos iniciales con stock para pruebas.

---

## Fase 3: Infraestructura del Servidor y Middlewares Globales 🌐
Configurar la base del servidor Express e implementar mecanismos de seguridad y utilidades.

- [x] **3.1. Servidor Express Base**:
  - Crear el punto de entrada principal (`src/index.js`).
  - Levantar el servidor en el puerto especificado en el archivo `.env`.
- [x] **3.2. Middlewares Fundamentales**:
  - Habilitar CORS para permitir peticiones seguras desde la aplicación móvil React Native.
  - Habilitar el parser de JSON para recibir cuerpos de petición en formato JSON.
  - Implementar middleware global de manejo de errores para centralizar y capturar excepciones sin romper el servidor.

---

## Fase 4: Autenticación y Control de Acceso (JWT) 🔐
Garantizar la protección de las rutas de acuerdo al contrato de comunicación.

- [x] **4.1. Cifrado de Contraseñas**:
  - Implementación de `bcryptjs` para encriptar y verificar las contraseñas de los usuarios.
- [x] **4.2. Generación y Validación de Tokens**:
  - Configurar `jsonwebtoken` para firmar y validar tokens JWT en las cabeceras HTTP.
- [x] **4.3. Middleware de Autenticación**:
  - Crear un middleware (`src/middlewares/auth.middleware.js`) para interceptar y verificar la cabecera `Authorization: Bearer <token>`.
- [x] **4.4. Endpoint de Inicio de Sesión**:
  - Desarrollar la ruta `POST /api/auth/login` validando credenciales y retornando el token JWT junto con los datos de perfil del empleado.

---

## Fase 5: Endpoints de Negocio (Catálogo y Movimientos de Inventario) 📦
Desarrollar la funcionalidad core del negocio siguiendo las reglas y formatos especificados en el contrato.

- [x] **5.1. CRUD de Productos (Catálogo)**:
  - Implementar la ruta `GET /api/productos` para listar productos.
  - Implementar la ruta `POST /api/productos` para la creación de un nuevo producto (asociando de forma única el código de barras leído por la cámara).
  - Implementar la ruta `PUT /api/productos/:id` para actualizar información general.
- [x] **5.2. Búsqueda por Código de Barras**:
  - Desarrollar el endpoint `GET /api/productos/barcode/:barcode` específico para la integración con la cámara de la aplicación móvil.
- [x] **5.3. Módulo de Movimientos de Inventario**:
  - Implementar la ruta `POST /api/movimientos` para registrar entradas (compras a proveedor) o salidas (ventas/mermas).
    - **Lógica de negocio**:
      - Capturar el `usuarioId` directamente desde el JWT en las cabeceras.
      - Si es entrada, validar que se proporcione el campo `proveedor`.
      - Si es salida, validar que exista stock suficiente del producto; en caso contrario, retornar error `400 Bad Request` indicando stock insuficiente.
      - **Actualizar automáticamente el stock del producto** involucrado tras registrar el movimiento con éxito de forma transaccional.
  - Implementar la ruta `GET /api/movimientos` para listar el historial:
    - **Agrupamiento**: Formatear las respuestas agrupando los registros por día con los campos `fechaDia` (ej: 'Hoy') y `fechaMes` (ej: '22 de Abril').

---

## Fase 6: Pruebas y Validación de Contrato 🧪
Asegurar que la API cumple con el contrato JSON y se comporta según lo previsto.

- [x] **6.1. Pruebas Unitarias e Integración**:
  - Configurar Jest y Supertest en el entorno de ES Modules.
  - Implementar pruebas automatizadas (`tests/api.test.js`) para certificar:
    - Rechazo de inicio de sesión con credenciales inválidas.
    - Rechazo de acceso a rutas protegidas sin cabeceras JWT.
    - Validación estricta de estructura y tipos de datos (como el tipo de `productoId` y `cantidad`) en los payloads de movimientos.
- [ ] **6.2. Validación con Postman / Insomnia**:
  - Crear una colección de solicitudes HTTP para validar manualmente todos los escenarios (casos de éxito y de error de validación, no encontrado, conflicto, stock insuficiente).

---

## Fase 7: Dockerización y Despliegue en la Nube ☁️🚀
Llevar la aplicación a un entorno productivo estable y auto-contenido.

- [x] **7.1. Dockerización del Backend**:
  - Configurar un archivo `.dockerignore` robusto para omitir dependencias y configuraciones locales.
  - Diseñar un `Dockerfile` optimizado utilizando builds multi-etapa (multi-stage) en base a Node-Alpine.
- [x] **7.2. Configuración de Pipeline CI/CD**:
  - Configurar un flujo automatizado en GitHub Actions (`.github/workflows/deploy.yml`) para compilar, generar el cliente de Prisma, ejecutar tests y gatillar el despliegue automático mediante Webhook.
- [ ] **7.2. Proveedor Cloud**:
  - Seleccionar un proveedor PaaS como **Render** o **Railway** para el despliegue del servidor.
  - Configurar una instancia de PostgreSQL gestionada en la nube.
- [ ] **7.3. Configuración de Variables en Producción**:
  - Cargar de manera segura las variables en el panel del proveedor cloud:
    - `DATABASE_URL` (Conexión productiva SSL).
    - `JWT_SECRET` (Llave de firma de alta seguridad).
    - `PORT` (Asignado dinámicamente por la plataforma).
- [ ] **7.4. Pipeline CI/CD**:
  - Configurar despliegues automáticos desde la rama principal del repositorio de GitHub.
