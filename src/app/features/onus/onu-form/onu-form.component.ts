import { Component, OnInit, OnDestroy, inject, signal, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { OnuService, OnuRequest } from '../services/onu.service';
import { ClientService } from '../../clients/services/client.service';
import { UserService } from '../../users/services/user.service';
import Swal from 'sweetalert2';

declare const BarcodeDetector: any;

interface ClienteOption {
  id: number;
  nombre: string;
  nContrato: string;
}

@Component({
  selector: 'app-onu-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './onu-form.component.html',
  styleUrl: './onu-form.component.css'
})
export class OnuFormComponent implements OnInit, OnDestroy {
  @Input() onuId: number | null = null;
  @Input() isEdit: boolean = false;
  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;

  private fb            = inject(FormBuilder);
  private onuService    = inject(OnuService);
  private clientService = inject(ClientService);
  private userService   = inject(UserService);

  onuForm!: FormGroup;
  isEditMode = signal(false);
  loading = signal(false);

  // Portador genérico (para Técnico / Usuario / Almacén)
  portadorOptions = signal<string[]>([]);

  // Clientes con contrato (para tipo = Cliente)
  clientesOptions = signal<ClienteOption[]>([]);
  mostrarClientes = false;

  // Escáner
  scannerOpen  = signal(false);
  scannerField: 'serial' | 'mac' = 'serial';
  macParts: string[] = ['', '', '', '', '', ''];

  onMacPartInput(event: any, index: number) {
    let value = event.target.value.toUpperCase();
    value = value.replace(/[^0-9A-Z]/g, '');
    if (value.length > 2) value = value.substring(0, 2);

    this.macParts[index] = value;
    event.target.value = value;

    if (value.length === 2 && index < 5) {
      const nextInput = document.querySelectorAll('.mac-part')[index + 1] as HTMLInputElement;
      if (nextInput) nextInput.focus();
    }

    this.updateMacFormControl();
  }

  getFullMac(): string {
    return this.macParts.join(':');
  }

  updateMacFormControl() {
    this.onuForm.get('mac')?.setValue(this.getFullMac());
  }

// Modifica el openScanner para que cuando escanee llame a este método
  setScannedMac(macValue: string) {
    let cleanMac = macValue.toUpperCase().replace(/[^0-9A-Z]/g, '');
    for (let i = 0; i < 6; i++) {
      this.macParts[i] = cleanMac.substring(i * 2, i * 2 + 2);
    }
    this.updateMacFormControl();

    // Actualizar inputs visualmente
    const inputs = document.querySelectorAll('.mac-part');
    inputs.forEach((input: Element, idx: number) => {
      (input as HTMLInputElement).value = this.macParts[idx];
    });
  }  scanResult   = signal<string | null>(null);
  private stream: MediaStream | null = null;
  private scanInterval: any = null;

  marcas  = ['Huawei', 'ZTE', 'Nokia', 'Fiberhome', 'TP-LINK', 'Otro'];
  estados = ['Disponible', 'Asignada', 'Mantenimiento', 'Instalado', 'Observado', 'Recogido', 'Defectuoso'];
  tiposPortador = [
    { value: 'Cliente',  label: '👤 Cliente'  },
    { value: 'Usuario',  label: '🧑‍💻 Usuario'  },
    { value: 'Almacén',  label: '🏭 Almacén'  },
    { value: 'Técnico',  label: '🔧 Técnico'  }
  ];

  ngOnInit(): void {
    this.initForm();
    if (this.onuId) { this.isEditMode.set(true); this.loadOnu(this.onuId); }
  }
  ngOnDestroy(): void { this.stopCamera(); }

  initForm(): void {
    this.onuForm = this.fb.group({
      marca:         ['Huawei', Validators.required],
      modelo:        ['', Validators.required],
      serial:        ['', Validators.required],
      mac:           ['', [Validators.required, Validators.pattern(/^([0-9A-Za-z]{2}[:\-]){5}[0-9A-Za-f]{2}$/)]],
      estado:        ['Disponible', Validators.required],
      contrato:      [{ value: '', disabled: false }],
      tipoPortador:  [''],
      portador:      [''],
      observaciones: [''],
      codigoQR:      ['']
    });
  }

  loadOnu(id: number): void {
    this.loading.set(true);
    this.onuService.getById(id).subscribe({
      next: (onu: any) => {
        this.onuForm.patchValue({
          marca: onu.marca, modelo: onu.modelo, serial: onu.serial, mac: onu.mac,
          estado: onu.estado, contrato: onu.contrato, observaciones: onu.observaciones,
          codigoQR: onu.codigoQR, tipoPortador: onu.tipoPortador || '', portador: onu.portador || ''
        });
        if (onu.tipoPortador) this.loadPortadorOptions(onu.tipoPortador);
        this.loading.set(false);
      },
      error: () => {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar la ONU' });
        this.loading.set(false);
        this.cancelled.emit();
      }
    });
  }

  onTipoPortadorChange(): void {
    const tipo = this.onuForm.get('tipoPortador')?.value;
    this.onuForm.patchValue({ portador: '', contrato: '' });
    this.mostrarClientes = false;
    this.clientesOptions.set([]);
    this.portadorOptions.set([]);
    this.loadPortadorOptions(tipo);
  }

  loadPortadorOptions(tipo: string): void {
    if (!tipo) { this.portadorOptions.set([]); this.mostrarClientes = false; return; }

    if (tipo === 'Cliente') {
      // Cargar clientes con su N° contrato
      this.mostrarClientes = true;
      this.clientService.getAll().subscribe({
        next: (clients: any[]) => {
          const opciones: ClienteOption[] = clients.map(c => ({
            id:        c.idCliente,
            nombre:    `${c.nombre ?? c.name} ${c.apellido ?? ''}`.trim(),
            nContrato: c.nContrato ?? ''
          }));
          this.clientesOptions.set(opciones);
        },
        error: () => this.clientesOptions.set([])
      });
    } else {
      this.mostrarClientes = false;
      if (tipo === 'Usuario' || tipo === 'Técnico') {
        this.userService.getAll().subscribe({
          next: (users: any[]) => this.portadorOptions.set(users.map(u => u.name ?? u.nombre ?? u.email)),
          error: () => this.portadorOptions.set([])
        });
      } else if (tipo === 'Almacén') {
        this.portadorOptions.set(['Almacén Central', 'Almacén Norte', 'Almacén Sur']);
      }
    }
  }

  /** Cuando el usuario elige un cliente del select:
   *  → llena el campo portador con el nombre
   *  → llena el campo contrato con su N° contrato automáticamente */
  onClienteChange(event: Event): void {
    const clienteId = parseInt((event.target as HTMLSelectElement).value);
    const cliente = this.clientesOptions().find(c => c.id === clienteId);
    if (cliente) {
      this.onuForm.patchValue({
        portador: cliente.nombre,
        contrato: cliente.nContrato   // ← AUTO-FILL del contrato del cliente
      });
    }
  }

  // ======== ESCÁNER ========
  async openScanner(field: 'serial' | 'mac'): Promise<void> {
    this.scannerField = field;
    this.scanResult.set(null);
    this.scannerOpen.set(true);
    setTimeout(() => this.startCamera(), 150);
  }

  private async startCamera(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      const video = this.videoEl?.nativeElement;
      if (video) { video.srcObject = this.stream; await video.play(); this.startBarcodeDetection(); }
    } catch {
      Swal.fire({ icon: 'error', title: 'Sin acceso a la cámara', text: 'Permite el acceso a la cámara en tu navegador' });
      this.closeScanner();
    }
  }

  private startBarcodeDetection(): void {
    if (typeof BarcodeDetector === 'undefined') {
      Swal.fire({ icon: 'warning', title: 'Escáner no disponible', text: 'Tu navegador no soporta escaneo automático. Usa Chrome o Edge. Ingresa el código manualmente.' });
      this.closeScanner(); return;
    }
    const detector = new BarcodeDetector({ formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'data_matrix'] });
    const video = this.videoEl.nativeElement;
    this.scanInterval = setInterval(async () => {
      if (!video || video.readyState < 2) return;
      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          const value = barcodes[0].rawValue;
          this.scanResult.set(value);
          this.onuForm.patchValue({ [this.scannerField]: value });
          if (navigator.vibrate) navigator.vibrate(200);
          setTimeout(() => this.closeScanner(), 1000);
        }
      } catch {}
    }, 300);
  }

  closeScanner(): void { this.stopCamera(); this.scannerOpen.set(false); }
  private stopCamera(): void {
    if (this.scanInterval) { clearInterval(this.scanInterval); this.scanInterval = null; }
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
  }

  // ======== SUBMIT ========
  onSubmit(): void {
    if (this.onuForm.invalid) {
      Object.keys(this.onuForm.controls).forEach(k => this.onuForm.get(k)?.markAsTouched());
      Swal.fire({ icon: 'warning', title: 'Formulario incompleto', text: 'Completa los campos requeridos' });
      return;
    }
    this.loading.set(true);
    const v = this.onuForm.getRawValue();
    const data: OnuRequest = {
      ...v,
      codigoQR: v.codigoQR || `ONU-${v.serial}-${Date.now()}`
    };
    const op = (this.isEditMode() && this.onuId)
      ? this.onuService.update(this.onuId, data)
      : this.onuService.create(data);
    op.subscribe({
      next: () => Swal.fire({
        icon: 'success',
        title: this.isEditMode() ? 'ONU actualizada' : 'ONU creada',
        timer: 1800, showConfirmButton: false
      }).then(() => this.saved.emit()),
      error: () => { Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar la ONU' }); this.loading.set(false); }
    });
  }

  cancel(): void { this.cancelled.emit(); }
  hasError(field: string, error: string): boolean {
    const c = this.onuForm.get(field);
    return !!(c && c.hasError(error) && c.touched);
  }
}
