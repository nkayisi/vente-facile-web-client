"use client";

/**
 * Les deux filtres de périmètre, partagés par toutes les pages du back-office.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN CHAMP QU'ON NE PEUT PAS CHANGER N'EST PAS MONTRÉ.                    │
 * │                                                                          │
 * │ Décision du marchand (2026-11-15) : le champ « Entrepôt » n'apparaît     │
 * │ qu'au propriétaire et au membre à qui l'on a coché « Consulter tous les  │
 * │ entrepôts » ; le champ « Utilisateur » qu'à qui voit le travail de ses   │
 * │ collègues (« Voir tout dans son entrepôt », le rôle de gérant ou de      │
 * │ magasinier, ou la même case). Sans aucune des deux options, le composant │
 * │ ne rend RIEN. Les anciens champs fermés « avec leur motif » occupaient   │
 * │ la barre pour dire une chose que le membre n'a pas à décider.            │
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

import { useOrganization } from "@/components/auth/organization-checker";
import { SearchableSelectAsyncWithEmpty } from "@/components/ui/searchable-select-async-empty";
import { usePerimeter } from "@/hooks/use-perimeter";
import {
  createMemberSearchHandler,
  createWarehouseSearchHandler,
} from "@/lib/select-search-handlers";

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
            pret ? createWarehouseSearchHandler(token, orgId, "lecture") : async () => []
          }
          emptyLabel="Tous les entrepôts"
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
              ? createMemberSearchHandler(token, orgId, {
                  warehouse: value.warehouse ?? undefined,
                })
              : async () => []
          }
          // La liste des membres DÉPEND de l'entrepôt : sans cette clé, elle
          // resterait celle du dépôt précédent. Voir `SearchableSelectAsync`.
          resetKey={value.warehouse ?? ""}
          emptyLabel="Tous les utilisateurs"
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
