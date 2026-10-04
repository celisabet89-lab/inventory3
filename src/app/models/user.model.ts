export type Rol = 'admin' | 'supervisor' | 'operador';

export interface User {
  activo: boolean;
  email: string;
  name: string;
  export: any;
  fechaCreacion?: Date;
  id?: number;
  interface: any;
  password?: string;

  // @ts-ignore
  profile?: Profile
  rol?: Rol
  ultimoAcceso?: Date
}

export class Profile {
    name: any;
  lastName: any;
  cargo: any;
}
