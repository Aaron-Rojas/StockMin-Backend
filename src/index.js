import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor Express escuchando en el puerto ${PORT}`);
  console.log(`🔗 Ruta de salud disponible en http://localhost:${PORT}/api/health`);
});
