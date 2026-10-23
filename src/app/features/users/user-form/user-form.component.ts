import {Component, OnInit, OnChanges, SimpleChanges, inject, signal, Input, Output, EventEmitter} from '@angular/core';
import { CommonModule } from '@angular/common';import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { UserService } from '../services/user.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.css']
})
export class UserFormComponent implements OnInit, OnChanges {
  @Input() userId: number | null = null;
  @Input() isEdit = false;

  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private userService = inject(UserService);

  userForm!: FormGroup;

  isEditMode = signal(false);
  loading = signal(false);
  roles = signal<any[]>([]);
  loadingRoles = signal(false);

  mostrarPassword = signal(false);

  ngOnInit(): void {
    this.initForm();
    this.loadRoles();
    this.syncFormMode();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['userId'] ||
      changes['isEdit']
    ) {
      if (this.userForm) {
        this.syncFormMode();
      }
    }
  }

  initForm(): void {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: [''],
      rolId: [null, Validators.required],
      telefono: [''],
      ci: ['']
    });
  }

  private syncFormMode(): void {
    const editando = this.isEdit && this.userId !== null;

    this.isEditMode.set(editando);
    this.mostrarPassword.set(false);
    this.loading.set(false);

    // Siempre limpiar datos anteriores antes de abrir el formulario.
    this.userForm.reset({
      name: '',
      lastName: '',
      email: '',
      password: '',
      rolId: null,
      telefono: '',
      ci: ''
    });

    if (editando && this.userId !== null) {
      this.loadUser(this.userId);
    }
  }

  loadRoles(): void {
    this.loadingRoles.set(true);

    this.http.get<any[]>(`${environment.apiUrl}/rol`).subscribe({
      next: (data) => {
        this.roles.set(data);
        this.loadingRoles.set(false);
      },
      error: () => {
        this.loadingRoles.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar los roles'
        });
      }
    });
  }

  loadUser(id: number): void {
    this.loading.set(true);

    this.userService.getById(id).subscribe({
      next: (u: any) => {
        this.userForm.patchValue({
          name: u.profile?.name ?? '',
          lastName: u.profile?.lastName ?? '',
          email: u.email ?? '',
          rolId: u.rol?.id != null ? u.rol.id : null,
          telefono: u.profile?.telefono ?? '',
          ci: u.profile?.ci ?? '',
          password: ''
        });

        // Nunca rellenar la contraseña con datos anteriores.
        this.userForm.get('password')?.setValue('');
        this.loading.set(false);
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar el usuario'
        });

        this.loading.set(false);
        this.cancelled.emit();
      }
    });
  }

  alternarPassword(): void {
    const control = this.userForm.get('password');

    if (!control) {
      return;
    }

    this.mostrarPassword.update(valor => !valor);
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      Object.keys(this.userForm.controls).forEach(key => {
        this.userForm.get(key)?.markAsTouched();
      });

      Swal.fire({
        icon: 'warning',
        title: 'Formulario incompleto',
        text: 'Revisa los campos obligatorios y selecciona un rol'
      });

      return;
    }

    this.loading.set(true);

    const v = this.userForm.getRawValue();

    const data: any = {
      name: v.name,
      lastName: v.lastName,
      email: v.email,
      rolId: v.rolId,
      telefono: v.telefono ? Number(v.telefono) : null,
      ci: v.ci ? Number(v.ci) : null
    };

// Solo enviar contraseña cuando se escribió una nueva.
    if (typeof v.password === 'string' && v.password.trim() !== '') {
      data.password = v.password;
    }

    const operacion = (
      this.isEditMode() && this.userId !== null
    )
      ? this.userService.update(this.userId, data)
      : this.userService.create(data);

    operacion.subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: this.isEditMode()
            ? 'Usuario actualizado'
            : 'Usuario creado',
          timer: 1800,
          showConfirmButton: false
        }).then(() => this.saved.emit());
      },
      error: () => {
        this.loading.set(false);

        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo guardar el usuario'
        });
      }
    });
  }

  cancel(): void {
    this.userForm.reset();
    this.mostrarPassword.set(false);
    this.cancelled.emit();
  }

  hasError(field: string, error: string): boolean {
    const control = this.userForm.get(field);

    return !!(
      control &&
      control.hasError(error) &&
      control.touched
    );
  }
}
