/**
 * Factory de handlers ``onSearch`` pour ``SearchableSelectAsync``.
 *
 * Le pattern : chaque handler reçoit ``(query: string)`` et renvoie une promesse
 * de ``AsyncSelectOption[]``. Il encapsule l'appel à la server action paginée
 * correspondante (avec ``?search=...&page_size=...``) et transforme les objets
 * domaines en options ``{value, label}`` exploitables par le composant.
 *
 * Toutes les recherches frappent l'API : le composant ne se contente pas de
 * filtrer une liste pré-chargée. C'est essentiel pour les référentiels
 * paginés (catégories, marques, clients...) où un marchand peut avoir des
 * centaines d'entrées.
 *
 * Ajout d'une nouvelle entité ? Implémenter un getter `getXxxs(token, orgId, filters)`
 * qui supporte au minimum ``search`` et ``page_size``, puis ajouter un
 * ``createXxxSearchHandler`` ici en réutilisant ``createListSearchHandler``.
 */
import { getBrands, getCategories, getUnits } from "@/actions/products.actions";
import { getTeam } from "@/actions/users.actions";
import type {
  Brand,
  Category,
  Unit,
} from "@/actions/products.actions";
import { getCustomers, getSuppliers } from "@/actions/contacts.actions";
import type { Customer, Supplier } from "@/actions/contacts.actions";
import { getWarehouseDirectory, getWarehouses } from "@/actions/stock.actions";
import { entrepotsLisibles, type MembrePerimetre } from "@vente-facile/core";
import {
  optionsEntrepots,
  type EntrepotProposable,
  type UsageEntrepot,
} from "@/lib/stock/entrepots";
import { getBranches } from "@/actions/organization.actions";
import type { Branch } from "@/actions/organization.actions";
import { getPaymentMethods } from "@/actions/sales.actions";
import type { PaymentMethod } from "@/actions/sales.actions";

import type { AsyncSelectOption } from "@/components/ui/searchable-select-async";

export type SearchHandler = (query: string) => Promise<AsyncSelectOption[]>;

const DEFAULT_PAGE_SIZE = 30;

/**
 * Factory pour les server actions qui renvoient ``PaginatedResponse<T>``
 * (la majorité : Category, Brand, Unit, Customer, Supplier, Warehouse...).
 */
function createListSearchHandler<T, F extends { search?: string; page_size?: number }>(
  fetchFn: (token: string, orgId: string, filters?: F) => Promise<{
    success: boolean;
    data?: { results: T[] } | T[];
  }>,
  formatLabel: (item: T) => string,
  accessToken: string,
  organizationId: string,
  extraFilters?: Partial<F>,
  pageSize: number = DEFAULT_PAGE_SIZE,
): SearchHandler {
  return async (query: string) => {
    const filters = {
      ...(extraFilters || {}),
      search: query,
      page_size: pageSize,
    } as unknown as F;

    const result = await fetchFn(accessToken, organizationId, filters);
    if (!result.success || !result.data) return [];

    const items = Array.isArray(result.data)
      ? result.data
      : result.data.results || [];
    return items.map((item) => ({
      value: (item as { id: string }).id,
      label: formatLabel(item),
    }));
  };
}

// ---------------------------------------------------------------------------
// Handlers par entité
// ---------------------------------------------------------------------------

/**
 * Cas particulier : produit nécessite un cache local pour le POS (voir
 * ``lib/product-search.ts`` historique). On délègue au handler existant.
 */
export {
  createProductSearchHandler,
} from "@/lib/product-search";

export function createCategorySearchHandler(
  accessToken: string,
  organizationId: string,
  extraFilters?: { parent?: string | null; exclude_descendants_of?: string },
): SearchHandler {
  return createListSearchHandler<Category, { search?: string; page_size?: number; is_active?: boolean; parent?: string | null; exclude_descendants_of?: string }>(
    getCategories as never,
    (cat) => cat.name,
    accessToken,
    organizationId,
    { is_active: true, ...extraFilters },
  );
}

export function createBrandSearchHandler(
  accessToken: string,
  organizationId: string,
): SearchHandler {
  return createListSearchHandler<Brand, { search?: string; page_size?: number; is_active?: boolean }>(
    getBrands as never,
    (brand) => brand.name,
    accessToken,
    organizationId,
    { is_active: true },
  );
}

export function createUnitSearchHandler(
  accessToken: string,
  organizationId: string,
): SearchHandler {
  return createListSearchHandler<Unit, { search?: string; page_size?: number }>(
    getUnits as never,
    (unit) => `${unit.name} (${unit.symbol})`,
    accessToken,
    organizationId,
  );
}

export function createCustomerSearchHandler(
  accessToken: string,
  organizationId: string,
): SearchHandler {
  return createListSearchHandler<Customer, { search?: string; page_size?: number; is_active?: boolean }>(
    getCustomers as never,
    (c) => (c.code ? `${c.name} (${c.code})` : c.name),
    accessToken,
    organizationId,
    { is_active: true },
  );
}

export function createSupplierSearchHandler(
  accessToken: string,
  organizationId: string,
): SearchHandler {
  return createListSearchHandler<Supplier, { search?: string; page_size?: number; is_active?: boolean }>(
    getSuppliers as never,
    (s) => (s.code ? `${s.name} (${s.code})` : s.name),
    accessToken,
    organizationId,
    { is_active: true },
  );
}

/**
 * Les entrepôts proposés par un sélecteur, selon ce qu'on va en FAIRE.
 *
 * - ``"action"`` (vendre, transférer, ajuster, ouvrir une caisse) : ses
 *   entrepôts affectés et ACTIFS (`entrepotsActionnables` du noyau). Un membre
 *   qui consulte tous les entrepôts LIT partout mais n'agit que chez lui.
 * - ``"lecture"`` (filtres d'historique et de rapports) : tout ce que le
 *   serveur rend, les inactifs AUSSI, suffixés « (inactif) ». Les cacher
 *   empêchait de relire le passé d'un entrepôt désactivé.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ON LIT LA LISTE ENTIÈRE, PUIS ON CHERCHE DEDANS.                        │
 * │                                                                          │
 * │ Le sélecteur demandait au serveur « les trente premiers qui              │
 * │ correspondent », puis le client gardait ceux où il peut agir : chez un   │
 * │ gérant qui consulte cent entrepôts et n'agit que dans un seul, le sien   │
 * │ pouvait ne pas figurer parmi les trente, et le sélecteur restait vide.   │
 * │ Un établissement compte quelques dizaines d'entrepôts au plus : on les   │
 * │ lit toutes pages, une fois par ouverture, et on filtre ici.              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ L'usage est OBLIGATOIRE : un défaut silencieux est exactement ce qui avait
 * fait cacher les inactifs des filtres d'historique. Et ni `is_active` forcé,
 * ni cast : le `page_size` d'autrefois partait dans le vide derrière un
 * `as never`.
 */
export function createWarehouseSearchHandler(
  accessToken: string,
  organizationId: string,
  usage: UsageEntrepot,
  options?: { membre?: MembrePerimetre | null; branch?: string },
): SearchHandler {
  let liste: Promise<EntrepotProposable[]> | null = null;
  return async (query: string) => {
    // Une recherche VIDE est le chargement d'ouverture : on relit, pour qu'un
    // entrepôt créé ou affecté depuis apparaisse. Les frappes suivantes
    // cherchent dans la liste déjà lue.
    if (!liste || !query.trim()) {
      liste = getWarehouses(accessToken, organizationId, {
        ...(options?.branch ? { branch: options.branch } : {}),
        // Un choix de LECTURE propose tout ce qui est lisible, pas le seul
        // défaut : c'est par ce choix que la case « Consulter tous » élargit.
        ...(usage === "lecture" ? { all_warehouses: true } : {}),
      }).then(async (r): Promise<EntrepotProposable[]> => {
        if (r.success && r.data) return r.data;
        // ⚠ UN CAISSIER « CONSULTER TOUS » N'A PAS `warehouses.view` : la liste
        // lui répond 403, et son filtre restait vide alors qu'il lit tous les
        // dépôts. L'ANNUAIRE (les noms seuls, ouvert à tout membre) prend le
        // relais, borné à ce qu'il peut lire. En action, rien : on n'agit que
        // là où la liste d'action le permet.
        if (usage !== "lecture" || !options?.membre) return [];
        const a = await getWarehouseDirectory(accessToken, organizationId);
        return a.success && a.data ? entrepotsLisibles(options.membre, a.data.entrepots) : [];
      });
    }
    return optionsEntrepots(await liste, usage, options?.membre ?? null, query);
  };
}

/**
 * Les membres à proposer dans un filtre « Utilisateur ».
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ IL TAPE `/memberships/team/`, PAS `/memberships/`.                      │
 * │                                                                          │
 * │ La liste complète exige `users.view`, accordé au seul propriétaire et au │
 * │ gérant : un MAGASINIER y recevrait 403 au chargement de chaque page,     │
 * │ alors que la règle lui donne bien le filtre utilisateur. La porte        │
 * │ dédiée rend exactement le payload de la session du terminal, par le même │
 * │ constructeur serveur.                                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Le CROISEMENT avec l'entrepôt se fait ici, côté client : le roster porte les
 * affectations de chacun, et le refaire côté serveur demanderait un paramètre
 * de plus pour une liste qui tient en mémoire.
 *
 * ⚠ UN PROPRIÉTAIRE EST TOUJOURS PROPOSÉ, quel que soit l'entrepôt choisi : il
 * n'a aucune affectation - c'est ce qui le rend « partout » - et le croiser le
 * ferait disparaître de sa propre liste.
 */
export function createMemberSearchHandler(
  accessToken: string,
  organizationId: string,
  options?: {
    /**
     * Les entrepôts dont on propose les membres (un choix, ou le défaut « mes
     * entrepôts ») ; absent : tous ceux que l'équipe rend. Le propriétaire
     * n'a aucune affectation : il reste toujours proposé.
     */
    warehouses?: string[];
    /** Un membre à ne pas proposer (soi-même, quand c'est déjà le défaut). */
    exclude?: string;
  },
): SearchHandler {
  return async (query: string) => {
    const result = await getTeam(accessToken, organizationId);
    if (!result.success || !result.data?.visible) return [];
    const terme = query.trim().toLowerCase();
    const bornes = options?.warehouses;
    return result.data.members
      .filter((m) => {
        if (options?.exclude && m.user_id === options.exclude) return false;
        if (bornes && m.role !== "owner") {
          if (!m.warehouses.some((id) => bornes.includes(id))) return false;
        }
        return !terme || m.name.toLowerCase().includes(terme);
      })
      .map((m) => ({ value: m.user_id, label: m.name }));
  };
}

export function createBranchSearchHandler(
  accessToken: string,
  organizationId: string,
): SearchHandler {
  return createListSearchHandler<Branch, { search?: string; page_size?: number; is_active?: boolean }>(
    getBranches as never,
    (b) => b.name,
    accessToken,
    organizationId,
    { is_active: true },
  );
}

export function createPaymentMethodSearchHandler(
  accessToken: string,
  organizationId: string,
): SearchHandler {
  return createListSearchHandler<PaymentMethod, { search?: string; page_size?: number; is_active?: boolean }>(
    getPaymentMethods as never,
    (pm) => pm.name,
    accessToken,
    organizationId,
    { is_active: true },
  );
}
