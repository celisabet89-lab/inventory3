export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
  timestamp?: Date;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  first: boolean;
  last: boolean;
}

export interface ErrorResponse {
  message: string;
  error?: string;
  status: number;
  timestamp: Date;
  path?: string;
}
