import {Component, OnInit, inject, signal, NgIterable} from '@angular/core';
import { CommonModule } from '@angular/common';
import {FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, FormsModule} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DeliveryService } from '../services/delivery.service';
import { ClientService } from '../../clients/services/client.service';
import { ProductService } from '../../products/services/product.service';
import { AuthService } from '../../../core/services/auth.service';
import { Product } from '../../../models/product.model';
import Swal from 'sweetalert2';
import { Client, Delivery, DeliveryDetails } from '../../../models';

@Component({
  selector: 'app-delivery-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule],
  templateUrl: './delivery-form.component.html',
  styleUrls: ['./delivery-form.component.css']
})
export class DeliveryFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private deliveryService = inject(DeliveryService);
  private clientService = inject(ClientService);
  private productService = inject(ProductService);
  private authService = inject(AuthService);

  deliveryForm!: FormGroup;
  detailsFormArray!: FormArray;

  isEditMode = signal(false);
  deliveryId = signal<number | null>(null);
  loading = signal(false);
  submitting = signal(false);

  // Data lists
  clients = signal<Client[]>([]);
  products = signal<Product[]>([]);

  // Selected items
  selectedClient = signal<Client | null>(null);
  selectedProducts = signal<Map<number, { product: Product, cantidad: number }>>(new Map());

  ngOnInit(): void {
    this.initForm();
    this.loadData();

    const id = this.route.snapshot.params['id'];
    if (id) {
      this.isEditMode.set(true);
      this.deliveryId.set(Number(id));
      this.loadDelivery(Number(id));
    }
  }

  initForm(): void {
    this.deliveryForm = this.fb.group({
      fecha: [new Date().toISOString().split('T')[0], [Validators.required]],
      observacion: ['', [Validators.maxLength(500)]],
      clienteId: ['', [Validators.required]],
      detalles: this.fb.array([])
    });

    this.detailsFormArray = this.deliveryForm.get('detalles') as FormArray;
  }

  loadData(): void {
    this.loading.set(true);

    // Load clients
    // @ts-ignore
    this.clientService.getMockClientsObservable().subscribe({
      next: (clients: Client[]) => {
        this.clients.set(clients);
      },
      error: (error: any) => {
        console.error('Error loading clients:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar los clientes'
        });
      }
    });

    // Load products
    // In real implementation: this.productService.getAll().subscribe(...)
    this.products.set([
    ]);

    this.loading.set(false);
  }

  loadDelivery(id: number): void {
    this.loading.set(true);

    // Mock implementation
    // @ts-ignore
    const mockDelivery = this.deliveryService.getMockDeliveries().find((d: { idDelivery: number; }) => d.idDelivery === id);

    if (mockDelivery) {
      this.deliveryForm.patchValue({
        fecha: new Date(mockDelivery.fecha).toISOString().split('T')[0],
        observacion: mockDelivery.observacion,
        clienteId: mockDelivery.cliente.idCliente
      });

      this.selectedClient.set(mockDelivery.cliente as any);

      // Add details to form
      if (mockDelivery.detalles) {
        mockDelivery.detalles.forEach((table: { product: { idProducto: number; }; cantidad: number | undefined; }) => {
          this.addProductDetail(table.product.idProducto, table.cantidad);
        });
      }
    }

    this.loading.set(false);
  }

  // Client selection
  onClientSelect(clientId: number): void {
    const client = this.clients().find(c => c.idCliente === clientId);
    this.selectedClient.set(client || null);
  }

  // Product management
  delivery: any;
  users: (NgIterable<unknown> & NgIterable<any>) | undefined | null;
  quantity: any;
  selectedProduct: any;
  cliente: (NgIterable<unknown> & NgIterable<any>) | undefined | null;
  addProductDetail(productId: number, cantidad: number = 1): void {
    const product = this.products().find(p => p.idProducto === productId);

    if (!product) return;

    // Check if product already added
    if (this.selectedProducts().has(productId)) {
      const existing = this.selectedProducts().get(productId)!;
      this.selectedProducts().set(productId, {
        product,
        cantidad: existing.cantidad + cantidad
      });
    } else {
      this.selectedProducts().set(productId, { product, cantidad });
    }

    // Update form array
    this.updateDetailsFormArray();
  }

  removeProduct(productId: number): void {
    this.selectedProducts().delete(productId);
    this.updateDetailsFormArray();
  }

  updateProductQuantity(productId: number, quantity: number): void {
    const product = this.products().find(p => p.idProducto === productId);

    if (!product) return;

    if (quantity <= 0) {
      this.removeProduct(productId);
      return;
    }

    this.selectedProducts().set(productId, { product, cantidad: quantity });
    this.updateDetailsFormArray();
  }

  private updateDetailsFormArray(): void {
    this.detailsFormArray.clear();
    this.selectedProducts().forEach((detail, productId) => {
      this.detailsFormArray.push(this.fb.group({
        productoId: [productId],
        cantidad: [detail.cantidad, Validators.required]
      }));
    });
  }

  onSubmit(): void {
    if (this.deliveryForm.invalid) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor, complete todos los campos requeridos.'
      });
      return;
    }

    this.submitting.set(true);

    const deliveryData = {
      ...this.deliveryForm.value,
      clienteId: this.deliveryForm.get('clienteId')?.value,
      detalles: this.detailsFormArray.value
    };

    console.log('Delivery Data:', deliveryData);

    // Mock Save
    setTimeout(() => {
      Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: 'Entrega guardada correctamente.',
        timer: 2000,
        showConfirmButton: false
      }).then(() => {
        this.router.navigate(['/delivery']);
      });
      this.submitting.set(false);
    }, 1500);
  }

  get deliveriesDetailsControls() {
    return (this.deliveryForm.get('detalles') as FormArray).controls;
  }

  openClientModal() {

  }

  removeMaterial(i: number) {

  }

  closeClientModal() {

  }

  addMaterial() {

  }
}
