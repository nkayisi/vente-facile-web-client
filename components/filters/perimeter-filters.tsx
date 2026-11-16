"use client";

/**
 * Les deux filtres de périmètre, partagés par toutes les pages du back-office.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN CHAMP QU'ON NE PEUT PAS CHANGER N'EST PAS MONTRÉ.                    │
 * │                                                                          │
 * │ Décisions du marchand (2026-11-15 et 16) : le champ « Entrepôt »         │
 * │ n'apparaît qu'au propriétaire, à la case « Consulter tous les           │
 * │ entrepôts » et au membre de PLUSIEURS entrepôts (limité aux siens) ; le  │
 * │ champ « Utilisateur » qu'à qui voit le travail de ses collègues (« Voir  │
 * │ tout dans son entrepôt », le rôle de gérant ou de magasinier, ou la      │
 * │ même case). Sans aucune des deux options, le composant ne rend RIEN.    │
 * │                                                                          │
 * │ LE CHAMP VIDE NOMME LE DÉFAUT : « Mes entrepôts », « Moi uniquement ».   │
 * │ Élargir est un CHOIX (« Tous les entrepôts », « Tous les utilisateurs »),│
 * │ jamais ce qu'on voit sans rien toucher.                                  │
 * │                                                                          │
 * │ ⚠ Masquer n'est pas lever : le serveur borne toujours au périmètre.     │
 * │ La règle vit dans le noyau (`afficheFiltreEntrepot`,                     │
 * │ `afficheFiltreUtilisateur`), partagée avec le terminal.                  │
 * │                                                                          │
 * │ `withUser={false}` parle de la DONNÉE : un niveau de stock n'a jamais eu │
 * │ d'auteur, pour personne ; le champ est retiré quel que soit le membre.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LE FILTRE « ENTREPÔT » EST UNE LECTURE : il propose tout ce que
 * `/warehouses/` rend, déjà borné au périmètre de lecture par le serveur
 * (`WarehouseScopedQuerysetMixin`), inactifs compris avec leur badge. Le
 * re-filtrer ici sur des droits lus il y a une minute cacherait l'entrepôt
 * qu'on vient d'affecter.
 */
import { useSession } from "next-auth/react";
import {
  CHOIX_TOUS,
  LIBELLE_TOUS_ENTREPOTS,
  LIBELLE_TOUS_UTILISATEURS,
} from "@vente-facile/core";

import { useOrganization } from "@/components/auth/organization-checker";
import { chargeDuJeton } from "@/lib/auth/charge-du-jeton";
import { SearchableSelectAsyncWithEmpty } from "@/components/ui/searchable-select-async-empty";
import { usePerimeter } from "@/hooks/use-perimeter";
import {
  createMemberSearchHandler,
  createWarehouseSearchHandler,
  type SearchHandler,
} from "@/lib/select-search-handlers";

/**
 * Le choix explicite « Tous », en tête de la liste. Il se filtre par la
 * recherche comme les autres : taper « bout » ne doit pas le garder.
 */
function avecTous(base: SearchHandler, propose: boolean, libelle: string): SearchHandler {
  if (!propose) return base;
  return async (query: string) => {
    const terme = query.trim().toLowerCase();
    const tous =
      !terme || libelle.toLowerCase().includes(terme)
        ? [{ value: CHOIX_TOUS, label: libelle }]
        : [];
    return [...tous, ...(await base(query))];
  };
}

export interface PerimeterValue {
  warehouse: string | null;
  user: string | null;
}

export function PerimeterFilters({
  value,
  onChange,
  withUser = true,
  withWarehouse = true,
  className,
}: {
  value: PerimeterValue;
  onChange: (v: PerimeterValue) => void;
  /**
   * Faux là où la donnée n'a pas d'auteur : stock, inventaire, transferts,
   * ajustements. Le champ est alors RETIRÉ (voir l'encadré ci-dessus).
   */
  withUser?: boolean;
  /**
   * Faux pour les DEVIS, qui ne portent aucun entrepôt - ni au serveur, ni en
   * base locale. Le proposer donnerait un filtre INERTE : le marchand
   * choisirait « Dépôt B », rien ne changerait, et rien ne l'expliquerait.
   */
  withWarehouse?: boolean;
  className?: string;
}) {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const perimetre = usePerimeter();

  const pret = Boolean(session?.accessToken && organization?.id);
  const token = session?.accessToken ?? "";
  const idDuJeton = chargeDuJeton(session?.accessToken)?.user_id;
  const moi = typeof idDuJeton === "string" ? idDuJeton : undefined;
  const orgId = organization?.id ?? "";

  const champEntrepot = withWarehouse && perimetre.showWarehouse;
  const champUtilisateur = withUser && perimetre.showUser;
  // Rien à régler : le composant ne rend rien, pas même son conteneur.
  if (!champEntrepot && !champUtilisateur) return null;

  return (
    <div className={className ?? "flex flex-wrap items-center gap-3"}>
      {champEntrepot ? (
        <div className="flex flex-col gap-1">
        <SearchableSelectAsyncWithEmpty
          value={value.warehouse}
          // ⚠ CHANGER D'ENTREPÔT REMET L'UTILISATEUR À ZÉRO.
          //
          // Le membre choisi appartenait au dépôt précédent : le garder ferait
          // partir au serveur un couple qu'il refuse (400), sur un nom que
          // l'écran continue d'afficher. On ne garde pas une sélection que le
          // nouveau périmètre ne propose plus.
          onValueChange={(v) => onChange({ warehouse: v ?? null, user: null })}
          onSearch={
            pret
              ? avecTous(
                  createWarehouseSearchHandler(token, orgId, "lecture", {
                    membre: perimetre.membre,
                  }),
                  perimetre.offersAllWarehouses,
                  LIBELLE_TOUS_ENTREPOTS,
                )
              : async () => []
          }
          emptyLabel={perimetre.defaultWarehouseLabel}
          placeholder="Entrepôt"
          searchPlaceholder="Rechercher un entrepôt..."
          className="max-w-max"
          disabled={!pret}
        />
        </div>
      ) : null}

      {champUtilisateur ? (
        <div className="flex flex-col gap-1">
        <SearchableSelectAsyncWithEmpty
          value={value.user}
          onValueChange={(v) => onChange({ ...value, user: v ?? null })}
          onSearch={
            // ⚠ On n'appelle PAS l'équipe quand elle ne servirait à rien : un
            // caissier reçoit un roster fermé, et une requête par page pour un
            // résultat inemployé est une requête de trop.
            pret && !perimetre.skipTeam
              ? avecTous(
                  createMemberSearchHandler(token, orgId, {
                    // Les membres suivent l'entrepôt RETENU : un dépôt choisi,
                    // sinon « Tous les entrepôts » (aucune borne), sinon le
                    // défaut (ses entrepôts, pour la case « Consulter tous »).
                    warehouses:
                      value.warehouse === CHOIX_TOUS
                        ? undefined
                        : value.warehouse
                          ? [value.warehouse]
                          : (perimetre.defaultWarehouses ?? undefined),
                    // Soi-même : « Moi uniquement » le dit déjà. L'identifiant se lit
                    // dans le jeton d'accès (`user_id`) : `session.user.id` n'est
                    // pas porté par la session NextAuth.
                    exclude: perimetre.defaultIsSelf ? moi : undefined,
                  }),
                  perimetre.offersAllUsers,
                  LIBELLE_TOUS_UTILISATEURS,
                )
              : async () => []
          }
          // La liste des membres DÉPEND de l'entrepôt : sans cette clé, elle
          // resterait celle du dépôt précédent. Voir `SearchableSelectAsync`.
          resetKey={value.warehouse ?? ""}
          emptyLabel={perimetre.defaultUserLabel}
          placeholder="Utilisateur"
          searchPlaceholder="Rechercher un utilisateur..."
          className="max-w-max"
          disabled={!pret}
        />
        </div>
      ) : null}
    </div>
  );
}
