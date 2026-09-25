"use client";

/**
 * Les deux filtres de périmètre, partagés par toutes les pages du back-office.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN VERROU DE DROIT S'AFFICHE FERMÉ ; UNE DONNÉE SANS AUTEUR DISPARAÎT. │
 * │                                                                          │
 * │ `cashier`, `un-seul-entrepot` et `aucun-entrepot` parlent de VOUS : on   │
 * │ vous refuse quelque chose que d'autres ont, et retirer le contrôle se    │
 * │ lirait comme une fonction manquante. Un contrôle fermé QUI DIT POURQUOI  │
 * │ se lit comme une règle.                                                  │
 * │                                                                          │
 * │ `withUser={false}` parle de la DONNÉE : un niveau de stock n'a jamais eu │
 * │ d'auteur, pour personne. Expliquer l'absence d'une chose que nul n'a     │
 * │ demandée est du bruit permanent - on retire le champ, comme le terminal. │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ AUCUN `useWarehouses` : `WarehouseViewSet` porte déjà
 * `WarehouseScopedQuerysetMixin` avec `warehouse_scope_field='id'`, donc
 * `/warehouses/` est DÉJÀ borné par le rôle. Un hook serait un second chemin
 * vers la même liste, donc un second périmètre à tenir en phase.
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

  const userLock = perimetre.isCashier ? "cashier" : null;

  return (
    <div className={className ?? "flex flex-wrap items-center gap-3"}>
      {withWarehouse ? (
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
            pret ? createWarehouseSearchHandler(token, orgId) : async () => []
          }
          emptyLabel="Tous les entrepôts"
          placeholder="Entrepôt"
          searchPlaceholder="Rechercher un entrepôt..."
          className="max-w-max"
          disabled={!pret || Boolean(perimetre.warehouseLock)}
        />
        {perimetre.warehouseLock ? (
          <span className="text-xs text-muted-foreground">
            {perimetre.lockLabel(perimetre.warehouseLock)}
          </span>
        ) : null}
        </div>
      ) : null}

      {withUser ? (
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
          disabled={!pret || Boolean(userLock)}
        />
        {userLock ? (
          <span className="text-xs text-muted-foreground">
            {perimetre.lockLabel(userLock)}
          </span>
        ) : null}
        </div>
      ) : null}
    </div>
  );
}
