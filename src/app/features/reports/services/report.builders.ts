import { TablaExportable, Celda } from '../../../shared/exportar/exportar.util';
import { construirDocumentos, Documento, esRegistroActivo } from '../../../shared/documento/documento.mode';
import { Cobro } from '../../cobro/service/cobro.service';
import { Pago } from '../../pago/service/pago.service';

export type TipoReporte =
  | 'COBRANZAS' | 'VENTAS' | 'INGRESOS' | 'COBROS' | 'PAGOS' | 'CANASTILLOS'
  | 'USUARIOS' | 'CLIENTES' | 'PRODUCTOS' | 'PROVEEDORES' | 'ONUS';

export interface DatosReporte {
  movs: any[];
  cobros: Cobro[];
  pagos: Pago[];
  usuarios?: any[];
  clientes?: any[];
  productos?: any[];
  proveedores?: any[];
  onus?: any[];
  existencias?: any[];
}

export interface FiltrosReporte {
  /** Mes inicial, formato YYYY-MM. */
  desde: string;
  /** Mes final, formato YYYY-MM. */
  hasta: string;
  /** Cliente o proveedor; '' = todos. */
  contraparte: string;
  /** '' = todas. */
  formaPago: string;
  /** Solo canastillos: texto a buscar en categoría o nombre del producto. */
  palabra: string;
}

export interface InfoReporte {
  tipo: TipoReporte;
  titulo: string;
  /** Etiqueta del filtro principal (Cliente, Proveedor, Rol, Estado, Categoría...). */
  etiquetaContraparte: string;
  /** Título del bloque de filtros ("Datos Cliente"...). */
  tituloDatos?: string;
  /** Listados completos (usuarios, clientes...): sin período ni forma de pago. */
  esListado?: boolean;
  /** Texto de la caja de búsqueda. */
  etiquetaPalabra?: string;
  /** Cobranzas: se listan TODAS las deudas hasta el mes final, sin mes inicial. */
  soloHasta?: boolean;
  usaPalabra?: boolean;
}

export const REPORTES: InfoReporte[] = [
  { tipo: 'COBRANZAS', titulo: 'Reporte Cobranzas Pendientes', etiquetaContraparte: 'Cliente', soloHasta: true },
  { tipo: 'VENTAS', titulo: 'Reporte de Ventas', etiquetaContraparte: 'Cliente' },
  { tipo: 'INGRESOS', titulo: 'Reporte de Ingresos', etiquetaContraparte: 'Cliente' },
  { tipo: 'COBROS', titulo: 'Reporte de Cobros', etiquetaContraparte: 'Cliente' },
  { tipo: 'PAGOS', titulo: 'Reporte de Pagos', etiquetaContraparte: 'Proveedor' },
  { tipo: 'CANASTILLOS', titulo: 'Reporte de Canastillos', etiquetaContraparte: 'Cliente', usaPalabra: true, etiquetaPalabra: 'Producto o categoría contiene:' },
  { tipo: 'USUARIOS', titulo: 'Reporte de Usuarios', etiquetaContraparte: 'Rol', tituloDatos: 'Datos Usuario', esListado: true, usaPalabra: true, etiquetaPalabra: 'Buscar (nombre, correo, CI):' },
  { tipo: 'CLIENTES', titulo: 'Reporte de Clientes', etiquetaContraparte: 'Estado', tituloDatos: 'Datos Cliente', esListado: true, usaPalabra: true, etiquetaPalabra: 'Buscar (nombre, CI, zona):' },
  { tipo: 'PRODUCTOS', titulo: 'Reporte de Productos', etiquetaContraparte: 'Categoría', tituloDatos: 'Datos Producto', esListado: true, usaPalabra: true, etiquetaPalabra: 'Buscar (producto, código):' },
  { tipo: 'PROVEEDORES', titulo: 'Reporte de Proveedores', etiquetaContraparte: 'Estado', tituloDatos: 'Datos Proveedor', esListado: true, usaPalabra: true, etiquetaPalabra: 'Buscar (empresa, contacto, NIT):' },
  { tipo: 'ONUS', titulo: 'Reporte de ONUs', etiquetaContraparte: 'Estado', tituloDatos: 'Datos ONU', esListado: true, usaPalabra: true, etiquetaPalabra: 'Buscar (serial, MAC, cliente):' }
];

export function infoDe(tipo: TipoReporte): InfoReporte {
  return REPORTES.find(r => r.tipo === tipo) ?? REPORTES[0];
}

/* ───────────── utilidades ───────────── */

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

export function mesActual(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
}

function etiquetaMes(ym: string): string {
  const [a, m] = ym.split('-');
  return `${MESES[Number(m) - 1] ?? ym}/${a}`;
}

export function etiquetaPeriodo(f: FiltrosReporte, soloHasta = false): string {
  if (soloHasta) return `HASTA ${etiquetaMes(f.hasta)}`;
  return f.desde === f.hasta ? etiquetaMes(f.desde) : `${etiquetaMes(f.desde)} - ${etiquetaMes(f.hasta)}`;
}

function enPeriodo(fecha: string | undefined, f: FiltrosReporte, soloHasta = false): boolean {
  if (!fecha) return true;
  const ym = String(fecha).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(ym)) return true;
  if (ym > f.hasta) return false;
  return soloHasta || ym >= f.desde;
}

export function dia(fecha?: string): string {
  if (!fecha) return '';
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha));
  if (soloFecha) return `${soloFecha[3]}/${soloFecha[2]}/${soloFecha[1]}`;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return String(fecha);
  return new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

const redondear = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const suma = (valores: number[]) => redondear(valores.reduce((s, v) => s + v, 0));
const moneda = (n: number) =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', minimumFractionDigits: 2 }).format(n || 0);

const esSalida = (m: any) => String(m.tipo ?? m.tipoMovimiento ?? '').toUpperCase() === 'SALIDA';
const esActivo = (m: any) => !m.estadoMovimiento || String(m.estadoMovimiento).toUpperCase() === 'ACTIVO';
const contrapartesDe = (m: any) => m.responsable ?? m.clienteNombre ?? m.proveedorNombre ?? 'Sin registrar';

function nombreCategoria(m: any): string {
  const c = m.product?.categoria ?? m.producto?.categoria;
  return typeof c === 'string' ? c : c?.nombre ?? '';
}

function subtotalLinea(m: any): number {
  const guardado = Number(m.total ?? m.subtotal ?? m.liquido ?? 0);
  if (guardado > 0) return guardado;
  return Number(m.cantidad ?? 0) * Number(m.product?.precio ?? m.producto?.precio ?? 0);
}

const estadoTexto = (e: string) => (e === 'PAGADO' ? 'Pagado' : e === 'PARCIAL' ? 'Parcial' : 'Pendiente');

export function ventasDe(d: DatosReporte): Documento[] {
  return construirDocumentos(d.movs, 'SALIDA', d.cobros.map(c => ({ codigo: c.codigoVenta, monto: c.monto, estado: c.estado })));
}

export function comprasDe(d: DatosReporte): Documento[] {
  return construirDocumentos(d.movs, 'ENTRADA', d.pagos.map(p => ({ codigo: p.codigoCompra, monto: p.monto, estado: p.estado })));
}

/** Nombres para el filtro Cliente / Proveedor. */
export function opcionesContraparte(tipo: TipoReporte, d: DatosReporte): string[] {
  if (infoDe(tipo).esListado) {
    const valores = listado(tipo, d).map(r => String(r.filtro)).filter(Boolean);
    return Array.from(new Set(valores)).sort((a, b) => a.localeCompare(b, 'es'));
  }
  const docs = infoDe(tipo).etiquetaContraparte === 'Proveedor' ? comprasDe(d) : ventasDe(d);
  return Array.from(new Set(docs.map(x => x.contraparte))).sort((a, b) => a.localeCompare(b, 'es'));
}

export function opcionesFormaPago(d: DatosReporte): string[] {
  const todas = [
    ...d.cobros.map(c => c.formaPago),
    ...d.pagos.map(p => p.formaPago),
    ...d.movs.map(m => m.formaPago)
  ].filter(Boolean);
  return Array.from(new Set(todas)).sort((a, b) => a.localeCompare(b, 'es'));
}

/* ───────────── constructor de cada reporte ───────────── */

export function construirReporte(tipo: TipoReporte, d: DatosReporte, f: FiltrosReporte): TablaExportable {
  switch (tipo) {
    case 'VENTAS': return reporteVentas(d, f);
    case 'INGRESOS': return reporteIngresos(d, f);
    case 'COBROS': return reporteRegistros(d, f, 'COBROS');
    case 'PAGOS': return reporteRegistros(d, f, 'PAGOS');
    case 'CANASTILLOS': return reporteCanastillos(d, f);
    case 'USUARIOS': case 'CLIENTES': case 'PRODUCTOS': case 'PROVEEDORES': case 'ONUS':
      return reporteListado(tipo, d, f);
    default: return reporteCobranzas(d, f);
  }
}

function pasaFiltros(contraparte: string, forma: string, f: FiltrosReporte): boolean {
  if (f.contraparte && contraparte !== f.contraparte) return false;
  if (f.formaPago && forma !== f.formaPago) return false;
  return true;
}

function reporteCobranzas(d: DatosReporte, f: FiltrosReporte): TablaExportable {
  const hoy = Date.now();
  const filas = ventasDe(d)
    .filter(v => v.saldo > 0.01 && enPeriodo(v.fecha, f, true) && pasaFiltros(v.contraparte, v.formaPago, f))
    .sort((a, b) => a.contraparte.localeCompare(b.contraparte, 'es') || String(a.fecha).localeCompare(String(b.fecha)));

  const dias = (v: Documento) => {
    const t = new Date(v.fecha ?? '').getTime();
    return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((hoy - t) / 86400000));
  };

  const clientes = new Set(filas.map(v => v.contraparte)).size;
  const vencido = suma(filas.filter(v => dias(v) > 30).map(v => v.saldo));

  return {
    titulo: 'Reporte Cobranzas Pendientes',
    subtitulo: [etiquetaPeriodo(f, true)],
    resumen: [
      { etiqueta: 'Clientes con deuda', valor: String(clientes) },
      { etiqueta: 'Saldo mayor a 30 días', valor: moneda(vencido) }
    ],
    columnas: ['Cliente', 'Venta', 'Fecha', 'Días', 'Total', 'Cobrado', 'Saldo', 'Estado'],
    columnasNumericas: [3, 4, 5, 6],
    columnasEnteras: [3],
    filas: filas.map(v => [v.contraparte, v.codigo, dia(v.fecha), dias(v), redondear(v.total), redondear(v.pagado), redondear(v.saldo), estadoTexto(v.estadoPago)]),
    totales: ['TOTAL', '', '', '', suma(filas.map(v => v.total)), suma(filas.map(v => v.pagado)), suma(filas.map(v => v.saldo)), '']
  };
}

function reporteVentas(d: DatosReporte, f: FiltrosReporte): TablaExportable {
  const filas = ventasDe(d)
    .filter(v => enPeriodo(v.fecha, f) && pasaFiltros(v.contraparte, v.formaPago, f))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

  const anuladas = new Set(
    d.movs
      .filter(m => esSalida(m) && !esActivo(m) && m.codigo && enPeriodo(m.fecha, f) && (!f.contraparte || contrapartesDe(m) === f.contraparte))
      .map(m => String(m.codigo))
  ).size;

  return {
    titulo: 'Reporte de Ventas',
    subtitulo: [etiquetaPeriodo(f)],
    resumen: [
      { etiqueta: 'Ventas', valor: String(filas.length) },
      { etiqueta: 'Ventas anuladas (no incluidas)', valor: String(anuladas) }
    ],
    columnas: ['Cliente', 'Fecha', 'Venta', 'Productos', 'Total', 'Cobrado', 'Saldo', 'Estado'],
    columnasNumericas: [4, 5, 6],
    filas: filas.map(v => [
      v.contraparte, dia(v.fecha), v.codigo,
      v.productos.map(p => `${p.cantidad} x ${p.articulo}`).join(', '),
      redondear(v.total), redondear(v.pagado), redondear(v.saldo), estadoTexto(v.estadoPago)
    ]),
    totales: ['TOTAL', '', '', '', suma(filas.map(v => v.total)), suma(filas.map(v => v.pagado)), suma(filas.map(v => v.saldo)), '']
  };
}

function reporteIngresos(d: DatosReporte, f: FiltrosReporte): TablaExportable {
  const ventas = ventasDe(d);
  const nombreVenta = new Map(ventas.map(v => [v.codigo, v.contraparte]));
  const conCobros = new Set(d.cobros.filter(esRegistroActivo).map(c => String(c.codigoVenta).trim()));

  const ingresos: { fecha?: string; cliente: string; codigo: string; forma: string; tipo: string; monto: number }[] = [];

  d.cobros.filter(esRegistroActivo).forEach(c =>
    ingresos.push({
      fecha: c.fecha,
      cliente: c.clienteNombre ?? nombreVenta.get(String(c.codigoVenta).trim()) ?? 'Sin registrar',
      codigo: c.codigoVenta,
      forma: c.formaPago,
      tipo: 'Cobro',
      monto: Number(c.monto) || 0
    })
  );

  // Ventas al contado: están pagadas pero no tienen registros de cobro.
  ventas
    .filter(v => v.pagado > 0 && !conCobros.has(v.codigo))
    .forEach(v =>
      ingresos.push({ fecha: v.fecha, cliente: v.contraparte, codigo: v.codigo, forma: v.formaPago, tipo: 'Contado', monto: v.pagado })
    );

  const filas = ingresos
    .filter(i => enPeriodo(i.fecha, f) && pasaFiltros(i.cliente, i.forma, f))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

  const porForma = new Map<string, number>();
  filas.forEach(i => porForma.set(i.forma, (porForma.get(i.forma) ?? 0) + i.monto));

  return {
    titulo: 'Reporte de Ingresos',
    subtitulo: [etiquetaPeriodo(f)],
    resumen: Array.from(porForma.entries()).map(([forma, total]) => ({ etiqueta: forma, valor: moneda(total) })),
    columnas: ['Fecha', 'Cliente', 'Venta', 'Forma de pago', 'Tipo', 'Monto'],
    columnasNumericas: [5],
    filas: filas.map(i => [dia(i.fecha), i.cliente, i.codigo, i.forma, i.tipo, redondear(i.monto)]),
    totales: ['TOTAL', '', '', '', '', suma(filas.map(i => i.monto))]
  };
}

function reporteRegistros(d: DatosReporte, f: FiltrosReporte, modo: 'COBROS' | 'PAGOS'): TablaExportable {
  const esCobro = modo === 'COBROS';
  const nombres = new Map((esCobro ? ventasDe(d) : comprasDe(d)).map(x => [x.codigo, x.contraparte]));

  const registros = (esCobro ? d.cobros : d.pagos).map((r: any) => {
    const codigo = String(esCobro ? r.codigoVenta : r.codigoCompra).trim();
    return {
      fecha: r.fecha as string | undefined,
      nombre: (esCobro ? r.clienteNombre : r.proveedorNombre) ?? nombres.get(codigo) ?? 'Sin registrar',
      codigo,
      forma: r.formaPago as string,
      activo: esRegistroActivo(r),
      obs: (r.observaciones as string) ?? '',
      monto: Number(r.monto) || 0
    };
  });

  const filas = registros
    .filter(r => enPeriodo(r.fecha, f) && pasaFiltros(r.nombre, r.forma, f))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

  const activos = filas.filter(r => r.activo);

  return {
    titulo: esCobro ? 'Reporte de Cobros' : 'Reporte de Pagos',
    subtitulo: [etiquetaPeriodo(f)],
    resumen: [
      { etiqueta: esCobro ? 'Cobros vigentes' : 'Pagos vigentes', valor: String(activos.length) },
      { etiqueta: 'Anulados (no suman)', valor: String(filas.length - activos.length) }
    ],
    columnas: ['Fecha', esCobro ? 'Cliente' : 'Proveedor', esCobro ? 'Venta' : 'Compra', 'Forma de pago', 'Estado', 'Observaciones', 'Monto'],
    columnasNumericas: [6],
    filas: filas.map(r => [dia(r.fecha), r.nombre, r.codigo, r.forma, r.activo ? 'Vigente' : 'Anulado', r.obs, redondear(r.monto)]),
    totales: ['TOTAL VIGENTE', '', '', '', '', '', suma(activos.map(r => r.monto))]
  };
}

function reporteCanastillos(d: DatosReporte, f: FiltrosReporte): TablaExportable {
  const palabra = (f.palabra || 'canast').trim().toLowerCase();
  const estadoVenta = new Map(ventasDe(d).map(v => [v.codigo, v.estadoPago]));

  const lineas = d.movs
    .filter(m => esSalida(m) && esActivo(m) && m.codigo && enPeriodo(m.fecha, f))
    .filter(m => {
      const texto = `${nombreCategoria(m)} ${m.product?.articulo ?? m.producto?.articulo ?? ''}`.toLowerCase();
      return texto.includes(palabra);
    })
    .filter(m => pasaFiltros(contrapartesDe(m), m.formaPago ?? '', f))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

  const compras = new Map<string, Set<string>>();
  lineas.forEach(m => {
    const c = contrapartesDe(m);
    compras.set(c, (compras.get(c) ?? new Set()).add(String(m.codigo)));
  });
  const fieles = Array.from(compras.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 5)
    .map(([nombre, set]) => `${nombre} (${set.size})`)
    .join(', ');

  const subtotales = lineas.map(subtotalLinea);

  return {
    titulo: 'Reporte de Canastillos',
    subtitulo: [etiquetaPeriodo(f)],
    resumen: [
      { etiqueta: 'Unidades', valor: String(lineas.reduce((s, m) => s + Number(m.cantidad ?? 0), 0)) },
      { etiqueta: 'Clientes', valor: String(compras.size) },
      { etiqueta: 'Más fieles (compras)', valor: fieles || '—' }
    ],
    columnas: ['Fecha', 'Cliente', 'Venta', 'Canastillo', 'Cant.', 'P. unit.', 'Subtotal', 'Estado'],
    columnasNumericas: [4, 5, 6],
    columnasEnteras: [4],
    filas: lineas.map((m, i): Celda[] => {
      const cant = Number(m.cantidad ?? 0);
      return [
        dia(m.fecha), contrapartesDe(m), String(m.codigo),
        m.product?.articulo ?? m.producto?.articulo ?? 'Sin nombre',
        cant, redondear(cant > 0 ? subtotales[i] / cant : subtotales[i]), redondear(subtotales[i]),
        estadoTexto(estadoVenta.get(String(m.codigo).trim()) ?? 'PENDIENTE')
      ];
    }),
    totales: ['TOTAL', '', '', '', lineas.reduce((s, m) => s + Number(m.cantidad ?? 0), 0), '', suma(subtotales), '']
  };
}

/* ───────────── listados: usuarios, clientes, productos, proveedores, onus ───────────── */

interface FilaListado {
  /** Valor que usa el filtro principal (rol, estado, categoría). */
  filtro: string;
  /** Texto donde busca la caja de búsqueda. */
  texto: string;
  celdas: Celda[];
}

const txt = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const nombreCompleto = (a?: string, b?: string) => [a, b].filter(Boolean).join(' ').trim();

function listado(tipo: TipoReporte, d: DatosReporte): FilaListado[] {
  const fila = (filtro: unknown, celdas: Celda[]): FilaListado => ({
    filtro: txt(filtro),
    texto: celdas.map(txt).join(' ').toLowerCase(),
    celdas
  });

  switch (tipo) {
    case 'USUARIOS':
      // Nunca se exporta la contraseña.
      return (d.usuarios ?? []).map(u =>
        fila(u.rol?.cargo, [
          nombreCompleto(u.profile?.name, u.profile?.lastName) || 'Sin perfil',
          txt(u.email), txt(u.profile?.ci), txt(u.profile?.telefono), txt(u.profile?.cargo), txt(u.rol?.cargo)
        ])
      );

    case 'CLIENTES':
      return (d.clientes ?? []).map(c =>
        fila(c.estado ?? 'ACTIVO', [
          nombreCompleto(c.nombre, c.apellido), txt(c.ci), txt(c.telefono), txt(c.zona),
          txt(c.lugarVenta?.nombre), txt(c.direccion), txt(c.estado ?? 'ACTIVO'), dia(c.fechaRegistro)
        ])
      );

    case 'PRODUCTOS': {
      const stock = new Map<number, any>((d.existencias ?? []).map(e => [Number(e.product?.idProducto), e]));
      return (d.productos ?? []).map(p => {
        const e = stock.get(Number(p.idProducto));
        const categoria = typeof p.categoria === 'string' ? p.categoria : p.categoria?.nombre;
        return fila(categoria || 'Sin categoría', [
          txt(p.articulo), txt(categoria || 'Sin categoría'),
          txt(p.unidadMedida?.abreviatura ?? p.unidadMedida?.nombre),
          redondear(Number(p.precio) || 0),
          e ? Number(e.stockACtual) || 0 : '',
          e ? Number(e.stockMinimo) || 0 : '',
          txt(p.codigoBarras)
        ]);
      });
    }

    case 'PROVEEDORES':
      return (d.proveedores ?? []).map(p =>
        fila(p.estado ?? 'ACTIVO', [
          txt(p.empresa), txt(p.contacto), txt(p.email), txt(p.ciNit), txt(p.pais),
          txt(p.direccion), txt(p.estado ?? 'ACTIVO'), dia(p.fechaRegistro)
        ])
      );

    default:
      return (d.onus ?? []).map(o =>
        fila(o.estado, [
          txt(o.marca), txt(o.modelo), txt(o.serial), txt(o.mac), txt(o.contrato),
          nombreCompleto(o.cliente?.nombre, o.cliente?.apellido) || 'Sin asignar',
          txt(o.portador), txt(o.estado)
        ])
      );
  }
}

const COLUMNAS_LISTADO: Record<string, { columnas: string[]; numericas?: number[]; enteras?: number[] }> = {
  USUARIOS: { columnas: ['Nombre', 'Correo', 'CI', 'Teléfono', 'Cargo', 'Rol'] },
  CLIENTES: { columnas: ['Cliente', 'CI', 'Teléfono', 'Zona', 'Lugar de venta', 'Dirección', 'Estado', 'Registro'] },
  PRODUCTOS: { columnas: ['Producto', 'Categoría', 'U. medida', 'Precio', 'Stock', 'Stock mín.', 'Cód. barras'], numericas: [3, 4, 5], enteras: [4, 5] },
  PROVEEDORES: { columnas: ['Empresa', 'Contacto', 'Correo', 'CI/NIT', 'País', 'Dirección', 'Estado', 'Registro'] },
  ONUS: { columnas: ['Marca', 'Modelo', 'Serial', 'MAC', 'Contrato', 'Cliente', 'Portador', 'Estado'] }
};

function reporteListado(tipo: TipoReporte, d: DatosReporte, f: FiltrosReporte): TablaExportable {
  const info = infoDe(tipo);
  const config = COLUMNAS_LISTADO[tipo];
  const palabra = (f.palabra ?? '').trim().toLowerCase();
  // En los listados la caja de búsqueda empieza con el texto de canastillos: se ignora si no se tocó.
  const buscar = palabra === 'canast' ? '' : palabra;

  const filas = listado(tipo, d)
    .filter(r => !f.contraparte || r.filtro === f.contraparte)
    .filter(r => !buscar || r.texto.includes(buscar));

  const resumen = [{ etiqueta: 'Total registros', valor: String(filas.length) }];
  if (tipo === 'PRODUCTOS') {
    const valor = filas.reduce((s, r) => s + (Number(r.celdas[3]) || 0) * (Number(r.celdas[4]) || 0), 0);
    resumen.push({ etiqueta: 'Valor del inventario', valor: moneda(valor) });
  }

  return {
    titulo: info.titulo,
    subtitulo: [f.contraparte ? `${info.etiquetaContraparte}: ${f.contraparte}` : 'LISTADO COMPLETO'],
    resumen,
    columnas: config.columnas,
    columnasNumericas: config.numericas,
    columnasEnteras: config.enteras,
    filas: filas.map(r => r.celdas)
  };
}
