# StockMin - Backend API 📦

Servidor de API REST desarrollado para el sistema de control de stock y lectura de códigos de barras de **StockMin**. Este backend sirve como el núcleo de lógica de negocio y persistencia de datos para la aplicación móvil desarrollada en React Native.

---

## 🧭 Índice del Proyecto

Para conocer el estado actual, la planificación del desarrollo y los detalles del diseño del sistema, consulta los siguientes enlaces:

- 🛣️ **[Plan de Ruta de Desarrollo (ROADMAP.md)](./ROADMAP.md)**: Detalla el desarrollo paso a paso del backend desde su inicialización hasta su despliegue seguro en la nube.
- 📐 **[Modelado de Base de Datos Relacional (docs/entidades.puml)](./docs/entidades.puml)**: Código PlantUML con la definición del modelo de datos de PostgreSQL para `User`, `Product` e `InventoryMovement`.

---

## 🛠️ Requisitos e Inicialización del Entorno

### 1. Requisitos Previos
Asegúrate de contar con lo siguiente instalado localmente:
- **Node.js** (v18 o superior recomendado)
- **PostgreSQL** (base de datos relacional activa)

### 2. Comandos de Instalación
Una vez clonado el repositorio, instala todas las dependencias configuradas en el proyecto ejecutando:
```bash
npm install
```

### 3. Configuración del ORM Prisma y Base de Datos
1. Configura tu cadena de conexión en el archivo `.env` creado en la raíz:
   ```env
   DATABASE_URL="postgresql://USUARIO:CONTRASENA@localhost:5432/stockmin?schema=public"
   ```
2. Ejecuta la migración inicial para sincronizar el esquema definido en `prisma/schema.prisma` con tu base de datos:
   ```bash
   npx prisma migrate dev --name init
   ```
3. (Opcional) Levanta la interfaz visual de administración de base de datos de Prisma:
   ```bash
   npm run db:studio
   ```

### 4. Ejecución del Servidor en Desarrollo
Para iniciar el servidor con recarga automática usando `nodemon`:
```bash
npm run dev
```

---

## 💡 Buenas Prácticas para Escalabilidad Futura

Con el fin de mantener un desarrollo ágil y escalable de cara a futuras iteraciones, se proponen las siguientes prácticas:

1. **Diseño por Capas Claras (Separación de Conceptos)**:
   Dividir el código fuente dentro de `src/` en capas bien de negocio y presentación:
   - **Routes**: Exclusivo para la definición de endpoints y mapeo de verbos HTTP.
   - **Controllers**: Manejo de peticiones (`req`), respuestas (`res`), validaciones de formato HTTP e inyección de datos de sesión.
   - **Services**: Contenedor de la lógica de negocio y llamados directos a Prisma ORM. Aísla las reglas de negocio para facilitar pruebas unitarias.
2. **Consistencia Transaccional (Stock y Movimientos)**:
   Al registrar un movimiento de inventario en `POST /api/movimientos`, se debe usar una **transacción de base de datos** (`prisma.$transaction`) para asegurar que la inserción del registro del movimiento y la correspondiente actualización (incremento/decremento) de stock en la tabla de productos se ejecuten como una única unidad atómica. Si alguna de las dos falla (o si el stock es insuficiente), toda la operación debe revertirse (`rollback`).
3. **Validación Estricta de Contrato**:
   Utilizar bibliotecas como **Zod** para validar las entradas (ej: que el `proveedor` esté presente si el tipo de movimiento es `'entrada'`). Esto garantiza que el backend rechace peticiones malformadas en la capa de controladores antes de interactuar con la base de datos.
4. **Manejo Centralizado de Excepciones**:
   Implementar un middleware global que capture cualquier error asíncrono y devuelva respuestas estandarizadas (ej: `{ "error": "Mensaje descriptivo" }`) de acuerdo al contrato JSON.
