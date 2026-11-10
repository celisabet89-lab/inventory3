import { HttpInterceptorFn } from '@angular/common/http';

/** Envía el token de sesión al servidor en cada petición. */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token') ?? sessionStorage.getItem('token');
  if (!token || req.url.includes('/auth/login')) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
