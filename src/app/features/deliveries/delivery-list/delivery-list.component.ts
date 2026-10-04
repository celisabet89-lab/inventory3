import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DeliveryService } from '../services/delivery.service';
import { ClientService }   from '../../clients/services/client.service';
import { UserService }     from '../../users/services/user.service';
import { ProductService }  from '../../products/services/product.service';
import Swal from 'sweetalert2';

interface DetalleItem {
  productId:   number;
  articulo:    string;
  cantidad:    number;
  _product:    any;
}

@Component({
  selector: 'app-delivery-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './delivery-list.component.html',
  styleUrls: ['./delivery-list.component.css']
})
export class DeliveryListComponent implements OnInit {
  private deliveryService = inject(DeliveryService);
  private clientService   = inject(ClientService);
  private userService     = inject(UserService);
  private productService  = inject(ProductService);
  private fb              = inject(FormBuilder);

  deliveries      = signal<any[]>([]);
  filteredList    = signal<any[]>([]);
  clientes        = signal<any[]>([]);
  tecnicos        = signal<any[]>([]);
  productos       = signal<any[]>([]);
  loading         = signal(false);
  showModal       = signal(false);
  showDetalle     = signal(false);
  isEdit          = false;
  selectedId: number | null = null;
  detalleEntrega: any = null;

  detalle: DetalleItem[] = [];
  productoSearch = '';
  productosFiltrados = signal<any[]>([]);

  filtroEstado = 'TODOS';
  searchTerm   = '';

  estadoOpciones = ['TODOS','PENDIENTE','EN_CAMINO','INSTALADO','CANCELADO'];
  estadoEntrega  = ['PENDIENTE','EN_CAMINO','INSTALADO','CANCELADO'];

  form!: FormGroup;

  // Stats
  get total()      { return this.deliveries().length; }
  get pendientes() { return this.deliveries().filter(d => d.estado === 'PENDIENTE').length; }
  get enCamino()   { return this.deliveries().filter(d => d.estado === 'EN_CAMINO').length; }
  get instalados() { return this.deliveries().filter(d => d.estado === 'INSTALADO').length; }
  get cancelados() { return this.deliveries().filter(d => d.estado === 'CANCELADO').length; }

  ngOnInit(): void {
    this.initForm();
    this.loadAll();
  }

  initForm(): void {
    this.form = this.fb.group({
      clienteId:        [null, Validators.required],
      tecnicoId:        [null],
      estado:           ['PENDIENTE'],
      fecha:            [new Date().toISOString().split('T')[0]],
      direccionEntrega: [''],
      observacion:      ['']
    });
  }

  loadAll(): void {
    this.loading.set(true);
    this.deliveryService.getAll().subscribe({
      next: d => { this.deliveries.set(d); this.applyFilter(); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
    this.clientService.getAll().subscribe({ next: c => this.clientes.set(c), error: () => {} });
    this.userService.getAll().subscribe({
      next: (u: any[]) => {
        const tecnicos = u.filter(x => {
          const cargo = x.profile?.cargo ?? x.rol?.cargo ?? '';
          return cargo === 'Técnico' || cargo === 'Técnicos';
        });
        this.tecnicos.set(tecnicos.length ? tecnicos : u);
      },
      error: () => {}
    });
    this.productService.getAll().subscribe({
      next: p => { this.productos.set(p); this.productosFiltrados.set(p); },
      error: () => {}
    });
  }

  applyFilter(): void {
    let list = [...this.deliveries()];
    if (this.filtroEstado !== 'TODOS') list = list.filter(d => d.estado === this.filtroEstado);
    const t = this.searchTerm.toLowerCase().trim();
    if (t) list = list.filter(d =>
      d.codigo?.toLowerCase().includes(t) ||
      (d.cliente?.name ?? '').toLowerCase().includes(t) ||
      (d.cliente?.apellido ?? '').toLowerCase().includes(t)
    );
    this.filteredList.set(list);
  }

  // ── MODAL NUEVO/EDITAR ────────────────────────────────────────
  openNew(): void {
    this.isEdit = false; this.selectedId = null; this.detalle = [];
    this.form.reset({ estado: 'PENDIENTE', fecha: new Date().toISOString().split('T')[0] });
    this.showModal.set(true);
  }

  openEdit(d: any): void {
    this.isEdit = true; this.selectedId = d.idDelivery;
    this.form.patchValue({
      clienteId:        d.cliente?.idCliente,
      tecnicoId:        d.tecnico?.idUser,
      estado:           d.estado,
      fecha:            d.fecha,
      direccionEntrega: d.direccionEntrega,
      observacion:      d.observacion
    });
    this.detalle = (d.detalles ?? []).map((det: any) => ({
      productId: det.product?.idProducto,
      articulo:  det.product?.articulo,
      cantidad:  det.cantidad,
      _product:  det.product
    }));
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); }

  // ── DETALLE PRODUCTOS ─────────────────────────────────────────
  onProductoSearch(): void {
    const t = this.productoSearch.toLowerCase();
    this.productosFiltrados.set(
      t ? this.productos().filter(p => p.articulo?.toLowerCase().includes(t)) : this.productos()
    );
  }

  addProducto(p: any): void {
    const existe = this.detalle.find(d => d.productId === p.idProducto);
    if (existe) { existe.cantidad++; return; }
    this.detalle = [...this.detalle, { productId: p.idProducto, articulo: p.articulo, cantidad: 1, _product: p }];
  }

  removeDetalle(idx: number): void { this.detalle = this.detalle.filter((_, i) => i !== idx); }

  // ── GUARDAR ───────────────────────────────────────────────────
  guardar(): void {
    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach(k => this.form.get(k)?.markAsTouched());
      Swal.fire({ icon: 'warning', title: 'Cliente requerido' });
      return;
    }
    if (!this.detalle.length) {
      Swal.fire({ icon: 'warning', title: 'Agrega al menos un producto' });
      return;
    }
    this.loading.set(true);
    const v = this.form.value;
    const body = {
      ...v,
      detalles: this.detalle.map(d => ({ productId: d.productId, cantidad: d.cantidad }))
    };
    const op = this.isEdit && this.selectedId
      ? this.deliveryService.update(this.selectedId, body)
      : this.deliveryService.create(body);

    op.subscribe({
      next: () => {
        Swal.fire({ icon: 'success', title: this.isEdit ? 'Entrega actualizada' : 'Entrega creada', timer: 1600, showConfirmButton: false });
        this.closeModal();
        this.loadAll();
      },
      error: () => { Swal.fire({ icon: 'error', title: 'Error al guardar' }); this.loading.set(false); }
    });
  }

  // ── VER DETALLE ───────────────────────────────────────────────
  verDetalle(d: any): void { this.detalleEntrega = d; this.showDetalle.set(true); }
  cerrarDetalle(): void { this.showDetalle.set(false); this.detalleEntrega = null; }

  // ── CAMBIAR ESTADO RÁPIDO ─────────────────────────────────────
  cambiarEstado(d: any, nuevoEstado: string): void {
    this.deliveryService.update(d.idDelivery, { estado: nuevoEstado }).subscribe({
      next: () => this.loadAll(),
      error: () => Swal.fire({ icon: 'error', title: 'Error al actualizar' })
    });
  }

  eliminar(d: any): void {
    Swal.fire({
      title: '¿Eliminar entrega?', text: `Código: ${d.codigo}`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#ef4444', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar'
    }).then(r => {
      if (r.isConfirmed)
        this.deliveryService.delete(d.idDelivery).subscribe({ next: () => this.loadAll() });
    });
  }

  getNombreCliente(c: any): string {
    if (!c) return '—';
    return `${c.nombre ?? c.name ?? ''} ${c.apellido ?? ''}`.trim();
  }

  getNombreTecnico(u: any): string {
    if (!u) return '—';
    return u.profile ? `${u.profile.name} ${u.profile.lastName ?? ''}`.trim() : u.email;
  }

  getEstadoClass(e: string): string {
    return ({ 'PENDIENTE':'est-pendiente','EN_CAMINO':'est-camino','INSTALADO':'est-instalado','CANCELADO':'est-cancelado' } as any)[e] ?? '';
  }

  getEstadoIcono(e: string): string {
    return ({ 'PENDIENTE':'⏳','EN_CAMINO':'🚚','INSTALADO':'✅','CANCELADO':'❌' } as any)[e] ?? '📦';
  }
}
