/**
 * Types API générés depuis le schéma OpenAPI du backend.
 *
 * Source : ``./schema.d.ts`` (généré par ``openapi-typescript``).
 * Ce fichier expose des alias ergonomiques (``schemas['Product']``,
 * ``operations['products_list']``) pour éviter d'écrire le chemin complet
 * dans chaque caller.
 *
 * Régénérer :
 *
 *   pnpm generate:api-types        # depuis ./Vente Facile API.yaml (commit)
 *   pnpm generate:api-types:live   # depuis http://localhost:8005/api/schema/
 *
 * Migrer un type domaine existant vers ces types générés :
 *
 *   // avant - type redéfini à la main dans actions/products.actions.ts
 *   export interface Product { id: string; name: string; ... }
 *
 *   // après
 *   import type { components } from "@/types/api";
 *   export type Product = components["schemas"]["Product"];
 *
 * Limites :
 * - Le schéma OpenAPI reflète l'état du backend ; un drift est possible si
 *   on oublie de régénérer après un changement d'endpoint. Le script est à
 *   intégrer dans la CI (avant ``type-check``) pour bloquer les drifts.
 */
import type { components as _components, operations as _operations, paths as _paths } from "./schema";

export type components = _components;
export type operations = _operations;
export type paths = _paths;
export type schemas = _components["schemas"];
