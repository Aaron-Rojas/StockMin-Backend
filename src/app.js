import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import authRouter from './routes/auth.routes.js';
import productRouter from './routes/product.routes.js';
import movementRouter from './routes/movement.routes.js';
import lotRouter from './routes/lote.routes.js';
import ventaRouter from './routes/venta.routes.js';

const app = express();

app.use(compression());
app.use(cors());
app.use(express.json());

// Endpoint de salud del servidor
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Servidor StockMin operativo',
  });
});

// Enrutadores de los módulos
app.use('/api/auth', authRouter);
app.use('/api/productos', productRouter);
app.use('/api/movimientos', movementRouter);
app.use('/api/lotes', lotRouter);
app.use('/api/ventas', ventaRouter);

// Manejador global de errores (Modificado temporalmente para depuración)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: err.message,
    stack: err.stack,
  });
});

export default app;
