import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private usersUrl = `${environment.apiUrl}/user`;

  private _currentUser = new BehaviorSubject<any>(null);
  currentUser$ = this._currentUser.asObservable();

  currentUserSignal = signal<any>(null);

  constructor(private http: HttpClient, private router: Router) {
    this.loadUserFromStorage();
    // Sincronizar BehaviorSubject con signal
    this._currentUser.subscribe(user => this.currentUserSignal.set(user));
  }

  private loadUserFromStorage(): void {
    try {
      const stored = localStorage.getItem('user');
      if (stored) this._currentUser.next(JSON.parse(stored));
    } catch {
      localStorage.removeItem('user');
    }
  }

  login(email: string, password: string): Observable<any> {
    return this.http.get<any[]>(this.usersUrl).pipe(
      tap((users: any[]) => {
        const found = users.find(u =>
          u.email?.toLowerCase() === String(email).toLowerCase() &&
          u.password === String(password)
        );
        if (!found) throw new Error('Credenciales incorrectas');
        found.password = null;
        localStorage.setItem('user', JSON.stringify(found));
        this._currentUser.next(found);
      }),
      catchError(err => {
        const msg = err?.message ?? 'Error al iniciar sesión';
        return throwError(() => new Error(msg));
      })
    );
  }

  logout(): void {
    localStorage.removeItem('user');
    this._currentUser.next(null);
    this.router.navigate(['/login']);
  }

  // FIX: getCurrentUser() que usa onu-assignment
  getCurrentUser(): any { return this._currentUser.getValue(); }

  isAuthenticated(): boolean { return this._currentUser.getValue() !== null; }
  isLoggedIn():      boolean { return this.isAuthenticated(); }

  isAdmin(): boolean {
    const user  = this._currentUser.getValue();
    const cargo = user?.profile?.cargo ?? user?.rol?.cargo ?? '';
    return cargo.toLowerCase().includes('admin');
  }

  getUserFromStorage(): any { return this._currentUser.getValue(); }
}
