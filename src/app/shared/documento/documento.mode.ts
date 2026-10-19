/**
 * Lógica común de cobros y pagos (sin pantalla):
 * agrupa los movimientos por código y calcula lo cobrado/pagado y el saldo.
 */

/** Lo mínimo que se necesita de un cobro o un pago para calcular saldos. */
export interface RegistroPago {
  codigo: string;
  monto: number;
  /** ACTIVO | ANULADO. Los registros antiguos pueden venir sin estado: cuentan como ACTIVO. */
  estado?: string;
}

export interface ProductoLinea {
  articulo: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

/** Una venta (o compra) con sus productos y su estado de cobro (o pago). */
export interface Documento {
  codigo: string;
  contraparte: string;
  fecha?: string;
  productos: ProductoLinea[];
  total: number;
  pagado: number;
  saldo: number;
  estadoPago: 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
  formaPago: string;
}

const TOLERANCIA = 0.01;

export function tieneSaldo(doc: Documento): boolean {
  return doc.saldo > TOLERANCIA;
}

export function esRegistroActivo(registro: { estado?: string }): boolean {
  return String(registro.estado ?? '').toUpperCase() !== 'ANULADO';
}

function montoLinea(m: any): number {
  const guardado = Number(m.total ?? m.subtotal ?? m.liquido ?? 0);
  if (guardado > 0) return guardado;

  const precio = Number(m.product?.precio ?? m.producto?.precio ?? 0);
  return Number(m.cantidad ?? 0) * precio;
}

function lineaDe(m: any): ProductoLinea {
  const cantidad = Number(m.cantidad ?? 0);
  const subtotal = montoLinea(m);

  return {
    articulo:
      m.product?.articulo ??
      m.producto?.articulo ??
      m.articulo ??
      'Producto sin nombre',
    cantidad,
    precioUnitario: cantidad > 0 ? subtotal / cantidad : subtotal,
    subtotal
  };
}

/**
 * Agrupa los movimientos por código y calcula, para cada venta o compra,
 * sus productos, lo cobrado/pagado (solo registros ACTIVOS) y el saldo.
 */
export function construirDocumentos(
  movimientos: any[],
  tipo: 'SALIDA' | 'ENTRADA',
  registros: RegistroPago[]
): Documento[] {
  const grupos = new Map<string, any[]>();

  movimientos
    .filter(m => String(m.tipo ?? m.tipoMovimiento ?? '').toUpperCase() === tipo)
    .filter(m =>
      !m.estadoMovimiento ||
      String(m.estadoMovimiento).toUpperCase() === 'ACTIVO'
    )
    .filter(m => !!m.codigo)
    .forEach(m => {
      const codigo = String(m.codigo).trim();
      const grupo = grupos.get(codigo) ?? [];
      grupo.push(m);
      grupos.set(codigo, grupo);
    });

  const documentos = Array.from(grupos.entries()).map(([codigo, items]) => {
    const productos = items.map(lineaDe);
    const total = productos.reduce((suma, p) => suma + p.subtotal, 0);

    const pagadoRegistrado = registros
      .filter(r => esRegistroActivo(r) && String(r.codigo).trim() === codigo)
      .reduce((suma, r) => suma + Number(r.monto ?? 0), 0);

    const estadoOriginal = String(items[0].estadoPago ?? 'PENDIENTE')
      .trim()
      .toUpperCase();

    // Lo marcado como pagado al contado no tiene registros de cobro/pago.
    const pagado =
      estadoOriginal === 'PAGADO' && pagadoRegistrado === 0
        ? total
        : pagadoRegistrado;

    const saldo = Math.max(0, total - pagado);

    let estadoPago: Documento['estadoPago'];
    if (saldo <= TOLERANCIA) estadoPago = 'PAGADO';
    else if (pagado > 0) estadoPago = 'PARCIAL';
    else estadoPago = 'PENDIENTE';

    return {
      codigo,
      contraparte:
        items[0].responsable ??
        items[0].clienteNombre ??
        items[0].proveedorNombre ??
        'Sin registrar',
      fecha: items[0].fecha,
      productos,
      total,
      pagado,
      saldo,
      estadoPago,
      formaPago: items[0].formaPago ?? 'No especificada'
    };
  });

  return documentos.sort((a, b) =>
    String(b.fecha ?? '').localeCompare(String(a.fecha ?? ''))
  );
}
