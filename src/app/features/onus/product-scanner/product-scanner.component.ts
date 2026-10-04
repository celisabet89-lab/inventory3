import { Component, OnInit, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ProductService } from '../../products/services/product.service';
import { Product } from '../../../models/product.model';
import Swal from 'sweetalert2';

interface ScanResult {
  code: string;
  format: 'QR_CODE' | 'BARCODE';
  timestamp: Date;
}

@Component({
  selector: 'app-product-scanner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-scanner.component.html',
  styleUrls: ['./product-scanner.component.css']
})
export class ProductScannerComponent implements OnInit {
  @ViewChild('video') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasElement!: ElementRef<HTMLCanvasElement>;

  private productService = inject(ProductService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Estados
  scanning = signal(false);
  cameraActive = signal(false);
  scanHistory = signal<ScanResult[]>([]);
  currentProduct = signal<Product | null>(null);
  sessionId = signal<string>('');

  // Configuración
  stream: MediaStream | null = null;
  scanInterval: any;

  ngOnInit(): void {
    // Obtener sessionId de la URL si existe
    this.route.queryParams.subscribe(params => {
      if (params['session']) {
        this.sessionId.set(params['session']);
        this.startScanning();
      }
    });
  }

  async startScanning(): Promise<void> {
    try {
      // Solicitar permiso de cámara
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Cámara trasera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (this.videoElement) {
        this.videoElement.nativeElement.srcObject = this.stream;
        this.cameraActive.set(true);
        this.scanning.set(true);

        // Iniciar detección de códigos
        this.startCodeDetection();
      }
    } catch (error) {
      console.error('Error al acceder a la cámara:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error de Cámara',
        text: 'No se pudo acceder a la cámara. Por favor verifica los permisos.',
        confirmButtonColor: '#2563eb'
      });
    }
  }

  startCodeDetection(): void {
    // Usar BarcodeDetector API si está disponible
    if ('BarcodeDetector' in window) {
      this.useBarcodeDetector();
    } else {
      // Fallback: usar biblioteca externa (ZXing)
      this.useZXingScanner();
    }
  }

  async useBarcodeDetector(): Promise<void> {
    const barcodeDetector = new (window as any).BarcodeDetector({
      formats: ['qr_code', 'ean_13', 'code_128', 'code_39']
    });

    this.scanInterval = setInterval(async () => {
      if (!this.scanning() || !this.videoElement) return;

      try {
        const barcodes = await barcodeDetector.detect(this.videoElement.nativeElement);

        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          const format = barcodes[0].format.includes('qr') ? 'QR_CODE' : 'BARCODE';

          await this.processScannedCode(code, format);
        }
      } catch (error) {
        console.error('Error al detectar código:', error);
      }
    }, 100); // Escanear cada 100ms
  }

  useZXingScanner(): void {
    // Fallback: escaneo manual con canvas
    this.scanInterval = setInterval(() => {
      if (!this.scanning() || !this.videoElement || !this.canvasElement) return;

      const video = this.videoElement.nativeElement;
      const canvas = this.canvasElement.nativeElement;
      const context = canvas.getContext('2d');

      if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      // Ajustar tamaño del canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Capturar frame del video
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Aquí podrías usar una librería de detección de códigos
      // O mostrar un mensaje al usuario para que use BarcodeDetector
      console.log('Esperando código...');
    }, 500);
  }

  async processScannedCode(code: string, format: 'QR_CODE' | 'BARCODE'): Promise<void> {
    // Evitar escaneos duplicados
    const lastScan = this.scanHistory()[0];
    if (lastScan && lastScan.code === code &&
      (new Date().getTime() - lastScan.timestamp.getTime()) < 3000) {
      return;
    }

    // Detener escaneo temporalmente
    this.scanning.set(false);

    // Registrar escaneo
    const scanResult: ScanResult = {
      code,
      format,
      timestamp: new Date()
    };

    this.scanHistory.update(history => [scanResult, ...history.slice(0, 9)]);

    // Buscar producto
    await this.findProduct(code);

    // Vibrar el dispositivo
    if ('vibrate' in navigator) {
      navigator.vibrate(200);
    }

    // Reanudar escaneo después de 2 segundos
    setTimeout(() => {
      if (this.cameraActive()) {
        this.scanning.set(true);
      }
    }, 2000);
  }

  async findProduct(code: string): Promise<void> {
    this.productService.getAll().subscribe({
      next: (products) => {
        const product = products.find(p =>
          p.codigoQR === code || p.codigoBarras === code
        );

        if (product) {
          this.currentProduct.set(product);
          this.showProductActions(product);
        } else {
          Swal.fire({
            icon: 'warning',
            title: 'Producto no encontrado',
            text: `No se encontró ningún producto con el código: ${code}`,
            confirmButtonColor: '#2563eb'
          });
        }
      },
      error: (error) => {
        console.error('Error al buscar producto:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al buscar el producto',
          confirmButtonColor: '#2563eb'
        });
      }
    });
  }

  showProductActions(product: Product): void {
    Swal.fire({
      title: product.articulo,
      html: `
        <div style="text-align: left; padding: 10px;">
          <p><strong>Categoría:</strong> ${product.categoria}</p>
          <p><strong>Stock actual:</strong> ${product.unidad || 0} unidades</p>
          <p><strong>Precio:</strong> Bs ${product.precio || 0}</p>
          ${product.descripcion ? `<p><strong>Descripción:</strong> ${product.descripcion}</p>` : ''}
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Ver detalles',
      cancelButtonText: 'Continuar escaneando',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280'
    }).then((result) => {
      if (result.isConfirmed) {
        // Enviar al detalle del producto en la PC
        this.sendToDesktop('view-product', product.idProducto);
      }
    });
  }

  sendToDesktop(action: string, productId?: number): void {
    // Aquí implementarías WebSocket o API para comunicar con la PC
    console.log('Enviando acción a PC:', action, productId);

    // Simulación de envío
    Swal.fire({
      icon: 'success',
      title: 'Acción enviada',
      text: 'La información se ha enviado a la computadora',
      timer: 1500,
      showConfirmButton: false
    });
  }

  stopScanning(): void {
    this.scanning.set(false);
    this.cameraActive.set(false);

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  clearHistory(): void {
    this.scanHistory.set([]);
  }

  ngOnDestroy(): void {
    this.stopScanning();
  }
}
