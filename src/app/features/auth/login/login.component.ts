import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

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
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  loading      = signal(false);
  error        = signal('');
  showPassword = signal(false);

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
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        this.loading.set(false);
        this.error.set(err?.message ?? 'Error al iniciar sesión');
      }
    });
  }
}
