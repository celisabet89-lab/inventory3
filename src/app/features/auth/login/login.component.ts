import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { rutaInicial } from '../../../core/permissions';
import Swal from 'sweetalert2';

const CLAVE_EMAIL = 'sl_email_recordado';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router      = inject(Router);
  private fb          = inject(FormBuilder);

  loginForm: FormGroup = this.fb.group({
    email:    [this.emailRecordado(), [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  /** «Recordarme» guarda solo el correo, nunca la contraseña. */
  recordar = signal(!!this.emailRecordado());

  loading      = signal(false);
  error        = signal('');
  showPassword = signal(false);

  private emailRecordado(): string {
    try { return localStorage.getItem(CLAVE_EMAIL) ?? ''; } catch { return ''; }
  }

  private guardarEmail(email: string): void {
    try {
      if (this.recordar()) localStorage.setItem(CLAVE_EMAIL, email);
      else localStorage.removeItem(CLAVE_EMAIL);
    } catch { /* almacenamiento no disponible */ }
  }

  toggleRecordar(): void { this.recordar.update(v => !v); }

  olvidoClave(ev: Event): void {
    ev.preventDefault();
    Swal.fire({
      icon: 'info',
      title: 'Recuperar contraseña',
      text: 'Pide a un administrador que restablezca tu contraseña desde el módulo de Usuarios.',
      confirmButtonColor: '#1b6f6f'
    });
  }

  togglePassword(): void { this.showPassword.update(v => !v); }

  hasError(field: string, type: string): boolean {
    const c = this.loginForm.get(field);
    return !!(c && c.hasError(type) && c.touched);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');

    const { email, password } = this.loginForm.value;

    this.authService.login(String(email).trim(), String(password)).subscribe({
      next: () => {
        this.guardarEmail(String(email).trim());
        this.loading.set(false);
        this.router.navigate([rutaInicial(this.authService.rol())]);
      },
      error: (err: any) => {
        this.loading.set(false);
        this.error.set(err?.message ?? 'Error al iniciar sesión');
      }
    });
  }
}
