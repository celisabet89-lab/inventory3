import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { OnuService } from '../services/onu.service';
import { AssignmentService, ChecklistItem } from '../services/assignment.service';
import { AuthService } from '../../../core/services/auth.service';
import Swal from 'sweetalert2';
import {Onu} from '../../../models';

@Component({
  selector: 'app-onu-assignment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './onu-assignment.component.html',
  styleUrls: ['./onu-assignment.component.css']
})
export class OnuAssignmentComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private onuService = inject(OnuService);
  private assignmentService = inject(AssignmentService);
  private authService = inject(AuthService);

  assignmentForm!: FormGroup;
  loading = signal(false);
  onu = signal<Onu | null>(null);

  // Para las fotos
  fotos = signal<string[]>([]);
  uploadingPhoto = signal(false);

  // Para el checklist
  checklist = signal<ChecklistItem[]>([]);
  checklistProgress = signal(0);

  // Estado del formulario
  currentStep = signal(1);
  totalSteps = 4;

  ngOnInit(): void {
    const onuId = this.route.snapshot.params['id'];
    if (onuId) {
      this.loadOnu(Number(onuId));
      this.initForm();
      this.loadDefaultChecklist();
    } else {
      this.router.navigate(['/onus']);
    }
  }

  loadOnu(id: number): void {
    // @ts-ignore
    this.onuService.getById(id).subscribe({
      next: (onu: Onu | null) => {
        // @ts-ignore
        if (onu.estado != 'Disponible') {
          Swal.fire({
            icon: 'error',
            title: 'ONU No Disponible',
            text: 'Esta ONU no está disponible para asignación',
            confirmButtonColor: '#ef4444'
          }).then(() => {
            this.router.navigate(['/onus']);
          });
          return;
        } else {
          this.onu.set(onu);
        }
      },
      error: (error: any) => {
        console.error('Error:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar la información de la ONU'
        });
        this.router.navigate(['/onus']);
      }
    });
  }

  initForm(): void {
    this.assignmentForm = this.fb.group({
      // Paso 1: Información del Cliente
      clienteNombre: ['', [Validators.required, Validators.minLength(3)]],
      clienteApellido: ['', [Validators.required, Validators.minLength(3)]],
      clienteTelefono: ['', [Validators.required, Validators.pattern(/^[0-9]{7,8}$/)]],
      clienteDireccion: ['', [Validators.required, Validators.minLength(10)]],

      // Paso 2: Datos de Instalación
      numeroContrato: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      fechaInstalacion: [new Date().toISOString().split('T')[0], Validators.required],
      observaciones: [''],

      // Los datos de checklist y fotos se manejan por separado
    });
  }

  loadDefaultChecklist(): void {
    const defaultChecklist = this.assignmentService.getDefaultChecklist();
    this.checklist.set(defaultChecklist);
    this.updateChecklistProgress();
  }

  // PASO 1: Información del Cliente
  nextStep(): void {
    if (this.currentStep() === 1) {
      // Validar campos de cliente
      const clienteFields = ['clienteNombre', 'clienteApellido', 'clienteTelefono', 'clienteDireccion'];
      let valid = true;

      clienteFields.forEach(field => {
        const control = this.assignmentForm.get(field);
        control?.markAsTouched();
        if (control?.invalid) {
          valid = false;
        }
      });

      if (!valid) {
        Swal.fire({
          icon: 'warning',
          title: 'Información Incompleta',
          text: 'Por favor complete todos los datos del cliente correctamente',
          confirmButtonColor: '#f59e0b'
        });
        return;
      }
    }

    if (this.currentStep() === 2) {
      // Validar datos de instalación
      const instalacionFields = ['numeroContrato', 'fechaInstalacion'];
      let valid = true;

      instalacionFields.forEach(field => {
        const control = this.assignmentForm.get(field);
        control?.markAsTouched();
        if (control?.invalid) {
          valid = false;
        }
      });

      if (!valid) {
        Swal.fire({
          icon: 'warning',
          title: 'Información Incompleta',
          text: 'Por favor complete los datos de instalación',
          confirmButtonColor: '#f59e0b'
        });
        return;
      }
    }

    if (this.currentStep() === 3) {
      // Validar checklist (al menos 80% completado)
      if (this.checklistProgress() < 80) {
        Swal.fire({
          icon: 'warning',
          title: 'Checklist Incompleto',
          text: 'Debes completar al menos el 80% del checklist de instalación',
          confirmButtonColor: '#f59e0b'
        });
        return;
      }
    }

    if (this.currentStep() < this.totalSteps) {
      this.currentStep.update(v => v + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(v => v - 1);
    }
  }

  // PASO 3: Checklist
  toggleChecklistItem(index: number): void {
    const items = this.checklist();
    items[index].checked = !items[index].checked;
    this.checklist.set([...items]);
    this.updateChecklistProgress();
  }

  addObservacion(index: number): void {
    Swal.fire({
      title: 'Agregar Observación',
      input: 'textarea',
      inputLabel: this.checklist()[index].label,
      inputValue: this.checklist()[index].observacion || '',
      inputPlaceholder: 'Escribe tus observaciones aquí...',
      showCancelButton: true,
      confirmButtonColor: '#1b6f6f',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const items = this.checklist();
        items[index].observacion = result.value;
        this.checklist.set([...items]);
      }
    });
  }

  updateChecklistProgress(): void {
    const items = this.checklist();
    const completed = items.filter(item => item.checked).length;
    const total = items.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    this.checklistProgress.set(progress);
  }

  // PASO 4: Documentación Fotográfica
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const maxPhotos = 10;
      const currentPhotos = this.fotos().length;

      if (currentPhotos >= maxPhotos) {
        Swal.fire({
          icon: 'warning',
          title: 'Límite Alcanzado',
          text: `Máximo ${maxPhotos} fotos permitidas`,
          confirmButtonColor: '#f59e0b'
        });
        return;
      }

      Array.from(input.files).forEach((file, index) => {
        if (currentPhotos + index >= maxPhotos) return;

        if (file.size > 5 * 1024 * 1024) {
          Swal.fire({
            icon: 'error',
            title: 'Archivo muy grande',
            text: `${file.name} supera el límite de 5MB`
          });
          return;
        }

        this.uploadingPhoto.set(true);
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          this.fotos.update(fotos => [...fotos, base64]);
          this.uploadingPhoto.set(false);
        };
        reader.readAsDataURL(file);
      });

      // Limpiar input
      input.value = '';
    }
  }

  removePhoto(index: number): void {
    Swal.fire({
      title: '¿Eliminar foto?',
      text: 'Esta acción no se puede deshacer',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.fotos.update(fotos => fotos.filter((_, i) => i !== index));
      }
    });
  }

  // ENVÍO FINAL
  onSubmit(): void {
    // Validación final
    if (this.fotos().length < 3) {
      Swal.fire({
        icon: 'error',
        title: 'Documentación Incompleta',
        text: 'Debes subir al menos 3 fotos de la instalación',
        confirmButtonColor: '#ef4444'
      });
      return;
    }

    if (this.checklistProgress() < 80) {
      Swal.fire({
        icon: 'error',
        title: 'Checklist Incompleto',
        text: 'Debes completar al menos el 80% del checklist',
        confirmButtonColor: '#ef4444'
      });
      return;
    }

    const formData = this.assignmentForm.value;
    const currentUser = this.authService.getCurrentUser();

    Swal.fire({
      title: '¿Confirmar Asignación?',
      html: `
        <div style="text-align: left; padding: 10px;">
          <p><strong>ONU:</strong> ${this.onu()?.marca} ${this.onu()?.modelo}</p>
          <p><strong>Serial:</strong> ${this.onu()?.serial}</p>
          <p><strong>Cliente:</strong> ${formData.clienteNombre} ${formData.clienteApellido}</p>
          <p><strong>Contrato:</strong> #${formData.numeroContrato}</p>
          <p><strong>Checklist:</strong> ${this.checklistProgress()}% completado</p>
          <p><strong>Fotos:</strong> ${this.fotos().length} adjuntas</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#1b6f6f',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, asignar ONU',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.procesarAsignacion();
      }
    });
  }

  procesarAsignacion(): void {
    this.loading.set(true);

    // TODO: En producción, primero crear el cliente, luego la asignación
    // Por ahora simulamos el proceso

    const assignmentData = {
      fecha: new Date().toISOString(),
      datos: JSON.stringify({
        numeroContrato: this.assignmentForm.value.numeroContrato,
        fechaInstalacion: this.assignmentForm.value.fechaInstalacion,
        observaciones: this.assignmentForm.value.observaciones
      }),
      fotosUrls: this.fotos(),
      checklistCompletado: this.checklistProgress() === 100,
      itemsChecklist: this.checklist(),
      onuId: this.onu()?.id || 0,
      clienteId: 1, // TODO: Obtener del cliente creado
      userId: this.authService.getCurrentUser()?.id
    };

    // Simular delay de red
    setTimeout(() => {
      this.loading.set(false);

      Swal.fire({
        icon: 'success',
        title: '¡Asignación Exitosa!',
        html: `
          <div style="text-align: center; padding: 20px;">
            <i class="fas fa-check-circle" style="font-size: 64px; color: #10b981; margin-bottom: 16px;"></i>
            <p style="margin: 12px 0;">La ONU ha sido asignada correctamente</p>
            <div style="background: #f0fdf4; padding: 12px; border-radius: 8px; margin-top: 16px;">
              <p style="margin: 0; color: #059669; font-weight: 600;">
                Documentación completa registrada
              </p>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonColor: '#1b6f6f',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Ver ONUs',
        cancelButtonText: 'Nueva Asignación'
      }).then((result) => {
        if (result.isConfirmed) {
          this.router.navigate(['/onus']);
        } else {
          this.router.navigate(['/onus']);
        }
      });
    }, 2000);
  }

  cancelar(): void {
    Swal.fire({
      title: '¿Cancelar Asignación?',
      text: 'Se perderán todos los datos ingresados',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'Continuar editando'
    }).then((result) => {
      if (result.isConfirmed) {
        this.router.navigate(['/onus']);
      }
    });
  }

  hasError(field: string, error: string): boolean {
    const control = this.assignmentForm.get(field);
    return !!(control && control.hasError(error) && control.touched);
  }

  getStepIcon(step: number): string {
    if (step < this.currentStep()) return 'fa-check-circle';
    if (step === this.currentStep()) return 'fa-dot-circle';
    return 'fa-circle';
  }

  getStepClass(step: number): string {
    if (step < this.currentStep()) return 'completed';
    if (step === this.currentStep()) return 'active';
    return 'pending';
  }
}
