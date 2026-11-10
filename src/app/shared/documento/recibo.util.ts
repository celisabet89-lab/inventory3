import Swal from 'sweetalert2';
import { LOGO_REPORTE } from '../exportar/logo';

/**
 * Recibo imprimible único para todo el sistema (cobros, pagos, entrega de materiales…).
 * Se abre en una ventana nueva y lanza la impresión. Tamaño carta, color #1B6F6F.
 */

export interface ReciboDato {
  etiqueta: string;
  valor: string | number | null | undefined;
  /** ocupa las dos columnas */
  ancho?: boolean;
}

export interface ReciboTabla {
  titulo: string;
  columnas: { texto: string; num?: boolean }[];
  /** cada celda ya viene como texto plano (aquí se escapa) */
  filas: (string | number | null | undefined)[][];
  vacio?: string;
}

export interface ReciboTotal {
  etiqueta: string;
  valor: string;
  /** línea final destacada */
  destacado?: boolean;
}

export interface ReciboOpciones {
  /** COBRO, PAGO… se muestra grande bajo el logo */
  titulo: string;
  numero: string | number;
  fecha?: string;
  datos: ReciboDato[];
  tablas: ReciboTabla[];
  totales?: ReciboTotal[];
  /** Importe en número para escribirlo con letras (opcional) */
  montoLetras?: number;
  /** Texto de la línea «Son: …» (por defecto bolivianos) */
  moneda?: string;
  observaciones?: string;
  /** Sello diagonal (p. ej. ANULADO, PAGADO) */
  sello?: { texto: string; tipo: 'ok' | 'warn' | 'bad' };
  firmas?: [string, string];
  /** Quién emite el documento */
  emitidoPor?: string;
}

export function escaparHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 1250.5 → «MIL DOSCIENTOS CINCUENTA 50/100 BOLIVIANOS» */
export function montoEnLetras(monto: number, moneda = 'BOLIVIANOS'): string {
  const n = Math.max(0, Math.round((Number(monto) || 0) * 100));
  const entero = Math.floor(n / 100);
  const centavos = String(n % 100).padStart(2, '0');
  return `${numeroALetras(entero)} ${centavos}/100 ${moneda}`;
}

function numeroALetras(n: number): string {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE',
    'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];
  const decenas = ['', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS',
    'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  if (n === 0) return 'CERO';
  if (n === 100) return 'CIEN';

  const hasta999 = (x: number): string => {
    if (x === 100) return 'CIEN';
    let t = '';
    if (x >= 100) { t += centenas[Math.floor(x / 100)] + ' '; x %= 100; }
    if (x <= 20) return (t + unidades[x]).trim();
    const d = Math.floor(x / 10), u = x % 10;
    if (d === 2) return (t + 'VEINTI' + unidades[u]).trim();
    return (t + decenas[d] + (u ? ' Y ' + unidades[u] : '')).trim();
  };

  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : hasta999(millones) + ' MILLONES');
  if (miles) partes.push(miles === 1 ? 'MIL' : hasta999(miles) + ' MIL');
  if (resto) partes.push(hasta999(resto));
  return partes.join(' ');
}

const CSS = `
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #1f2937; margin: 0; padding: 24px; font-size: 13px; background: #fff; }
.recibo { max-width: 760px; margin: 0 auto; position: relative; border: 1px solid #d5e5e5; border-radius: 14px; overflow: hidden; }
.cabecera { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px 24px; background: linear-gradient(135deg, #1b6f6f, #0f4f4f); color: #fff; }
.marca { display: flex; align-items: center; gap: 14px; }
.marca img { height: 46px; width: auto; background: #fff; border-radius: 8px; padding: 4px; }
.marca h1 { margin: 0; font-size: 20px; letter-spacing: .5px; }
.marca p { margin: 2px 0 0; font-size: 12px; opacity: .85; letter-spacing: 1.5px; text-transform: uppercase; }
.numero { text-align: right; }
.numero b { display: block; font-size: 20px; }
.numero small { display: block; font-size: 11px; opacity: .85; }
.cuerpo { padding: 20px 24px 24px; }
.datos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 22px; background: #f0f9f9; border: 1px solid #cfe6e6; border-radius: 10px; padding: 14px 16px; margin-bottom: 6px; }
.datos div span { display: block; font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .4px; }
.datos div b { font-size: 13px; color: #0f4f4f; }
.datos .ancho { grid-column: 1 / -1; }
h2 { font-size: 12px; margin: 20px 0 8px; color: #0f4f4f; text-transform: uppercase; letter-spacing: .6px; display: flex; align-items: center; gap: 8px; }
h2::before { content: ''; width: 4px; height: 14px; border-radius: 3px; background: #1b6f6f; }
table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
th { background: #1b6f6f; color: #fff; text-align: left; padding: 8px 10px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; }
td { padding: 8px 10px; border-bottom: 1px solid #eef0f2; font-size: 12px; }
tbody tr:nth-child(even) td { background: #f8fafa; }
.num, th.num { text-align: right; white-space: nowrap; }
.vacio { text-align: center; color: #9ca3af; font-style: italic; }
.totales { margin: 18px 0 0 auto; width: 300px; }
.totales div { display: flex; justify-content: space-between; padding: 5px 2px; color: #374151; }
.totales .destacado { border-top: 2px solid #1b6f6f; margin-top: 6px; padding-top: 9px; font-weight: 800; font-size: 16px; color: #0f4f4f; }
.letras { margin-top: 14px; padding: 9px 12px; border-left: 4px solid #1b6f6f; background: #f8fafa; font-size: 12px; }
.obs { margin-top: 12px; color: #4b5563; font-size: 12px; }
.firmas { display: flex; justify-content: space-around; margin-top: 64px; gap: 30px; }
.firmas div { flex: 1; border-top: 1px solid #1f2937; padding-top: 6px; text-align: center; font-size: 11px; color: #6b7280; }
.pie { margin-top: 22px; padding-top: 10px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 10.5px; color: #9ca3af; }
.sello { position: absolute; top: 46%; left: 50%; transform: translate(-50%, -50%) rotate(-18deg); font-size: 64px; font-weight: 900; letter-spacing: 6px; border: 7px solid; border-radius: 14px; padding: 4px 26px; opacity: .13; pointer-events: none; }
.sello.ok { color: #047857; } .sello.warn { color: #b45309; } .sello.bad { color: #b91c1c; }
@page { size: letter; margin: 12mm; }
@media print {
  body { padding: 0; }
  .recibo { border: 0; border-radius: 0; }
  .cabecera, th, .datos, .letras { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  tr { page-break-inside: avoid; }
}`;

export function construirReciboHtml(o: ReciboOpciones): string {
  const e = escaparHtml;
  const emitido = o.fecha ?? new Date().toLocaleString('es-BO');

  const datos = o.datos
    .filter(d => d.valor !== undefined && d.valor !== null && d.valor !== '')
    .map(d => `<div class="${d.ancho ? 'ancho' : ''}"><span>${e(d.etiqueta)}</span><b>${e(d.valor)}</b></div>`)
    .join('');

  const tablas = o.tablas.map(t => {
    const filas = t.filas.length
      ? t.filas.map(f => `<tr>${f.map((c, i) => `<td class="${t.columnas[i]?.num ? 'num' : ''}">${e(c)}</td>`).join('')}</tr>`).join('')
      : `<tr><td class="vacio" colspan="${t.columnas.length}">${e(t.vacio ?? 'Sin registros')}</td></tr>`;
    return `<h2>${e(t.titulo)}</h2>
<table><thead><tr>${t.columnas.map(c => `<th class="${c.num ? 'num' : ''}">${e(c.texto)}</th>`).join('')}</tr></thead>
<tbody>${filas}</tbody></table>`;
  }).join('');

  const totales = o.totales?.length
    ? `<section class="totales">${o.totales.map(t => `<div class="${t.destacado ? 'destacado' : ''}"><span>${e(t.etiqueta)}</span><span>${e(t.valor)}</span></div>`).join('')}</section>`
    : '';

  const letras = o.montoLetras !== undefined
    ? `<p class="letras"><b>Son:</b> ${e(montoEnLetras(o.montoLetras, o.moneda))}</p>` : '';
  const obs = o.observaciones ? `<p class="obs"><b>Observaciones:</b> ${e(o.observaciones)}</p>` : '';
  const sello = o.sello ? `<div class="sello ${o.sello.tipo}">${e(o.sello.texto)}</div>` : '';
  const [f1, f2] = o.firmas ?? ['Entregué conforme', 'Recibí conforme'];

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>${e(o.titulo)} ${e(o.numero)}</title>
<style>${CSS}</style></head>
<body>
<div class="recibo">
  ${sello}
  <header class="cabecera">
    <div class="marca"><img src="${LOGO_REPORTE}" alt="SIN LIMITE"><div><h1>SIN LIMITE</h1><p>${e(o.titulo)}</p></div></div>
    <div class="numero"><b>N.º ${e(o.numero)}</b><small>Emitido: ${e(emitido)}</small></div>
  </header>
  <div class="cuerpo">
    <section class="datos">${datos}</section>
    ${tablas}
    ${totales}
    ${letras}
    ${obs}
    <section class="firmas"><div>${e(f1)}</div><div>${e(f2)}</div></section>
    <footer class="pie"><span>Documento generado por el sistema SIN LIMITE</span><span>${o.emitidoPor ? 'Emitido por: ' + e(o.emitidoPor) : ''}</span></footer>
  </div>
</div>
<script>window.onload = function () { window.focus(); setTimeout(function () { window.print(); }, 250); };<\/script>
</body></html>`;
}

export type FormatoRecibo = 'termico' | 'pdf';

const CSS_TICKET = `
@page { size: 80mm auto; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { width: 80mm; font-family: 'Courier New', Consolas, monospace; font-size: 12px; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.ticket { width: 72mm; margin: 0 auto; padding: 4mm 0 6mm; }
.logo { text-align: center; margin-bottom: 2mm; }
.logo img { max-width: 34mm; max-height: 22mm; filter: grayscale(1) contrast(1.6); }
.empresa { text-align: center; }
.empresa h1 { margin: 0; font-size: 20px; letter-spacing: 1px; font-family: Arial, sans-serif; }
.empresa p { margin: 1px 0 0; font-size: 10px; }
.sep { text-align: center; overflow: hidden; white-space: nowrap; margin: 2mm 0; font-size: 12px; }
.titulo { text-align: center; font-weight: 700; font-size: 13px; font-family: Arial, sans-serif; letter-spacing: .5px; }
.linea { display: flex; justify-content: space-between; gap: 6px; padding: 1px 0; }
.linea span { flex-shrink: 0; }
.linea b { text-align: right; word-break: break-word; }
.ancho { padding: 1px 0; }
.ancho span { display: block; }
.ancho b { display: block; }
.seccion { text-align: center; font-weight: 700; font-size: 10px; letter-spacing: 1px; margin: 1mm 0; font-family: Arial, sans-serif; }
.item { margin: 1mm 0 2mm; }
.item .nombre { text-align: center; font-weight: 700; font-family: Arial, sans-serif; word-break: break-word; }
.item .extra { display: flex; justify-content: space-between; gap: 6px; }
.item .extra small { font-size: 11px; }
.total { display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; font-family: Arial, sans-serif; margin: 1mm 0; }
.letras, .obs { font-size: 11px; margin: 1mm 0; word-break: break-word; }
.sello { text-align: center; border: 2px solid #000; font-weight: 700; padding: 1mm; margin: 2mm 4mm; font-family: Arial, sans-serif; letter-spacing: 1px; }
.firmas { margin-top: 10mm; }
.firma { border-top: 1px solid #000; text-align: center; font-size: 10px; padding-top: 1mm; margin: 9mm 6mm 0; }
.pie { text-align: center; font-size: 10px; margin-top: 3mm; }
.pie p { margin: 1px 0; }
`;

/** Ticket de 80 mm para impresoras térmicas (cobros, pagos, entregas…), con el logo de la empresa. */
export function construirTicketHtml(o: ReciboOpciones): string {
  const e = escaparHtml;
  const emitido = o.fecha ?? new Date().toLocaleString('es-BO');
  const SEP_IGUAL = '='.repeat(40);
  const SEP_GUION = '-'.repeat(40);

  const datos = o.datos
    .filter(d => d.valor !== undefined && d.valor !== null && d.valor !== '')
    .map(d => d.ancho
      ? `<div class="ancho"><span>${e(d.etiqueta)}:</span><b>${e(d.valor)}</b></div>`
      : `<div class="linea"><span>${e(d.etiqueta)}:</span><b>${e(d.valor)}</b></div>`)
    .join('');

  const tablas = o.tablas.map(t => {
    const n = t.columnas.length;
    const filas = t.filas.length
      ? t.filas.map(f => {
        if (n <= 2) {
          return `<div class="linea"><span>${e(f[0])}</span><b>${e(f[1] ?? '')}</b></div>`;
        }
        const medios = f.slice(1, n - 1)
          .map((c, k) => `${e(t.columnas[k + 1].texto)} ${e(c)}`).join(' · ');
        return `<div class="item"><div class="nombre">${e(f[0])}</div>
<div class="extra"><small>${medios}</small><b>${e(f[n - 1])}</b></div></div>`;
      }).join('')
      : `<div class="linea"><span>${e(t.vacio ?? 'Sin registros')}</span></div>`;
    return `<div class="sep">${SEP_GUION}</div><div class="seccion">${e(t.titulo.toUpperCase())}</div>${filas}`;
  }).join('');

  const totales = (o.totales ?? []).map(t => t.destacado
    ? `<div class="sep">${SEP_GUION}</div><div class="total"><span>${e(t.etiqueta.toUpperCase())}</span><span>${e(t.valor)}</span></div>`
    : `<div class="linea"><span>${e(t.etiqueta)}:</span><b>${e(t.valor)}</b></div>`).join('');

  const letras = o.montoLetras !== undefined
    ? `<div class="letras"><b>Son:</b> ${e(montoEnLetras(o.montoLetras, o.moneda))}</div>` : '';
  const obs = o.observaciones ? `<div class="sep">${SEP_GUION}</div><div class="obs"><b>Observación:</b><br>${e(o.observaciones)}</div>` : '';
  const sello = o.sello ? `<div class="sello">${e(o.sello.texto)}</div>` : '';
  const firmas = o.firmas ? `<div class="firmas">${o.firmas.map(f => `<div class="firma">${e(f)}</div>`).join('')}</div>` : '';

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(o.titulo)} ${e(o.numero)}</title>
<style>${CSS_TICKET}</style></head>
<body>
<div class="ticket">
  <div class="logo"><img src="${LOGO_REPORTE}" alt="SIN LIMITE"></div>
  <div class="empresa"><h1>SIN LIMITE</h1><p>Sistema de Inventario</p></div>
  <div class="sep">${SEP_IGUAL}</div>
  <div class="titulo">${e(o.titulo.toUpperCase())}</div>
  <div class="sep">${SEP_IGUAL}</div>
  <div class="linea"><span>Nro:</span><b>${e(o.numero)}</b></div>
  <div class="linea"><span>Fecha:</span><b>${e(emitido)}</b></div>
  ${datos}
  ${tablas}
  ${totales}
  ${letras}
  ${obs}
  ${sello}
  ${firmas}
  <div class="sep">${SEP_IGUAL}</div>
  <div class="pie"><p>Gracias por su preferencia</p><p>SIN LIMITE</p>${o.emitidoPor ? `<p>Emitido por: ${e(o.emitidoPor)}</p>` : ''}</div>
</div>
<script>window.onload = function () { window.focus(); setTimeout(function () { window.print(); }, 300); };<\/script>
</body></html>`;
}

/** Pregunta cómo se quiere el documento: ticket para impresora térmica o PDF/carta. */
export async function elegirFormatoRecibo(): Promise<FormatoRecibo | null> {
  const r = await Swal.fire({
    title: 'Imprimir recibo',
    text: '¿En qué formato lo quieres?',
    icon: 'question',
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: '<i class="fa-solid fa-receipt"></i> Ticket térmico (80 mm)',
    denyButtonText: '<i class="fa-solid fa-file-pdf"></i> PDF / carta',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#1b6f6f',
    denyButtonColor: '#4b5563'
  });
  if (r.isConfirmed) return 'termico';
  if (r.isDenied) return 'pdf';
  return null;
}

function abrirVentana(html: string, ancho: number): void {
  const ventana = window.open('', '_blank', `width=${ancho},height=900`);
  if (!ventana) {
    Swal.fire({
      icon: 'warning',
      title: 'Ventana bloqueada',
      text: 'Permite las ventanas emergentes de este sitio para imprimir el recibo.',
      confirmButtonColor: '#1b6f6f'
    });
    return;
  }
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
}

/**
 * Imprime un recibo. Si no se indica el formato, pregunta: «termico» (ticket de 80 mm,
 * para la impresora de facturas) o «pdf» (hoja carta, para guardar como PDF).
 */
export async function imprimirRecibo(o: ReciboOpciones, formato?: FormatoRecibo): Promise<void> {
  const f = formato ?? await elegirFormatoRecibo();
  if (!f) return;
  if (f === 'termico') abrirVentana(construirTicketHtml(o), 380);
  else abrirVentana(construirReciboHtml(o), 900);
}

/** «Nombre Apellido (Cargo)» del usuario que tiene la sesión abierta. */
export function usuarioEmisor(): string {
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? 'null');
    if (!u) return '';
    const nombre = `${u.profile?.name ?? ''} ${u.profile?.lastName ?? ''}`.trim() || u.email || '';
    const cargo = u.rol?.cargo ?? u.profile?.cargo ?? '';
    return cargo ? `${nombre} (${cargo})` : nombre;
  } catch { return ''; }
}
