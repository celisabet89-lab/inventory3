export type Rol = 'ADMIN' | 'ENCARGADO' | 'TECNICO' | 'OTRO';

export function rolDeCargo(cargo: string | null | undefined): Rol {
  const c = (cargo ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (c.includes('admin')) return 'ADMIN';
  if (c.includes('encargad')) return 'ENCARGADO';
  if (c.includes('tecnic')) return 'TECNICO';
  return 'OTRO';
}

/** Rutas permitidas al técnico (prefijos). */
const RUTAS_TECNICO = [
  '/dashboard',
  '/productos/lista',
  '/products',            // lista (las rutas new/edit se bloquean abajo)
  '/movimientos/stock',
  '/movimientos/existing',
  '/onus/clientes',
  '/onus/recojo',
  '/onus/mantenimiento',
  '/materiales'           // solo sus propios materiales
];

const BLOQUEADAS_TECNICO = ['/products/new', '/products/edit'];
const BLOQUEADAS_OTRO = ['/products/new', '/products/edit'];

/** Rutas exclusivas del administrador. */
const SOLO_ADMIN = ['/usuarios', '/users'];

export function puedeAcceder(rol: Rol, url: string): boolean {
  const ruta = '/' + (url.split('?')[0].split('#')[0]).replace(/^\/+/, '').replace(/\/+$/, '');
  const empieza = (bases: string[]) => bases.some(b => ruta === b || ruta.startsWith(b + '/'));

  if (rol === 'ADMIN') return true;
  if (ruta === '/' || ruta === '') return true;
  if (rol === 'ENCARGADO') return !empieza(SOLO_ADMIN);
  if (rol === 'TECNICO') return !empieza(BLOQUEADAS_TECNICO) && empieza(RUTAS_TECNICO);
  return !empieza(BLOQUEADAS_OTRO) && empieza(RUTAS_OTRO);
}

/** Rutas de los demás cargos: solo consulta de productos. */
const RUTAS_OTRO = ['/products', '/productos/lista'];

/** Pantalla a la que se envía al usuario al entrar o al intentar abrir algo prohibido. */
export function rutaInicial(rol: Rol): string {
  return rol === 'OTRO' ? '/productos/lista' : '/dashboard';
}

/** Solo administrador y encargado pueden crear, editar o eliminar. */
export function puedeEditar(rol: Rol): boolean {
  return rol === 'ADMIN' || rol === 'ENCARGADO';
}
