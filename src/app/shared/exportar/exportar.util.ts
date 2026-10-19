import { LOGO_REPORTE } from './logo';

export type Celda = string | number | null | undefined;

export interface TablaExportable {
  titulo: string;
  /** Líneas de contexto bajo el título (período, filtros...). */
  subtitulo?: string[];
  /** Resumen clave/valor (KPIs). */
  resumen?: { etiqueta: string; valor: string }[];
  columnas: string[];
  /** Columnas numéricas (se alinean a la derecha). Índices base 0. */
  columnasNumericas?: number[];
  /** Columnas numéricas que se muestran sin decimales (cantidades, días). */
  columnasEnteras?: number[];
  filas: Celda[][];
  totales?: Celda[];
}

/* ───────────── Excel (.xlsx) ───────────── */

const encoder = new TextEncoder();

function crc32(datos: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < datos.length; i++) {
    crc ^= datos[i];
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff];
}
function u32(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

function zip(archivos: { nombre: string; contenido: string }[]): Uint8Array {
  const partes: number[][] = [];
  const central: number[][] = [];
  let offset = 0;

  for (const a of archivos) {
    const nombre = Array.from(encoder.encode(a.nombre));
    const datos = encoder.encode(a.contenido);
    const crc = crc32(datos);

    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(datos.length), ...u32(datos.length),
      ...u16(nombre.length), ...u16(0), ...nombre
    ];
    partes.push(local, Array.from(datos));

    central.push([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(datos.length), ...u32(datos.length),
      ...u16(nombre.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
      ...u32(offset), ...nombre
    ]);
    offset += local.length + datos.length;
  }

  const tamCentral = central.reduce((s, c) => s + c.length, 0);
  const fin = [
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(archivos.length), ...u16(archivos.length),
    ...u32(tamCentral), ...u32(offset), ...u16(0)
  ];

  const todo = [...partes, ...central, fin];
  const total = todo.reduce((s, p) => s + p.length, 0);
  const salida = new Uint8Array(total);
  let pos = 0;
  for (const p of todo) {
    salida.set(p, pos);
    pos += p.length;
  }
  return salida;
}

const xml = (v: unknown): string =>
  String(v ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function letraColumna(indice: number): string {
  let n = indice + 1;
  let letra = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}

/** estilo: 0 normal, 1 título, 2 cabecera, 3 número, 4 negrita, 5 número en negrita */
function celdaXml(col: number, fila: number, valor: Celda, estilo: number): string {
  const ref = `${letraColumna(col)}${fila}`;
  if (valor === null || valor === undefined || valor === '') {
    return `<c r="${ref}" s="${estilo}"/>`;
  }
  if (typeof valor === 'string' && valor.startsWith('__IMAGEN_PRODUCTO__:')) {
    const tieneImagen = valor.substring('__IMAGEN_PRODUCTO__:'.length).length > 0;
    return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t>${tieneImagen ? 'Con foto' : 'Sin foto'}</t></is></c>`;
  }
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    const s = estilo === 4 ? 5 : estilo === 0 ? 3 : estilo;
    return `<c r="${ref}" s="${s}"><v>${valor}</v></c>`;
  }
  return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${xml(valor)}</t></is></c>`;
}

export function exportarExcel(tabla: TablaExportable, nombreArchivo: string): void {
  const filasXml: string[] = [];
  let r = 1;

  const agregar = (celdas: { v: Celda; s: number }[]) => {
    filasXml.push(
      `<row r="${r}">${celdas.map((c, i) => celdaXml(i, r, c.v, c.s)).join('')}</row>`
    );
    r++;
  };

  agregar([{ v: tabla.titulo, s: 1 }]);
  (tabla.subtitulo ?? []).forEach(l => agregar([{ v: l, s: 0 }]));
  (tabla.resumen ?? []).forEach(k => agregar([{ v: k.etiqueta, s: 4 }, { v: k.valor, s: 0 }]));
  if (tabla.subtitulo?.length || tabla.resumen?.length) agregar([]);

  agregar(tabla.columnas.map(c => ({ v: c, s: 2 })));
  tabla.filas.forEach(f => agregar(f.map(v => ({ v, s: 0 }))));
  if (tabla.totales) agregar(tabla.totales.map(v => ({ v, s: 4 })));

  const anchos = tabla.columnas
    .map((_, i) => {
      const largo = Math.max(
        String(tabla.columnas[i]).length,
        ...tabla.filas.map(f => String(f[i] ?? '').length)
      );
      return `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(11, largo + 2))}" customWidth="1"/>`;
    })
    .join('');

  const hoja = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${anchos}</cols><sheetData>${filasXml.join('')}</sheetData></worksheet>`;

  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF009688"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const bytes = zip([
    {
      nombre: '[Content_Types].xml',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
    },
    {
      nombre: '_rels/.rels',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    },
    {
      nombre: 'xl/workbook.xml',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(tabla.titulo.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Reporte')}" sheetId="1" r:id="rId1"/></sheets></workbook>`
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
    },
    { nombre: 'xl/styles.xml', contenido: estilos },
    { nombre: 'xl/worksheets/sheet1.xml', contenido: hoja }
  ]);

  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  descargar(blob, `${nombreArchivo}.xlsx`);
}

function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ───────────── PDF (vista imprimible) ───────────── */

const html = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatoNumero = (v: Celda, entero = false): string =>
  typeof v === 'number'
    ? new Intl.NumberFormat('es-BO', entero ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
    : html(v);

/**
 * Reporte con el formato de SIN LIMITE: logo a la izquierda, título y período
 * centrados, fecha a la derecha, línea naranja, cabecera gris y filas alternadas.
 * Devuelve false si el navegador bloqueó la ventana emergente.
 */
export function exportarPdf(tabla: TablaExportable): boolean {
  const numericas = new Set(tabla.columnasNumericas ?? []);
  const enteras = new Set(tabla.columnasEnteras ?? []);
  const alinear = (i: number) => (numericas.has(i) ? ' class="num"' : '');

  const cabecera = tabla.columnas.map((c, i) => `<th${alinear(i)}>${html(c)}</th>`).join('');
  const cuerpo = tabla.filas
    .map(f => `<tr>${f.map((v, i) => {
      const valor = String(v ?? '');
      if (valor.startsWith('__IMAGEN_PRODUCTO__:')) {
        const src = valor.substring('__IMAGEN_PRODUCTO__:'.length);
        return `<td class="celda-imagen">${src
          ? `<img src="${html(src)}" alt="Imagen del producto">`
          : '<span class="sin-imagen">Sin foto</span>'
        }</td>`;
      }
      return `<td${alinear(i)}>${formatoNumero(v, enteras.has(i))}</td>`;
    }).join('')}</tr>`)
    .join('');
  const pie = tabla.totales
    ? `<tfoot><tr>${tabla.totales.map((v, i) => `<td${alinear(i)}>${formatoNumero(v, enteras.has(i))}</td>`).join('')}</tr></tfoot>`
    : '';
  const resumen = (tabla.resumen ?? [])
    .map(k => `<span><b>${html(k.etiqueta)}:</b> ${html(k.valor)}</span>`)
    .join('');
  const sub = (tabla.subtitulo ?? []).map(l => `<h2>${html(l)}</h2>`).join('');
  const hoy = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());

  const doc = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>${html(tabla.titulo)}</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;padding:22px;font-size:12px}
  header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #f08a24;padding-bottom:10px;margin-bottom:14px}
  header img{height:70px;width:auto;display:block}
  .centro{flex:1;text-align:center;padding:0 12px}
  h1{margin:0 0 6px;font-size:20px;font-weight:700;text-transform:uppercase}
  h2{margin:0;font-size:17px;font-weight:700;text-transform:uppercase}
  .fecha{font-size:17px;font-weight:700;min-width:110px;text-align:right}
  table{width:100%;border-collapse:collapse;border:1px solid #444}
  th{background:#c9c9c9;color:#000;text-align:center;padding:6px 6px;font-size:11px;border:1px solid #444}
  td{padding:4px 6px;font-size:10.5px;border:1px solid #444;vertical-align:middle}
  tbody tr:nth-child(even) td{background:#d9d9d9}
  tr{page-break-inside:avoid} thead{display:table-header-group}
  .num{text-align:right;white-space:nowrap} tfoot td{font-weight:700;background:#c9c9c9}
  .celda-imagen{text-align:center;width:70px;min-width:70px}
  .celda-imagen img{width:52px;height:52px;object-fit:contain;display:block;margin:0 auto}
  .sin-imagen{color:#777;font-size:9px}
  .resumen{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px 22px;font-size:11px}
  footer{margin-top:10px;color:#666;font-size:9px;text-align:right}
  @page{size:A4 portrait;margin:10mm} @media print{body{padding:0}}
</style></head><body>
<header>
  <img src="${LOGO_REPORTE}" alt="Sin Limite">
  <div class="centro"><h1>${html(tabla.titulo)}</h1>${sub}</div>
  <div class="fecha">${html(hoy)}</div>
</header>
<table><thead><tr>${cabecera}</tr></thead><tbody>${cuerpo || `<tr><td colspan="${tabla.columnas.length}" style="text-align:center">Sin datos para el período seleccionado</td></tr>`}</tbody>${pie}</table>
${resumen ? `<div class="resumen">${resumen}</div>` : ''}
<footer>${tabla.filas.length} registro(s)</footer>
<script>window.onload=function(){window.focus();window.print();};</script>
</body></html>`;

  const ventana = window.open('', '_blank', 'width=1000,height=800');
  if (!ventana) return false;
  ventana.document.open();
  ventana.document.write(doc);
  ventana.document.close();
  return true;
}
