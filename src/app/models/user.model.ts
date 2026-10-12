export interface Rol {
  id?: number;
  nombre?: string;
  cargo?: string;
}

export interface User {
  idUsuario: number | undefined;
  idUser: number | undefined;
  userId: number | undefined;
  activo?: boolean;
  email: string;

  name?: string;
  lastName?: string;

  telefono?: number;
  ci?: number;

  fechaCreacion?: Date;
  id?: number;

  password?: string;

  profile?: Profile;
  rol?: Rol;

  ultimoAcceso?: Date;
}

export interface Profile {
  id?: number;
  name?: string;
  lastName?: string;
  cargo?: string;
}
