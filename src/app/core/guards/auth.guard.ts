
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
export const authGuard = (p0?: unknown) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.isAuthenticated()) {
    return true;
  }
// Redirigir a login
  router.navigate(['/login']);
  return false;
};
// Guard para roles específicos
export const adminGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.isAuthenticated() && authService.isAdmin()) {
    return true;
  }
// Redirigir si no es admin
  router.navigate(['/dashboard']);
  return false;};
