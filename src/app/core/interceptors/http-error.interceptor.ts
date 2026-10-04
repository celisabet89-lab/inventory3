import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import Swal from 'sweetalert2';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'Ocurrió un error desconocido';
      let errorTitle = 'Error';

      if (error.error instanceof ErrorEvent) {
        // Error del cliente
        errorMessage = `Error: ${error.error.message}`;
      } else {
        // Error del servidor
        switch (error.status) {
          case 400:
            errorTitle = 'Solicitud Incorrecta';
            errorMessage = error.error?.message || 'Los datos enviados no son válidos';
            break;
          case 401:
            errorTitle = 'No Autorizado';
            errorMessage = 'Por favor, inicie sesión nuevamente';
            localStorage.removeItem('token');
            localStorage.removeItem('currentUser');
            router.navigate(['/login']);
            break;
          case 403:
            errorTitle = 'Acceso Prohibido';
            errorMessage = 'No tiene permisos para realizar esta acción';
            break;
          case 404:
            errorTitle = 'No Encontrado';
            errorMessage = 'El recurso solicitado no existe';
            break;
          case 500:
            errorTitle = 'Error del Servidor';
            errorMessage = 'Ocurrió un error en el servidor. Intente más tarde';
            break;
          case 0:
            errorTitle = 'Sin Conexión';
            errorMessage = 'No se pudo conectar al servidor. Verifique su conexión';
            break;
          default:
            errorMessage = error.error?.message || error.message || errorMessage;
        }
      }

      // Mostrar alerta con SweetAlert2
      if (error.status !== 401) { // No mostrar para 401 porque redirige a login
        Swal.fire({
          icon: 'error',
          title: errorTitle,
          text: errorMessage,
          confirmButtonColor: '#2563eb',
          confirmButtonText: 'Entendido'
        });
      }

      return throwError(() => error);
    })
  );
};
