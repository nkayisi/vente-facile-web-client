import { z } from "zod";

// Schéma pour la connexion
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "L'email est requis")
    .email("Email invalide"),
  password: z
    .string()
    .min(1, "Le mot de passe est requis")
    .min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

// Schéma pour l'inscription
export const registerSchema = z.object({
  email: z
    .string()
    .min(1, "L'email est requis")
    .email("Email invalide"),
  password: z
    .string()
    .min(1, "Le mot de passe est requis")
    .min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  confirmPassword: z
    .string()
    .min(1, "La confirmation du mot de passe est requise"),
  firstName: z
    .string()
    .min(1, "Le prénom est requis")
    .min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z
    .string()
    .min(1, "Le nom est requis")
    .min(2, "Le nom doit contenir au moins 2 caractères"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

// Types TypeScript dérivés des schémas
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;

// Schéma pour la réponse JWT
export const jwtResponseSchema = z.object({
  access: z.string(),
  refresh: z.string(),
});

export type JWTResponse = z.infer<typeof jwtResponseSchema>;
