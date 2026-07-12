# Contrato de Comunicación de API REST (v2) - StockMin

Este documento detalla el contrato de comunicación formal de la API de **StockMin** (Minimarket "Todo Dar") tras la refactorización POS. 

---

## 🚫 Política de Seguridad: Cero Fricción (Modo Testing)
Para agilizar las pruebas de integración manuales y testing con Postman, **todos los endpoints de negocio son públicos temporalmente** y no requieren cabeceras de autorización `Authorization: Bearer <JWT>`. El endpoint de login se mantiene únicamente con fines de compatibilidad de flujos futuros.

---

## 🏥 Endpoint de Salud (Health Check)

### `GET /api/health`
Obtiene el estado general del servidor.
*   **Respuesta Exitosa (200 OK):**
    ```json
    {
      "status": "ok",
      "message": "Servidor StockMin operativo"
    }
    ```

---

## 🔐 Módulo de Autenticación (Opcional en esta fase)

### `POST /api/auth/login`
Autentica credenciales y retorna metadatos básicos.
*   **Cuerpo de la Petición (Request Body):**
    ```json
    {
      "email": "admin@tododar.com",
      "password": "password123"
    }
    ```
*   **Respuesta Exitosa (200 OK):**
    ```json
    {
      "token": "eyJhbGciOiJIUzI1NiIsIn...",
      "user": {
        "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        "email": "admin@tododar.com",
        "nombre": "Administrador Todo Dar"
      }
    }
    ```
*   **Respuesta de Error (401 Unauthorized):**
    ```json
    {
      "error": "Credenciales inválidas."
    }
    ```

---

## 📦 Módulo de Catálogo de Productos

### `GET /api/productos`
Obtiene la lista completa de productos registrados. El campo `stock` se calcula dinámicamente sumando la `cantidadDisponible` de todos sus lotes activos.
*   **Respuesta Exitosa (200 OK):**
    ```json
    [
      {
        "id": 1,
        "nombre": "Leche Gloria Azul 1L",
        "precioBase": "4.50",
        "codigoBarras": "7750102030405",
        "categoria": "Lácteos",
        "imagenUrl": "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=256",
        "stockMinimo": 8,
        "stock": 15
      }
    ]
    ```

### `GET /api/productos/barcode/:barcode`
Busca un producto por su código de barras (escaneado por cámara).
*   **Parámetros:** `barcode` (String en Path)
*   **Respuesta Exitosa (200 OK):**
    ```json
    {
      "id": 1,
      "nombre": "Leche Gloria Azul 1L",
      "precioBase": "4.50",
      "codigoBarras": "7750102030405",
      "categoria": "Lácteos",
      "imagenUrl": "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=256",
      "stockMinimo": 8,
      "stock": 15
    }
    ```
*   **Respuesta de Error (404 Not Found):**
    ```json
    {
      "error": "El código de barras no coincide con ningún producto registrado."
    }
    ```

### `GET /api/productos/alertas`
**[CRÍTICO]** Consolida los datos del Home del POS identificando productos con bajo stock o lotes que venzan en **7 días o menos**.
*   **Respuesta Exitosa (200 OK):**
    ```json
    {
      "alertasVencimiento": [
        {
          "loteId": 5,
          "productoId": 1,
          "nombreProducto": "Leche Gloria Azul 1L",
          "codigoBarras": "7750102030405",
          "cantidadDisponible": 10,
          "fechaVencimiento": "2026-07-15T12:00:00.000Z",
          "diasParaVencer": 3
        }
      ],
      "alertasStockMinimo": [
        {
          "productoId": 2,
          "nombreProducto": "Galletas Oreo 120g",
          "codigoBarras": "7750908070605",
          "stockMinimo": 10,
          "stockActual": 4
        }
      ]
    }
    ```

### `POST /api/productos`
Crea el catálogo comercial de un producto. Inicializa el stock del producto en `0` (el stock aumenta ingresando lotes).
*   **Cuerpo de la Petición:**
    ```json
    {
      "nombre": "Galletas Oreo 120g",
      "precioBase": "2.20",
      "codigoBarras": "7750908070605",
      "categoria": "Snacks",
      "imagenUrl": "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=256",
      "stockMinimo": 10
    }
    ```
*   **Respuesta Exitosa (201 Created):**
    ```json
    {
      "id": 2,
      "nombre": "Galletas Oreo 120g",
      "precioBase": "2.20",
      "codigoBarras": "7750908070605",
      "categoria": "Snacks",
      "imagenUrl": "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=256",
      "stockMinimo": 10,
      "stock": 0
    }
    ```
*   **Respuesta de Error (409 Conflict):**
    ```json
    {
      "error": "El código de barras ingresado ya pertenece a otro producto."
    }
    ```

### `PUT /api/productos/:id`
Actualiza parcialmente los metadatos comerciales de un producto.
*   **Parámetros:** `id` (Integer en Path)
*   **Cuerpo de la Petición (Campos opcionales):**
    ```json
    {
      "nombre": "Galletas Oreo Rellenas 120g",
      "precioBase": "2.40"
    }
    ```
*   **Respuesta Exitosa (200 OK):**
    ```json
    {
      "id": 2,
      "nombre": "Galletas Oreo Rellenas 120g",
      "precioBase": "2.40",
      "codigoBarras": "7750908070605",
      "categoria": "Snacks",
      "imagenUrl": "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=256",
      "stockMinimo": 10,
      "stock": 0
    }
    ```

---

## 🗄️ Módulo de Gestión de Lotes (Inventario Físico)

### `GET /api/lotes`
Lista la totalidad de lotes físicos registrados en el almacén.
*   **Respuesta Exitosa (200 OK):**
    ```json
    [
      {
        "id": 1,
        "productoId": 1,
        "cantidadDisponible": 15,
        "fechaVencimiento": "2026-08-30T12:00:00.000Z",
        "fechaIngreso": "2026-07-12T14:00:00.000Z",
        "producto": {
          "nombre": "Leche Gloria Azul 1L",
          "codigoBarras": "7750102030405"
        }
      }
    ]
    ```

### `GET /api/lotes/producto/:productoId`
Lista los lotes vigentes (`cantidadDisponible > 0`) de un producto específico, ordenados por fecha de vencimiento.
*   **Parámetros:** `productoId` (Integer en Path)
*   **Respuesta Exitosa (200 OK):**
    ```json
    [
      {
        "id": 1,
        "cantidadDisponible": 15,
        "fechaVencimiento": "2026-08-30T12:00:00.000Z",
        "fechaIngreso": "2026-07-12T14:00:00.000Z"
      }
    ]
    ```

### `POST /api/lotes`
Registra el ingreso físico de mercancía a través de un lote. 
*Genera automáticamente un Movimiento de auditoría tipo `INGRESO_LOTE`.*
*   **Cuerpo de la Petición:**
    ```json
    {
      "productoId": 1,
      "cantidadDisponible": 20,
      "fechaVencimiento": "2026-09-15T00:00:00.000Z"
    }
    ```
*   **Respuesta Exitosa (201 Created):**
    ```json
    {
      "id": 2,
      "productoId": 1,
      "cantidadDisponible": 20,
      "fechaVencimiento": "2026-09-15T00:00:00.000Z",
      "fechaIngreso": "2026-07-12T14:30:00.000Z"
    }
    ```

### `POST /api/lotes/:id/merma`
Declara merma (pérdida/descarte) sobre la cantidad de un lote.
*Resta la cantidadDisponible y registra un Movimiento de auditoría tipo `MERMA`.*
*   **Parámetros:** `id` (Integer en Path)
*   **Cuerpo de la Petición:**
    ```json
    {
      "cantidadMerma": 5
    }
    ```
    *(Nota: Si "cantidadMerma" se omite en la petición, se mermará toda la cantidadDisponible restante en el lote).*
*   **Respuesta Exitosa (200 OK):**
    ```json
    {
      "id": 2,
      "cantidadDisponible": 15,
      "cantidadMermada": 5
    }
    ```
*   **Respuesta de Error (400 Bad Request - Merma mayor que disponibilidad):**
    ```json
    {
      "error": "La cantidad de merma solicitada excede la cantidad disponible en el lote."
    }
    ```

---

## 🛒 Módulo de Punto de Venta (Ventas POS)

### `POST /api/ventas`
Registra una venta. Resta stock de los lotes más antiguos por método PEPS (FIFO). Congela precios unitarios de productos.
*Genera un ticket de venta y registra un Movimiento de auditoría tipo `VENTA`. Todo de forma transaccional.*
*   **Cuerpo de la Petición:**
    ```json
    {
      "metodoPago": "Yape",
      "detalles": [
        {
          "productoId": 1,
          "cantidadVendida": 12
        }
      ]
    }
    ```
*   **Respuesta Exitosa (201 Created):**
    ```json
    {
      "id": 1,
      "fechaHora": "2026-07-12T14:35:00.000Z",
      "totalVenta": "54.00",
      "metodoPago": "Yape",
      "detalles": [
        {
          "id": 1,
          "productoId": 1,
          "cantidadVendida": 12,
          "precioUnitarioCongelado": "4.50"
        }
      ]
    }
    ```
*   **Respuesta de Error (400 Bad Request - Stock insuficiente):**
    ```json
    {
      "error": "Stock insuficiente para el producto 'Leche Gloria Azul 1L'. Requerido: 12, Disponible: 8."
    }
    ```

---

## 📜 Módulo de Movimientos (Bitácora de Auditoría)

### `GET /api/movimientos`
Lista los logs descriptivos de auditoría del inventario generados por la lógica del backend.
*   **Parámetros Query (Opcionales):** `tipo` (Filtra por `INGRESO_LOTE`, `VENTA` o `MERMA`).
*   **Respuesta Exitosa (200 OK):**
    ```json
    [
      {
        "id": 3,
        "tipo": "VENTA",
        "descripcion": "Venta registrada. Ticket #1. Productos: Leche Gloria Azul 1L (x12). Método de pago: Yape. Total: S/. 54.00",
        "fecha": "2026-07-12T14:35:00.000Z"
      },
      {
        "id": 2,
        "tipo": "INGRESO_LOTE",
        "descripcion": "Ingreso de lote para el producto Leche Gloria Azul 1L (x20). Vence: 2026-09-15.",
        "fecha": "2026-07-12T14:30:00.000Z"
      }
    ]
    ```
