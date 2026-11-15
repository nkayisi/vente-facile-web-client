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
  estBorneParAuteur,
  LIBELLES_VERROU_PERIMETRE,
  litTousLesEntrepots,
  membreDepuisPermissions,
  verrouEntrepot,
  verrouUtilisateur,
  type MembrePerimetre,
  type MotifVerrouPerimetre,
} from "@vente-facile/core";

import { usePermissions } from "@/components/auth/permissions-provider";

export interface AssignedWarehouse {
  id: string;
  name: string;
  /** Absent : actif. Un entrepôt désactivé reste affecté, pour relire son passé. */
  is_active?: boolean;
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
  /** Le membre tel que le noyau le lit : c'est lui qu'on passe aux règles. */
  membre: MembrePerimetre;
  /** Vide pour un propriétaire : c'est ce qui le rend « partout ». */
  assignedWarehouses: AssignedWarehouse[];
  /** La case « Consulter tous les entrepôts » ou le propriétaire : il LIT partout. */
  readsAll: boolean;
  /** Le filtre « Entrepôt » d'une LECTURE (historique, rapports). */
  warehouseLock: LockReason | null;
  /** Le filtre « Utilisateur » : fermé quand on ne voit que son propre travail. */
  userLock: LockReason | null;
  /** `true` quand l'équipe ne servirait à rien : on n'appelle alors pas le serveur. */
  skipTeam: boolean;
  lockLabel: (reason: LockReason) => string;
  /**
   * Le périmètre EFFECTIF, seul autorisé à partir aux server actions.
   *
   * ┌──────────────────────────────────────────────────────────────────────┐
   * │ UN VERROU NE PART PAS. IL FERME UN CHAMP, IL NE FILTRE PAS.          │
   * │                                                                      │
   * │ Le serveur re-dérive le périmètre à chaque requête, et il le fait     │
   * │ plus largement que nous : les ventes anciennes sans entrepôt restent  │
   * │ visibles (`warehouse_scope_include_null`), et un membre borné par     │
   * │ AUTEUR voit toujours SES lignes, où qu'elles soient.                  │
   * │                                                                      │
   * │ Renvoyer le verrou comme un filtre RESSERRE donc au-delà de la règle : │
   * │ un caissier perdait de son propre tableau de bord les ventes faites   │
   * │ dans un autre dépôt, et tout gérant mono-dépôt perdait l'historique    │
   * │ sans entrepôt. Du chiffre d'affaires qui manque, sans un mot.         │
   * │                                                                      │
   * │ Ne partent donc que les choix DÉLIBÉRÉS. C'est sans risque            │
   * │ d'élargissement : tous les endpoints concernés bornent déjà par le    │
   * │ périmètre de lecture (`WarehouseScopedQuerysetMixin`, les `_scope_*`  │
   * │ des rapports, `borner_ventes` du tableau de bord).                    │
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
// motifs COMMUNS.

export function usePerimeter(): Perimeter {
  const { permissions } = usePermissions();

  return useMemo(() => {
    const membre = membreDepuisPermissions(permissions);
    const assigned: AssignedWarehouse[] = permissions?.assigned_warehouses ?? [];
    const readsAll = litTousLesEntrepots(membre);
    const borneParAuteur = estBorneParAuteur(membre, "lecture");

    // En LECTURE, un membre qui ne lit pas tout lit exactement ses affectés,
    // inactifs compris (on relit leur passé) : leur nombre suffit au verrou.
    const warehouseLock = verrouEntrepot(membre, assigned.length, "lecture");

    return {
      role: membre.role,
      membre,
      assignedWarehouses: assigned,
      readsAll,
      warehouseLock,
      userLock: verrouUtilisateur(membre, "lecture"),
      // L'équipe est fermée à qui ne voit que son propre travail : le serveur
      // la lui rend vide, l'appeler serait une requête de trop.
      skipTeam: borneParAuteur,
      lockLabel: (reason) => LIBELLES_VERROU_PERIMETRE[reason],
      effective: (chosen) => {
        // Un choix hors périmètre est écarté plutôt qu'envoyé : le serveur
        // rendrait 400, et l'écran crierait pour une règle qu'on connaissait.
        // Un VERROU, lui, n'est pas un choix : il ne part pas (voir l'encadré).
        const permis = new Set(assigned.map((w) => w.id));
        const warehouse =
          choixEntrepotRecevable(chosen.warehouse, permis, readsAll) ?? undefined;
        // Borné par auteur : le serveur applique `user = lui` seul, et le champ
        // est fermé. On n'envoie rien.
        const user = borneParAuteur ? undefined : chosen.user || undefined;
        return { warehouse, user };
      },
    };
  }, [permissions]);
}
