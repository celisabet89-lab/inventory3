export const ONU_ESTADOS = [
  { value: 'Disponible', label: 'Disponible', color: 'success' },
  { value: 'Asignada', label: 'Asignada', color: 'info' },
  { value: 'En Reparación', label: 'En Reparación', color: 'warning' }
] as const;

export const MOVEMENT_TIPOS = [
  { value: 'ENTRADA', label: 'Entrada', icon: 'fa-arrow-down', color: 'success' },
  { value: 'SALIDA', label: 'Salida', icon: 'fa-arrow-up', color: 'danger' }
] as const;

export const ALERT_ESTADOS = [
  { value: 'PENDIENTE', label: 'Pendiente', color: 'warning' },
  { value: 'GESTIONADA', label: 'Gestionada', color: 'success' }
] as const;

export const CATEGORIAS_PRODUCTOS = [
  'Fibra Óptica',
  'Conectores',
  'Accesorios',
  'ONUs',
  'Herramientas',
  'Equipos',
  'Otros'
] as const;

export const ROLES = [
  { id: 1, cargo: 'Administrador' },
  { id: 2, cargo: 'Técnico' },
  { id: 3, cargo: 'Almacenero' }
] as const;
