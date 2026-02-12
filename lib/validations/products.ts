import { z } from "zod";

// Schéma pour la création de produit
export const createProductSchema = z.object({
  name: z
    .string()
    .min(1, "Le nom est requis")
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(200, "Le nom ne peut pas dépasser 200 caractères"),
  slug: z
    .string()
    .min(1, "Le slug est requis")
    .regex(/^[a-z0-9-]+$/, "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets")
    .max(100, "Le slug ne peut pas dépasser 100 caractères"),
  sku: z
    .string()
    .min(1, "Le SKU est requis")
    .max(50, "Le SKU ne peut pas dépasser 50 caractères"),
  barcode: z
    .string()
    .max(50, "Le code barre ne peut pas dépasser 50 caractères")
    .optional(),
  description: z
    .string()
    .max(1000, "La description ne peut pas dépasser 1000 caractères")
    .optional(),
  short_description: z
    .string()
    .max(500, "La description courte ne peut pas dépasser 500 caractères")
    .optional(),
  product_type: z
    .enum(["physical", "service", "bundle"])
    .default("physical"),
  cost_price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Le prix doit être un nombre valide")
    .transform((val) => parseFloat(val)),
  selling_price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Le prix doit être un nombre valide")
    .transform((val) => parseFloat(val)),
  wholesale_price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Le prix doit être un nombre valide")
    .transform((val) => parseFloat(val))
    .optional(),
  tax_rate: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Le taux de taxe doit être un nombre valide")
    .transform((val) => parseFloat(val))
    .default(0),
  is_taxable: z.boolean().default(true),
  track_inventory: z.boolean().default(true),
  min_stock_level: z.number().int().min(0).default(0),
  max_stock_level: z.number().int().min(0).optional(),
  reorder_point: z.number().int().min(0).default(0),
  reorder_quantity: z.number().int().min(0).default(0),
  allow_negative_stock: z.boolean().default(false),
  batch_tracking: z.boolean().default(false),
  expiry_tracking: z.boolean().default(false),
  serial_tracking: z.boolean().default(false),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  is_purchasable: z.boolean().default(true),
  is_sellable: z.boolean().default(true),
  brand: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().optional(),
  image: z.string().optional(),
  attributes: z.record(z.string(), z.any()).optional(),
  dimensions: z.record(z.string(), z.any()).optional(),
  weight: z.string().optional(),
});

// Types TypeScript dérivés
export type CreateProductFormData = z.infer<typeof createProductSchema>;

// Schéma pour le produit (réponse API)
export const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  sku: z.string(),
  barcode: z.string().nullable(),
  description: z.string().nullable(),
  short_description: z.string().nullable(),
  product_type: z.string(),
  cost_price: z.string(),
  selling_price: z.string(),
  wholesale_price: z.string().nullable(),
  tax_rate: z.string(),
  is_taxable: z.boolean(),
  track_inventory: z.boolean(),
  min_stock_level: z.number(),
  max_stock_level: z.number().nullable(),
  reorder_point: z.number(),
  reorder_quantity: z.number(),
  allow_negative_stock: z.boolean(),
  batch_tracking: z.boolean(),
  expiry_tracking: z.boolean(),
  serial_tracking: z.boolean(),
  is_active: z.boolean(),
  is_featured: z.boolean(),
  is_purchasable: z.boolean(),
  is_sellable: z.boolean(),
  brand: z.any().nullable(),
  category: z.any().nullable(),
  unit: z.any().nullable(),
  image: z.string().nullable(),
  attributes: z.record(z.string(), z.any()),
  dimensions: z.record(z.string(), z.any()),
  weight: z.any().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Product = z.infer<typeof productSchema>;
