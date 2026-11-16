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
  afficheFiltreEntrepot,
  afficheFiltreUtilisateur,
  CHOIX_TOUS,
  choixEntrepotRecevable,
  defautDuPerimetre,
  estBorneParAuteur,
  libelleDefautEntrepot,
  libelleDefautUtilisateur,
  litTousLesEntrepots,
  membreDepuisPermissions,
  proposeTousLesEntrepots,
  proposeTousLesUtilisateurs,
  type MembrePerimetre,
} from "@vente-facile/core";

import { usePermissions } from "@/components/auth/permissions-provider";

export interface AssignedWarehouse {
  id: string;
  name: string;
  /** Absent : actif. Un entrepôt désactivé reste affecté, pour relire son passé. */
  is_active?: boolean;
}


export interface Perimeter {
  role: string | null;
  /** Le membre tel que le noyau le lit : c'est lui qu'on passe aux règles. */
  membre: MembrePerimetre;
  /** Vide pour un propriétaire : c'est ce qui le rend « partout ». */
  assignedWarehouses: AssignedWarehouse[];
  /** La case « Consulter tous les entrepôts » ou le propriétaire : il LIT partout. */
  readsAll: boolean;
  /**
   * Le champ « Entrepôt » s'affiche : le propriétaire et la case « Consulter
   * tous les entrepôts » seulement. Pour les autres il n'apparaît pas du tout.
   */
  showWarehouse: boolean;
  /** Le champ « Utilisateur » s'affiche : seulement pour qui voit ses collègues. */
  showUser: boolean;
  /**
   * Ce que le champ annonce quand rien n'est choisi : le DÉFAUT, nommé
   * (« Mes entrepôts », « Moi uniquement »…). Voir `defautDuPerimetre`.
   */
  defaultWarehouseLabel: string;
  defaultUserLabel: string;
  /**
   * Les entrepôts du DÉFAUT quand il est plus étroit que ce qu'on peut lire
   * (la case « Consulter tous » : ses seuls entrepôts), sinon `null`. Les
   * membres proposés au filtre « Utilisateur » s'y bornent tant que l'entrepôt
   * n'est pas élargi : le serveur garde ce défaut, et un collègue d'ailleurs
   * rendrait une liste vide.
   */
  defaultWarehouses: string[] | null;
  /** Le défaut est « Moi uniquement » : se proposer soi-même en serait une redite. */
  defaultIsSelf: boolean;
  /** Le choix explicite « Tous les entrepôts » est proposé (case « Consulter tous »). */
  offersAllWarehouses: boolean;
  /** Le choix explicite « Tous les utilisateurs » est proposé (caissier qui a une case). */
  offersAllUsers: boolean;
  /** `true` quand l'équipe ne servirait à rien : on n'appelle alors pas le serveur. */
  skipTeam: boolean;
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
   * │                                                                      │
   * │ RIEN choisi : rien ne part, et le serveur applique le DÉFAUT du      │
   * │ membre (un caissier ne voit que ses données). « Tous » part en `*`,   │
   * │ que le serveur lit comme `all_warehouses` / `all_users` : c'est le    │
   * │ seul moyen d'élargir au-delà du défaut.                               │
   * └──────────────────────────────────────────────────────────────────────┘
   */
  effective: (chosen: { warehouse?: string; user?: string }) => {
    warehouse?: string;
    user?: string;
  };
}

// ⚠ Plus aucun verrou n'est AFFICHÉ au back-office : un champ qu'on ne peut pas
// changer n'est pas montré (`showWarehouse`, `showUser`, voir
// `PerimeterFilters`). Le périmètre, lui, s'applique toujours au serveur.

export function usePerimeter(): Perimeter {
  const { permissions } = usePermissions();

  return useMemo(() => {
    const membre = membreDepuisPermissions(permissions);
    const assigned: AssignedWarehouse[] = permissions?.assigned_warehouses ?? [];
    const readsAll = litTousLesEntrepots(membre);
    const borneParAuteur = estBorneParAuteur(membre, "lecture");
    const defaut = defautDuPerimetre(membre);

    return {
      role: membre.role,
      membre,
      assignedWarehouses: assigned,
      readsAll,
      showWarehouse: afficheFiltreEntrepot(membre),
      showUser: afficheFiltreUtilisateur(membre),
      defaultWarehouseLabel: libelleDefautEntrepot(membre),
      defaultUserLabel: libelleDefautUtilisateur(membre),
      defaultWarehouses: defaut.entrepots,
      defaultIsSelf: defaut.auteurBorne,
      offersAllWarehouses: proposeTousLesEntrepots(membre),
      offersAllUsers: proposeTousLesUtilisateurs(membre),
      // L'équipe est fermée à qui ne voit que son propre travail : le serveur
      // la lui rend vide, l'appeler serait une requête de trop.
      skipTeam: borneParAuteur,
      effective: (chosen) => {
        // Un choix hors périmètre est écarté plutôt qu'envoyé : le serveur
        // rendrait 400, et l'écran crierait pour une règle qu'on connaissait.
        // Un VERROU, lui, n'est pas un choix : il ne part pas (voir l'encadré).
        const permis = new Set(assigned.map((w) => w.id));
        // « Tous les entrepôts » n'a de sens que sous la case : pour le
        // propriétaire c'est déjà le défaut, et pour les autres un refus.
        const warehouse =
          chosen.warehouse === CHOIX_TOUS && !proposeTousLesEntrepots(membre)
            ? undefined
            : (choixEntrepotRecevable(chosen.warehouse, permis, readsAll) ?? undefined);
        // Borné par auteur : le serveur applique `user = lui` seul, et le champ
        // est fermé. On n'envoie rien. « Tous les utilisateurs » ne part que
        // pour le caissier dont le défaut est « moi » ; pour un gérant c'est
        // déjà le défaut.
        let user: string | undefined;
        if (borneParAuteur) user = undefined;
        else if (chosen.user === CHOIX_TOUS)
          user = proposeTousLesUtilisateurs(membre) ? CHOIX_TOUS : undefined;
        else user = chosen.user || undefined;
        return { warehouse, user };
      },
    };
  }, [permissions]);
}
