import { inject } from '@angular/core';
import { Router, CanActivateChildFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { rutaInicial } from '../permissions';

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

export const adminGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (
    authService.isAuthenticated() &&
    authService.isAdmin()
  ) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};

/** Bloquea las rutas que el cargo del usuario no puede ver. */
export const permisoGuard: CanActivateChildFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.canAccess(state.url)
    ? true
    : router.createUrlTree([rutaInicial(authService.rol())]);
};
