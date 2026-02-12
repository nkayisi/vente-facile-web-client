// Types globaux pour l'application

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  dateJoined: string;
  lastLogin: string | null;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface ApiResponse<T = any> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  detail: string;
  code?: string;
  field?: string;
}

// Types pour les formulaires
export interface FormFieldError {
  message: string;
  field?: string;
}

export interface FormState {
  isSubmitting: boolean;
  errors: FormFieldError[];
}

// Types pour les notifications
export type NotificationType = "success" | "error" | "info" | "warning";

export interface NotificationOptions {
  duration?: number;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Types pour l'organisation
export interface OrganizationMembership {
  id: string;
  user: string;
  organization: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

// Types pour le contexte applicatif
export interface AppContextType {
  user: User | null;
  organization: any | null;
  organizations: any[];
  setOrganization: (org: any | null) => void;
  refreshOrganizations: () => Promise<void>;
}

// Import des types des schémas
export type { Organization } from "@/lib/validations/organizations";
export type { Product as ProductType } from "@/lib/validations/products";
export type { JWTResponse, LoginFormData, RegisterFormData } from "@/lib/validations/auth";
export type { CreateOrganizationFormData } from "@/lib/validations/organizations";
export type { CreateProductFormData } from "@/lib/validations/products";
