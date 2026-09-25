"use client";

/**
 * Le périmètre du demandeur : ce qu'il peut filtrer, et ce qui lui est imposé.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ C'EST LUI QUI ÉVITE UN 403 AU CHARGEMENT DE CHAQUE PAGE.                │
 * │                                                                          │
 * │ `GET /memberships/team/` est ouvert à tout membre, mais un CAISSIER y    │
 * │ reçoit une équipe fermée : son filtre « Utilisateur » est verrouillé sur │
 * │ lui-même, et l'appeler ne servirait à rien. Le savoir AVANT l'appel      │
 * │ évite une requête par page pour un résultat qu'on n'emploiera pas.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LA RÈGLE DE RÔLE VIT DANS `@vente-facile/core`, PLUS ICI. Elle était
 * écrite une seconde fois dans `features/perimetre/filtre-perimetre.ts` du
 * terminal, avec les mêmes motifs et les mêmes libellés au caractère près :
 * deux copies d'une règle de visibilité finissent par diverger sans qu'aucune
 * erreur ne le dise. Ce hook ne garde que ce qui est PROPRE au back-office -
 * le vocabulaire anglais des écrans, `skipTeam`, et le fait de n'envoyer que
 * les choix délibérés (voir l'encadré de `effective`).
 */
import { useMemo } from "react";

import {
  choixEntrepotRecevable,
  LIBELLES_VERROU_PERIMETRE,
  verrouEntrepot,
  type MotifVerrouPerimetre,
} from "@vente-facile/core";

import { usePermissions } from "@/components/auth/permissions-provider";

export interface AssignedWarehouse {
  id: string;
  name: string;
}

/**
 * Pourquoi un filtre est fermé. `null` : il est ouvert.
 *
 * Le nom reste anglais comme le reste du hook ; les VALEURS viennent du paquet,
 * pour qu'un motif ajouté d'un côté ne puisse pas manquer de l'autre.
 */
export type LockReason = MotifVerrouPerimetre;

export interface Perimeter {
  role: string | null;
  /** Vide pour un propriétaire : c'est ce qui le rend « partout ». */
  assignedWarehouses: AssignedWarehouse[];
  /** Le caissier ne voit que ses propres lignes : les deux filtres se ferment. */
  isCashier: boolean;
  warehouseLock: LockReason | null;
  /** `true` quand l'équipe ne servirait à rien : on n'appelle alors pas le serveur. */
  skipTeam: boolean;
  lockLabel: (reason: LockReason) => string;
  /**
   * Le périmètre EFFECTIF, seul autorisé à partir aux server actions.
   *
   * ┌──────────────────────────────────────────────────────────────────────┐
   * │ UN VERROU NE PART PAS. IL FERME UN CHAMP, IL NE FILTRE PAS.          │
   * │                                                                      │
   * │ Le serveur re-dérive le rôle à chaque requête, et il le fait plus     │
   * │ largement que nous : `SaleViewSet` porte                              │
   * │ `warehouse_scope_include_null = True` (les ventes anciennes sans      │
   * │ entrepôt restent visibles), et le périmètre d'un CAISSIER est         │
   * │ `filter(sold_by=user)` - sans la moindre borne d'entrepôt.            │
   * │                                                                      │
   * │ Renvoyer le verrou comme un filtre RESSERRE donc au-delà de la règle : │
   * │ un caissier perdait de son propre tableau de bord les ventes faites   │
   * │ dans un autre dépôt, et tout gérant mono-dépôt perdait l'historique    │
   * │ sans entrepôt. Du chiffre d'affaires qui manque, sans un mot.         │
   * │                                                                      │
   * │ Ne partent donc que les choix DÉLIBÉRÉS. C'est sans risque            │
   * │ d'élargissement : tous les endpoints concernés bornent déjà par rôle   │
   * │ (`warehouse_scope_field`, `WarehouseScopedQuerysetMixin`,             │
   * │ `filter_stock_transfer_queryset`, `restrict_visibility_for_request`,  │
   * │ les `_scope_*` des rapports, `borner_ventes` du tableau de bord).     │
   * └──────────────────────────────────────────────────────────────────────┘
   */
  effective: (chosen: { warehouse?: string; user?: string }) => {
    warehouse?: string;
    user?: string;
  };
}

// ⚠ Pas de motif « sans auteur » ici : une donnée qui n'en a jamais eu RETIRE
// son champ plutôt que de l'expliquer (voir `PerimeterFilters`). Le terminal
// porte ce motif en plus, sur ses propres écrans ; le paquet ne tient que les
// trois motifs COMMUNS.

export function usePerimeter(): Perimeter {
  const { permissions } = usePermissions();

  return useMemo(() => {
    const role = permissions?.role ?? null;
    const assigned: AssignedWarehouse[] = permissions?.assigned_warehouses ?? [];
    const isCashier = role === "cashier";
    const isOwner = role === "owner";

    const warehouseLock = verrouEntrepot(role, assigned.length);

    return {
      role,
      assignedWarehouses: assigned,
      isCashier,
      warehouseLock,
      skipTeam: isCashier,
      lockLabel: (reason) => LIBELLES_VERROU_PERIMETRE[reason],
      effective: (chosen) => {
        if (isCashier) {
          // Ses deux filtres sont fermés, et le serveur les applique seul :
          // `filter(created_by=user)`, sans entrepôt. On n'envoie donc RIEN.
          return {};
        }
        // Un choix hors périmètre est écarté plutôt qu'envoyé : le serveur
        // rendrait 400, et l'écran crierait pour une règle qu'on connaissait.
        // Un VERROU, lui, n'est pas un choix : il ne part pas (voir l'encadré).
        const permis = new Set(assigned.map((w) => w.id));
        const warehouse =
          choixEntrepotRecevable(chosen.warehouse, permis, isOwner) ?? undefined;
        return { warehouse, user: chosen.user || undefined };
      },
    };
  }, [permissions]);
}
