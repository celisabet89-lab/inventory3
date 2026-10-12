import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { User } from '../../models/user.model';
import { LoginRequest } from '../../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly loginUrl = `${environment.apiUrl}/auth/login`;

  private readonly _currentUser = new BehaviorSubject<User | null>(null);

  readonly currentUser$ = this._currentUser.asObservable();
  readonly currentUserSignal = signal<User | null>(null);

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {
    this.loadUserFromStorage();

    this._currentUser.subscribe(user => {
      this.currentUserSignal.set(user);
    });
  }

  private loadUserFromStorage(): void {
    const stored = localStorage.getItem('user');

    if (!stored) {
      return;
    }

    try {
      this._currentUser.next(JSON.parse(stored) as User);
    } catch {
      localStorage.removeItem('user');
      this._currentUser.next(null);
    }
  }

  login(email: string, password: string): Observable<User> {
    const request: LoginRequest = {
      email: email.trim(),
      password
    };

    return this.http.post<User>(this.loginUrl, request).pipe(
      tap(user => {
        // El backend devuelve directamente el usuario.
        // Nunca guardamos la contraseña en localStorage.
        const authenticatedUser: User = { ...user };

        delete authenticatedUser.password;

        localStorage.setItem(
          'user',
          JSON.stringify(authenticatedUser)
        );

        this._currentUser.next(authenticatedUser);
      }),

      catchError((error: HttpErrorResponse) => {
        return throwError(
          () => new Error(this.getLoginErrorMessage(error))
        );
      })
    );
  }

  private getLoginErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 401) {
      return error.error?.message ||
        'Correo o contraseña incorrectos';
    }

    if (error.status === 0) {
      return 'No se pudo conectar con el servidor';
    }

    return error.error?.message ||
      error.message ||
      'Error al iniciar sesión';
  }

  logout(): void {
    localStorage.removeItem('user');
    localStorage.removeItem('token');

    sessionStorage.removeItem('token');

    this._currentUser.next(null);

    this.router.navigate(['/login']);
  }

  getCurrentUser(): User | null {
    return this._currentUser.getValue();
  }

  getUserFromStorage(): User | null {
    return this.getCurrentUser();
  }

  isAuthenticated(): boolean {
    return this._currentUser.getValue() !== null;
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }

  isAdmin(): boolean {
    const user = this._currentUser.getValue();

    const cargo  =
      user?.profile?.cargo ??
      user?.rol?.cargo ??
      '';

    return String(cargo)
      .toLowerCase()
      .includes('admin');
  }
}
