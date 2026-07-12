import { Router } from 'express';
import { register, login } from '../controllers/auth.controller.js';

const router = Router();

// ANÁLISIS CRÍTICO DE FALLOS Y ENFOQUE PEDAGÓGICO:
// Anteriormente, la lógica de login e interacciones de base de datos residían directamente inline
// en este archivo. Además, carecía de un endpoint para registro de usuarios comerciales.
// CÓMO Y POR QUÉ: Se refactoriza delegando el flujo de negocio al controlador auth.controller.js.
// Se exponen de manera pública los endpoints de registro y login (POST /register y POST /login),
// de modo que no pasen por el middleware global de verificación de JWT.

router.post('/register', register);
router.post('/login', login);

export default router;
