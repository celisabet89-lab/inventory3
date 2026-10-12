import {
  HttpErrorResponse,
  HttpInterceptorFn
} from '@angular/common/http';

import { catchError, throwError } from 'rxjs';
import Swal from 'sweetalert2';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {

  return next(req).pipe(

    catchError((error: HttpErrorResponse) => {

      let errorMessage = 'Ocurrió un error desconocido';
      let errorTitle = 'Error';

      if (error.status === 0) {

        errorTitle = 'Sin conexión';

        errorMessage =
          'No se pudo conectar con el servidor. ' +
          'Verifique que el backend esté ejecutándose.';

      } else if (error.status === 400) {

        errorTitle = 'Solicitud incorrecta';

        errorMessage =
          error.error?.message ||
          'Los datos enviados no son válidos';

      } else if (error.status === 401) {


        localStorage.removeItem('token');
        sessionStorage.removeItem('token');

      } else if (error.status === 403) {

        errorTitle = 'Acceso prohibido';

        errorMessage =
          'No tiene permisos para realizar esta acción';

      } else if (error.status === 404) {

        errorTitle = 'No encontrado';

        errorMessage =
          'El recurso solicitado no existe';

      } else if (error.status >= 500) {

        errorTitle = 'Error del servidor';

        errorMessage =
          'Ocurrió un error en el servidor. Intente más tarde';

      } else {

        errorMessage =
          error.error?.message ||
          error.message ||
          errorMessage;
      }

      if (error.status !== 401) {

        Swal.fire({
          icon: 'error',
          title: errorTitle,
          text: errorMessage,
          confirmButtonText: 'Entendido'
        });
      }

      return throwError(() => error);
    })
  );
};
