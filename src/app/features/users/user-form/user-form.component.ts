import { Component, OnInit, inject, signal, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
export class UserFormComponent implements OnInit {
  @Input() userId: number | null = null;
  @Input() isEdit: boolean = false;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private fb          = inject(FormBuilder);
  private http        = inject(HttpClient);
  private userService = inject(UserService);

  userForm!: FormGroup;
  isEditMode   = signal(false);
  loading      = signal(false);
  roles        = signal<any[]>([]);
  loadingRoles = signal(false);

  ngOnInit(): void {
    this.initForm();
    this.loadRoles();
    if (this.userId) { this.isEditMode.set(true); this.loadUser(this.userId); }
  }

  initForm(): void {
    this.userForm = this.fb.group({
      name:     ['', Validators.required],
      lastName: ['', Validators.required],
      email:    ['', [Validators.required, Validators.email]],
      password: [''],
      rolId:    [null, Validators.required],  // obligatorio
      telefono: [''],
      ci:       ['']
    });
  }

  loadRoles(): void {
    this.loadingRoles.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/rol`).subscribe({
      next:  (data) => { this.roles.set(data); this.loadingRoles.set(false); },
      error: ()     => { this.loadingRoles.set(false); }
    });
  }

  loadUser(id: number): void {
    this.loading.set(true);
    this.userService.getById(id).subscribe({
      next: (u: any) => {
        this.userForm.patchValue({
          name:     u.profile?.name     ?? '',
          lastName: u.profile?.lastName ?? '',
          email:    u.email,
          // El select necesita string para hacer match con [value]="r.id"
          rolId:    u.rol?.id != null ? u.rol.id : null,
          telefono: u.profile?.telefono ?? '',
          ci:       u.profile?.ci       ?? ''
        });
        this.loading.set(false);
      },
      error: () => {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar el usuario' });
        this.loading.set(false);
        this.cancelled.emit();
      }
    });
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      Object.keys(this.userForm.controls).forEach(k => this.userForm.get(k)?.markAsTouched());
      Swal.fire({ icon: 'warning', title: 'Formulario incompleto', text: 'Selecciona un rol' });
      return;
    }
    this.loading.set(true);
    const v = this.userForm.value;

    // rolId SIEMPRE como número (el select devuelve string en HTML)
    const data: any = {
      name:     v.name,
      lastName: v.lastName,
      email:    v.email,
      rolId:    v.rolId,                // ya es número gracias a [ngValue]
      telefono: v.telefono ? Number(v.telefono) : null,
      ci:       v.ci       ? Number(v.ci)       : null,
    };
    if (v.password) data.password = v.password;

    const op = (this.isEditMode() && this.userId)
      ? this.userService.update(this.userId, data)
      : this.userService.create(data);

    op.subscribe({
      next: () => Swal.fire({
        icon: 'success',
        title: this.isEditMode() ? 'Usuario actualizado' : 'Usuario creado',
        timer: 1800, showConfirmButton: false
      }).then(() => this.saved.emit()),
      error: () => {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar el usuario' });
        this.loading.set(false);
      }
    });
  }

  cancel(): void { this.cancelled.emit(); }

  hasError(f: string, e: string): boolean {
    const c = this.userForm.get(f);
    return !!(c && c.hasError(e) && c.touched);
  }
}
