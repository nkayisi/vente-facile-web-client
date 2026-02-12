import { z } from "zod";

// Schéma pour la création d'organisation
export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, "Le nom est requis")
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),
  slug: z
    .string()
    .min(1, "Le slug est requis")
    .regex(/^[a-z0-9-]+$/, "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets")
    .max(50, "Le slug ne peut pas dépasser 50 caractères"),
  business_type: z
    .enum(["boutique", "restaurant", "pharmacie", "supermarche", "autre"])
    .default("boutique"),
  email: z
    .string()
    .email("Email invalide")
    .optional(),
  phone: z
    .string()
    .regex(/^\+243\d{9}$/, "Le numéro doit être au format +243XXXXXXXXX")
    .optional(),
  address: z
    .string()
    .max(255, "L'adresse ne peut pas dépasser 255 caractères")
    .optional(),
  city: z
    .string()
    .max(100, "La ville ne peut pas dépasser 100 caractères")
    .optional(),
  country: z
    .string()
    .max(100, "Le pays ne peut pas dépasser 100 caractères")
    .default("RDC"),
  currency: z
    .enum(["CDF", "USD", "EUR"])
    .default("CDF"),
  timezone: z
    .string()
    .default("Africa/Kinshasa"),
});

// Types TypeScript dérivés
export type CreateOrganizationFormData = z.infer<typeof createOrganizationSchema>;

// Schéma pour l'organisation (réponse API)
export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  business_type: z.string(),
  business_type_display: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  tax_id: z.string().nullable(),
  rccm: z.string().nullable(),
  id_nat: z.string().nullable(),
  currency: z.string(),
  timezone: z.string(),
  is_active: z.boolean(),
  logo: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  members_count: z.number().optional(),
});

export type Organization = z.infer<typeof organizationSchema>;
