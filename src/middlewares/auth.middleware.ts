import { Request, Response, NextFunction } from 'express';

// Valida el JWT (Bearer token) antes de pasar al controlador.
// TODO: integrar verificación real contra Supabase / servicio de Identidad (G2).
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      timestamp: new Date().toISOString(),
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Falta el token de autenticación (Bearer)',
    });
    return;
  }

  // const token = authHeader.split(' ')[1];
  // Aquí se validaría el token con Supabase.

  next();
};
