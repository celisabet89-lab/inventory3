import { Component, OnInit, OnDestroy, inject, signal, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { OnuService, OnuRequest } from '../services/onu.service';
import { MarcaOnuService } from '../services/marca-onu.service';
import { cargoDe, nombreUsuario } from '../services/onu-operaciones.service';
import { AuthService } from '../../../core/services/auth.service';
import { ALMACENES } from '../onu.constants';
import Swal from 'sweetalert2';

declare const BarcodeDetector: any;

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

  private fb          = inject(FormBuilder);
  private onuService  = inject(OnuService);
  private marcaSvc    = inject(MarcaOnuService);
  private auth        = inject(AuthService);

  onuForm!: FormGroup;
  isEditMode = signal(false);
  loading = signal(false);

  private contratoActual: number | null = null;
  private tipoPortadorActual = '';
  private portadorActual = '';

  marcas = signal<string[]>([]);
  readonly almacenes = ALMACENES;
  readonly estados = ['Disponible', 'Asignada', 'Instalado', 'Mantenimiento', 'Observado', 'Recogido', 'Defectuoso'];

  // Escáner
  scannerOpen  = signal(false);
  scannerField: 'serial' | 'mac' = 'serial';
  scanResult   = signal<string | null>(null);
  private stream: MediaStream | null = null;
  private scanInterval: any = null;

  // MAC en 6 partes
  macParts: string[] = ['', '', '', '', '', ''];
  readonly macIdx = [0, 1, 2, 3, 4, 5];

  onMacPartInput(event: any, index: number): void {
    let value = String(event.target.value).toUpperCase().replace(/[^0-9A-F]/g, '');
    if (value.length > 2) value = value.substring(0, 2);
    this.macParts[index] = value;
    event.target.value = value;
    if (value.length === 2 && index < 5) {
      const next = document.querySelectorAll('.mac-part')[index + 1] as HTMLInputElement;
      next?.focus();
    }
    this.updateMacFormControl();
  }

  getFullMac(): string { return this.macParts.join(':'); }

  updateMacFormControl(): void {
    const completa = this.macParts.every(p => p.length === 2);
    this.onuForm.get('mac')?.setValue(completa ? this.getFullMac() : '');
  }

  private setMac(mac: string): void {
    const limpia = (mac ?? '').toUpperCase().replace(/[^0-9A-F]/g, '');
    for (let i = 0; i < 6; i++) this.macParts[i] = limpia.substring(i * 2, i * 2 + 2);
    this.updateMacFormControl();
  }

  ngOnInit(): void {
    this.initForm();
    this.marcaSvc.getAll().subscribe({
      next: m => this.marcas.set(m.map(x => x.nombre).sort((a, b) => a.localeCompare(b, 'es'))),
      error: () => this.marcas.set([])
    });
    if (this.onuId) { this.isEditMode.set(true); this.loadOnu(this.onuId); }
  }
  ngOnDestroy(): void { this.stopCamera(); }

  initForm(): void {
    this.onuForm = this.fb.group({
      marca:         ['', Validators.required],
      modelo:        ['', Validators.required],
      serial:        ['', Validators.required],
      mac:           ['', [Validators.required, Validators.pattern(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/)]],
      estado:        ['Disponible', Validators.required],
      almacen:       [''],
      observaciones: [''],
      codigoQR:      ['']
    });
  }

  loadOnu(id: number): void {
    this.loading.set(true);
    this.onuService.getById(id).subscribe({
      next: (onu: any) => {
        this.contratoActual = onu.contrato ?? null;
        this.tipoPortadorActual = onu.tipoPortador || '';
        this.portadorActual = onu.portador || '';
        this.onuForm.patchValue({
          marca: onu.marca, modelo: onu.modelo, serial: onu.serial,
          estado: onu.estado, almacen: onu.almacen || '',
          observaciones: onu.observaciones, codigoQR: onu.codigoQR
        });
        this.setMac(onu.mac);
        // La marca de una ONU antigua puede no estar en el catálogo todavía
        if (onu.marca && !this.marcas().includes(onu.marca)) this.marcas.update(m => [...m, onu.marca]);
        this.loading.set(false);
      },
      error: () => {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar la ONU' });
        this.loading.set(false);
        this.cancelled.emit();
      }
    });
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
          if (this.scannerField === 'mac') this.setMac(value);
          else this.onuForm.patchValue({ serial: value });
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
    const v = this.onuForm.getRawValue();
    if (v.estado === 'Disponible' && !v.almacen) {
      Swal.fire({ icon: 'warning', title: 'Falta el almacén', text: 'Elige el almacén donde queda la ONU.' });
      return;
    }

    // En almacén: queda a cargo del almacén. Si está asignada/instalada se conserva su portador.
    const enAlmacen = !!v.almacen && !['Asignada', 'Instalado'].includes(v.estado);
    const usuario = this.auth.getCurrentUser();

    const data: OnuRequest = {
      marca: v.marca, modelo: v.modelo, serial: v.serial, mac: v.mac,
      estado: v.estado, observaciones: v.observaciones,
      contrato: this.contratoActual ?? undefined,
      almacen: v.almacen || undefined,
      tipoPortador: enAlmacen ? 'Almacén' : (this.tipoPortadorActual || undefined),
      portador: enAlmacen ? v.almacen : (this.portadorActual || undefined),
      codigoQR: v.codigoQR || `ONU-${v.serial}-${Date.now()}`
    };
    if (!this.isEditMode() && usuario) {
      // Para el historial: quién registró la ONU y con qué cargo
      data.registradoPor = nombreUsuario(usuario);
      data.cargoRegistro = cargoDe(usuario) || (usuario as any)?.profile?.cargo || (usuario as any)?.rol?.nombre || '';
    }

    this.loading.set(true);
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
