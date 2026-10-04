import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private router = inject(Router);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    let token = localStorage.getItem('token');

    if (!token) {
      token = sessionStorage.getItem('token');
    }

    let authReq = req;
    if (token) {
      authReq = req.clone({
        setHeaders: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('🔐 Token agregado a la petición:', authReq.headers.get('Authorization'));
    } else {
      console.warn('⚠️ No hay token disponible');
    }

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Error HTTP:', error.status, error.url);

        if (error.status === 401) {
          console.warn('🔑 Token inválido o expirado');
          // Limpiar tokens
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          localStorage.removeItem('user');

          // Redirigir al login
          Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor, inicia sesión nuevamente',
            confirmButtonColor: '#1b6f6f'
          }).then(() => {
            this.router.navigate(['/login']);
          });
        }

        return throwError(() => error);
      })
    );
  }
}
