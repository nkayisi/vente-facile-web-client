"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SearchableSelectAsyncWithEmpty } from "@/components/ui/searchable-select-async-empty";
import {
  createWarehouseSearchHandler,
  createCategorySearchHandler,
} from "@/lib/select-search-handlers";
import { ExportMenu } from "@/components/shared/ExportMenu";
import {
  PeriodFilter,
  periodToParams,
  type PeriodValue,
} from "@/components/shared/PeriodFilter";
import { SupplyExportDialog } from "@/components/stock/SupplyExportDialog";
import { SearchableSelectAsync } from "@/components/ui/searchable-select-async";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  ArrowLeft,
  Loader2,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Warehouse as WarehouseIcon,
  Package,
  Truck as TruckIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/auth/permission-gate";
import { ChannelPriceBlock } from "@/components/products/channel-price-block";
import { useCurrency } from "@/components/providers/currency-provider";
import { blendedUnitCost } from "@/lib/pricing";
import { formatPrice, formatDateTime, formatDecimal } from "@/lib/format";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import { getProduct, Product } from "@/actions/products.actions";
import { createProductSearchHandler } from "@/lib/product-search";
import {
  getStockMovements,
  createStockMovement,
  getLocationsByWarehouse,
  StockMovement,
  StockLocation,
  MovementType,
  CreateStockMovementData,
  StockMovementFilters,
  exportStockMovements,
} from "@/actions/stock.actions";
import { DataPagination } from "@/components/shared/DataPagination";

const MOVEMENT_TYPES: {
  value: MovementType;
  label: string;
  direction: "in" | "out";
  /** Faux pour les types produits par le système, jamais saisis à la main */
  selectable?: boolean;
}[] = [
  { value: "purchase", label: "Achat", direction: "in" },
  { value: "sale", label: "Vente", direction: "out" },
  { value: "return_in", label: "Retour client", direction: "in" },
  { value: "return_out", label: "Retour fournisseur", direction: "out" },
  { value: "transfer_in", label: "Transfert entrant", direction: "in" },
  { value: "transfer_out", label: "Transfert sortant", direction: "out" },
  { value: "adjustment_in", label: "Ajustement positif", direction: "in" },
  { value: "adjustment_out", label: "Ajustement négatif", direction: "out" },
  { value: "damage", label: "Dommage/Perte", direction: "out" },
  { value: "expired", label: "Périmé", direction: "out" },
  { value: "initial", label: "Stock initial", direction: "in" },
  // Produit par le système lors de l'ouverture d'un conditionnement : il figure
  // dans l'historique mais ne se saisit pas (le serveur le refuse).
  { value: "unpack", label: "Déconditionnement", direction: "in", selectable: false },
];

/** Types réellement proposés dans le formulaire de création. */
const SELECTABLE_MOVEMENT_TYPES = MOVEMENT_TYPES.filter(
  type => type.selectable !== false
);

/** Entrées de stock où le coût unitaire sert à la valorisation (approvisionnement, etc.) */
const STOCK_IN_TYPES_WITH_COST: MovementType[] = [
  "purchase",
  "initial",
  "return_in",
  "transfer_in",
  "adjustment_in",
];

const EMPTY_FORM: CreateStockMovementData = {
  product: "",
  warehouse: "",
  movement_type: "initial",
  quantity: 0,
  notes: "",
  location: "",
  expiry_date: "",
};

export default function MovementsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { currency: defaultCurrency } = useCurrency();
  const currencySymbol = defaultCurrency.symbol;

  // State
  const [isLoading, setIsLoading] = useState(true);
  /** Rechargement du tableau seul : la page reste affichée, les lignes deviennent des squelettes */
  const [isFetching, setIsFetching] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  /** Requête réellement envoyée : sans délai, chaque frappe déclencherait un appel */
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [period, setPeriod] = useState<PeriodValue>({ mode: "all" });
  const [isSupplyDialogOpen, setIsSupplyDialogOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [pageSize, setPageSize] = useState(20);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateStockMovementData>(EMPTY_FORM);
  /**
   * Prix de vente affichés dans les blocs canal. Ils servent toujours au calcul
   * de la marge ; ils ne partent au serveur que si la case ci-dessous est
   * cochée. Séparés de `formData` pour cette raison : ce ne sont pas des
   * données du mouvement.
   */
  const [sellingPrices, setSellingPrices] = useState<{
    selling_price: number | null;
    wholesale_price: number | null;
  }>({ selling_price: null, wholesale_price: null });
  const [updateProductPrices, setUpdateProductPrices] = useState(false);

  // Charger les emplacements quand l'entrepôt change
  useEffect(() => {
    const loadLocations = async () => {
      if (!session?.accessToken || !organization || !formData.warehouse) {
        setLocations([]);
        return;
      }

      const result = await getLocationsByWarehouse(
        session.accessToken,
        organization.id,
        formData.warehouse
      );

      if (result.success && result.data) {
        setLocations(result.data);
      } else {
        setLocations([]);
      }
    };

    loadLocations();
  }, [session?.accessToken, organization, formData.warehouse]);

  const searchProducts = useCallback(
    async (query: string) => {
      if (!session?.accessToken || !organization) return [];
      return createProductSearchHandler(session.accessToken, organization.id, {
        extraFilters: {
          full_catalog: true,
        },
        onResults: results => {
          setProducts(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newProducts = results.filter(p => !existingIds.has(p.id));
            return newProducts.length > 0 ? [...prev, ...newProducts] : prev;
          });
        },
      })(query);
    },
    [session?.accessToken, organization]
  );

  /**
   * Reprend les quatre prix de la fiche produit.
   *
   * Le marchand n'a ainsi rien à ressaisir pour un réapprovisionnement au même
   * prix, et voit sa marge immédiatement. Les prix restent modifiables : un
   * fournisseur change ses tarifs.
   *
   * Le remplissage se fait **à chaque changement de produit**, sans garde du
   * type « ne rien faire si un prix est déjà là » : dans un modale resté
   * ouvert, cette garde laissait en place le prix du produit précédent.
   */
  const prefillPrices = useCallback((product: Product) => {
    const isPackaged =
      product.selling_mode &&
      product.selling_mode !== "retail_only" &&
      (product.units_per_package ?? 0) >= 2;

    setFormData(prev => ({
      ...prev,
      unit_cost: product.cost_price ? parseFloat(product.cost_price) : undefined,
      package_unit_cost:
        isPackaged && product.package_cost_price
          ? parseFloat(product.package_cost_price)
          : undefined,
    }));

    setSellingPrices({
      selling_price: product.selling_price ? parseFloat(product.selling_price) : null,
      wholesale_price:
        isPackaged && product.wholesale_price
          ? parseFloat(product.wholesale_price)
          : null,
    });

    // Une case restée cochée écraserait les prix du produit suivant.
    setUpdateProductPrices(false);
  }, []);

  // Pré-remplir les prix quand le produit change
  useEffect(() => {
    if (formData.product) {
      const product = products.find(p => p.id === formData.product);
      if (product) {
        setSelectedProduct(product);
        prefillPrices(product);
      } else if (session?.accessToken && organization) {
        // Produit sélectionné via recherche mais pas encore dans le cache local
        getProduct(session.accessToken, organization.id, formData.product).then(result => {
          if (result.success && result.data) {
            setSelectedProduct(result.data);
            setProducts(prev => [...prev, result.data!]);
            prefillPrices(result.data);
          }
        });
      }
    } else {
      setSelectedProduct(null);
    }
    // `products` est volontairement hors des dépendances : la liste grossit à
    // chaque recherche, et le préremplissage doit suivre le produit choisi, pas
    // le cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.product, session?.accessToken, organization, prefillPrices]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);
          // Les entrepôts ne sont pas préchargés : les deux sélecteurs de la page
          // les cherchent à la demande via `createWarehouseSearchHandler`.
          // Les mouvements sont chargés par l'effet des filtres, une fois
          // l'organisation connue : les charger ici aussi doublerait l'appel.
        } else {
          setIsFetching(false);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Erreur lors du chargement des données");
        setIsFetching(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.accessToken]);

  // Fetch movements with filters
  const fetchMovements = useCallback(async (orgId?: string) => {
    if (!session?.accessToken) return;
    const id = orgId || organization?.id;
    if (!id) return;

    const filters: StockMovementFilters = {
      page: currentPage,
      page_size: pageSize,
      ...periodToParams(period),
    };
    if (selectedWarehouse !== "all") filters.warehouse = selectedWarehouse;
    if (selectedType !== "all") filters.movement_type = selectedType as MovementType;
    if (selectedCategory !== "all") filters.category = selectedCategory;
    if (debouncedSearch) filters.search = debouncedSearch;

    setIsFetching(true);
    try {
      const result = await getStockMovements(session.accessToken, id, filters);
      if (result.success && result.data) {
        setMovements(result.data.results);
        setTotalCount(result.data.count);
        setHasNext(result.data.next !== null);
        setHasPrevious(result.data.previous !== null);
      } else {
        toast.error(result.message || "Erreur lors du chargement des mouvements");
      }
    } finally {
      setIsFetching(false);
    }
  }, [session?.accessToken, organization, currentPage, pageSize, selectedWarehouse, selectedType, selectedCategory, period, debouncedSearch]);

  // Refetch when filters or page change
  useEffect(() => {
    if (organization) {
      fetchMovements();
    }
  }, [organization, fetchMovements]);

  // La recherche part une fois la frappe retombée, pas à chaque caractère
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Un filtre qui change repart de la première page : rester en page 5 d'un
  // résultat qui n'en compte plus que 2 afficherait un tableau vide.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedWarehouse, selectedType, selectedCategory, period, pageSize]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasActiveFilters =
    selectedWarehouse !== "all" ||
    selectedType !== "all" ||
    selectedCategory !== "all" ||
    period.mode !== "all" ||
    searchQuery.trim() !== "";

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedWarehouse("all");
    setSelectedType("all");
    setSelectedCategory("all");
    setPeriod({ mode: "all" });
  };

  /** Période en toutes lettres, pour que le dialogue dise sur quoi il porte. */
  const periodDescription = useMemo(() => {
    const params = periodToParams(period);
    if (params.month) {
      const [year, month] = params.month.split("-");
      const names = [
        "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre",
      ];
      return `${names[Number(month) - 1] ?? month} ${year}`;
    }
    if (params.date_from && params.date_to) {
      return `du ${params.date_from} au ${params.date_to}`;
    }
    if (params.date_from) return `à partir du ${params.date_from}`;
    if (params.date_to) return `jusqu'au ${params.date_to}`;
    return "Tout l'historique";
  }, [period]);

  /** Filtres d'export, alignés sur ceux de la liste affichée. */
  const exportFilters = useMemo<StockMovementFilters>(() => {
    const filters: StockMovementFilters = { ...periodToParams(period) };
    if (selectedWarehouse !== "all") filters.warehouse = selectedWarehouse;
    if (selectedType !== "all") filters.movement_type = selectedType as MovementType;
    if (selectedCategory !== "all") filters.category = selectedCategory;
    if (debouncedSearch) filters.search = debouncedSearch;
    return filters;
  }, [period, selectedWarehouse, selectedType, selectedCategory, debouncedSearch]);

  /** Bornes affichées dans le pied du tableau : « 21 à 40 sur 137 » */
  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalCount);

  /** Vrai pour une entrée de stock : elle seule porte des prix. */
  const isStockIn = STOCK_IN_TYPES_WITH_COST.includes(formData.movement_type);

  /**
   * Conditionnement du produit sélectionné. `null` pour un produit vendu à
   * l'unité, qui conserve alors la saisie simple d'origine.
   */
  const packagingFactor =
    selectedProduct?.selling_mode &&
    selectedProduct.selling_mode !== "retail_only" &&
    selectedProduct.units_per_package
      ? selectedProduct.units_per_package
      : null;

  /**
   * Produit vendu uniquement en gros : il entre et sort par contenant entier.
   * Lui proposer une saisie au détail n'aurait pas de sens, un contenant ne
   * s'ouvrant jamais pour ce mode.
   */
  const isPackageOnly =
    !!packagingFactor && selectedProduct?.selling_mode === "wholesale_only";

  const packageWord = selectedProduct?.packaging_unit_name || "conditionnement";
  const retailWord = selectedProduct?.unit_name || "unité";
  const pluralize = (word: string) => (/[sx]$/i.test(word) ? word : `${word}s`);
  const packageWordPlural = pluralize(packageWord);
  const retailWordPlural = pluralize(retailWord);

  /** Récapitulatif de la conversion, affiché avant validation. */
  const conversionSummary = useMemo(() => {
    if (!packagingFactor) return null;
    const packages = formData.package_quantity ?? 0;
    const loose = formData.loose_quantity ?? 0;
    if (packages <= 0 && loose <= 0) return null;

    const total = packages * packagingFactor + loose;
    const parts: string[] = [];
    if (packages > 0) {
      parts.push(`${packages} ${packages > 1 ? packageWordPlural : packageWord}`);
    }
    if (loose > 0) {
      parts.push(`${loose} ${loose > 1 ? retailWordPlural : retailWord}`);
    }
    const verb = ["purchase", "initial", "return_in", "transfer_in", "adjustment_in", "production_in"].includes(
      formData.movement_type
    )
      ? "ajoutez"
      : "retirez";
    return `Vous ${verb} ${parts.join(" + ")} = ${total} ${
      total > 1 ? retailWordPlural : retailWord
    }.`;
  }, [
    packagingFactor,
    formData.package_quantity,
    formData.loose_quantity,
    formData.movement_type,
    packageWord,
    packageWordPlural,
    retailWord,
    retailWordPlural,
  ]);

  /**
   * Coût unitaire réellement enregistré quand les deux canaux sont servis à des
   * prix différents. C'est la seule valeur que le marchand ne peut pas
   * recalculer de tête avant de valider. Le serveur refait le calcul, cet
   * affichage n'est qu'une prévision.
   */
  const blendedCostPreview = useMemo(() => {
    if (!isStockIn || !packagingFactor) return null;
    const packages = formData.package_quantity ?? 0;
    const loose = formData.loose_quantity ?? 0;
    if (packages <= 0 || loose <= 0) return null;
    if (!formData.package_unit_cost || !formData.unit_cost) return null;

    return blendedUnitCost({
      packageQuantity: packages,
      packageCost: formData.package_unit_cost,
      looseQuantity: loose,
      looseCost: formData.unit_cost,
      factor: packagingFactor,
    });
  }, [
    isStockIn,
    packagingFactor,
    formData.package_quantity,
    formData.loose_quantity,
    formData.package_unit_cost,
    formData.unit_cost,
  ]);

  const locationSelectOptions = useMemo(
    () => [
      { value: "__none__", label: "Aucun emplacement" },
      ...locations.map(loc => ({
        value: loc.id,
        label: `${loc.name} (${loc.code})`,
      })),
    ],
    [locations]
  );

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !organization?.id) return;

    if (!formData.product || !formData.warehouse) {
      toast.error("Veuillez sélectionner un produit et un entrepôt");
      return;
    }

    // Vérifier si la date d'expiration est requise pour les produits périssables
    const isStockIn = ["purchase", "initial", "return_in", "transfer_in", "adjustment_in"].includes(formData.movement_type);
    if (isStockIn && selectedProduct?.has_expiry_date && !formData.expiry_date) {
      toast.error("La date d'expiration est obligatoire pour ce produit périssable");
      return;
    }

    if (packagingFactor) {
      const packages = formData.package_quantity ?? 0;
      const loose = formData.loose_quantity ?? 0;
      if (packages <= 0 && (isPackageOnly || loose <= 0)) {
        toast.error(
          isPackageOnly
            ? `Indiquez un nombre de ${packageWordPlural}`
            : `Indiquez un nombre de ${packageWordPlural} ou de ${retailWordPlural}`
        );
        return;
      }
    } else if (!formData.quantity) {
      toast.error("Veuillez indiquer une quantité");
      return;
    }

    setIsSubmitting(true);

    // Le serveur convertit la saisie en unité de base : on ne lui envoie que ce
    // qui a réellement été saisi, jamais un total calculé côté navigateur.
    const payload: CreateStockMovementData = packagingFactor
      ? {
          ...formData,
          quantity: undefined,
          package_quantity: formData.package_quantity ?? 0,
          // Produit vendu en gros seul : la case au détail n'est pas affichée,
          // une valeur restée d'un produit précédent ne doit pas partir.
          loose_quantity: isPackageOnly ? 0 : (formData.loose_quantity ?? 0),
          unit_cost: isPackageOnly ? undefined : formData.unit_cost,
        }
      : { ...formData, package_quantity: undefined, loose_quantity: undefined, package_unit_cost: undefined };

    // Une sortie de stock n'a pas de prix d'achat à déclarer : sa valeur est
    // déterminée par les lots consommés.
    if (!isStockIn) {
      payload.unit_cost = undefined;
      payload.package_unit_cost = undefined;
    }

    // Les prix de vente ne partent que si le marchand a demandé le report : le
    // reste du temps, ils n'ont servi qu'à afficher la marge.
    if (updateProductPrices) {
      payload.update_product_prices = true;
      if (!isPackageOnly && sellingPrices.selling_price) {
        payload.selling_price = sellingPrices.selling_price;
      }
      if (packagingFactor && sellingPrices.wholesale_price) {
        payload.wholesale_price = sellingPrices.wholesale_price;
      }
    }

    try {
      const result = await createStockMovement(session.accessToken, organization.id, payload);
      if (result.success) {
        toast.success(
          updateProductPrices
            ? "Mouvement créé et prix de la fiche produit mis à jour"
            : "Mouvement créé avec succès"
        );
        setShowCreateDialog(false);
        fetchMovements();
        setFormData(EMPTY_FORM);
        setSellingPrices({ selling_price: null, wholesale_price: null });
        setUpdateProductPrices(false);
      } else {
        toast.error(result.message || "Erreur lors de la création");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Couleur, icône et sens d'un type de mouvement, pour le badge du tableau */
  const getMovementBadge = (type: MovementType) => {
    const movement = MOVEMENT_TYPES.find(m => m.value === type);
    if (!movement) {
      return {
        color: "bg-gray-100 text-gray-700 hover:bg-gray-100",
        icon: Package,
        direction: null as "in" | "out" | null,
      };
    }

    if (movement.direction === "in") {
      return {
        color: "bg-green-100 text-green-700 hover:bg-green-100",
        icon: ArrowDownLeft,
        direction: "in" as const,
      };
    }
    return {
      color: "bg-red-100 text-red-700 hover:bg-red-100",
      icon: ArrowUpRight,
      direction: "out" as const,
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mouvements de stock</h1>
            <p className="text-sm text-gray-500 mt-1">
              Historique des entrées et sorties de stock
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            disabled={!session?.accessToken || !organization?.id || totalCount === 0}
            disabledReason="Aucun mouvement à exporter"
            targets={[
              {
                key: "movements",
                label: "Journal des mouvements",
                description: "Entrées et sorties, telles que filtrées",
                run: (format) =>
                  exportStockMovements(
                    session!.accessToken as string,
                    organization!.id,
                    format,
                    exportFilters
                  ),
              },
            ]}
          />

          <Button
            variant="outline"
            disabled={!session?.accessToken || !organization?.id}
            onClick={() => setIsSupplyDialogOpen(true)}
          >
            <TruckIcon className="h-4 w-4 mr-2" />
            Rapport d&apos;approvisionnement
          </Button>

          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouveau mouvement
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher un produit, un code ou une note..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SearchableSelectAsyncWithEmpty
            value={selectedWarehouse === "all" ? null : selectedWarehouse}
            onValueChange={value => setSelectedWarehouse(value ?? "all")}
            onSearch={
              session?.accessToken && organization?.id
                ? createWarehouseSearchHandler(session.accessToken, organization.id)
                : async () => []
            }
            emptyLabel="Tous les entrepôts"
            placeholder="Entrepôt"
            searchPlaceholder="Rechercher un entrepôt..."
            className="max-w-max"
            disabled={!session?.accessToken || !organization?.id}
          />

          <SearchableSelectAsyncWithEmpty
            value={selectedCategory === "all" ? null : selectedCategory}
            onValueChange={value => setSelectedCategory(value ?? "all")}
            onSearch={
              session?.accessToken && organization?.id
                ? createCategorySearchHandler(session.accessToken, organization.id)
                : async () => []
            }
            emptyLabel="Toutes les catégories"
            placeholder="Catégorie"
            searchPlaceholder="Rechercher une catégorie..."
            className="max-w-max"
            disabled={!session?.accessToken || !organization?.id}
          />

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="max-w-max">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {MOVEMENT_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-gray-500"
            >
              <X className="h-4 w-4 mr-1" />
              Réinitialiser
            </Button>
          )}
        </div>
      </div>

      <PeriodFilter value={period} onChange={setPeriod} />

      {/* Historique */}
      {!isFetching && movements.length === 0 && !hasActiveFilters ? (
        <Card className="p-0">
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun mouvement</h3>
            <p className="text-sm text-gray-500 mb-4">
              Les mouvements de stock apparaîtront ici
            </p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Créer un mouvement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-2.5">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                Historique{" "}
                <span className="font-normal text-gray-500">({totalCount})</span>
              </CardTitle>
              {isFetching && (
                <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden md:table-cell">Entrepôt</TableHead>
                    <TableHead className="hidden xl:table-cell">Par</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right hidden lg:table-cell whitespace-nowrap">
                      Stock (avant → après)
                    </TableHead>
                    <TableHead className="text-right hidden xl:table-cell">
                      Valeur
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isFetching && movements.length === 0 ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <TableRow key={`skeleton-${index}`}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Skeleton className="h-4 w-20 ml-auto" />
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <Skeleton className="h-4 w-20 ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : movements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center">
                        <p className="text-sm text-gray-500">
                          Aucun mouvement ne correspond à votre recherche
                        </p>
                        <Button
                          variant="link"
                          onClick={resetFilters}
                          className="text-orange-600"
                        >
                          Réinitialiser les filtres
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    movements.map(movement => {
                      const badge = getMovementBadge(movement.movement_type);
                      const Icon = badge.icon;
                      const qty = parseFloat(movement.quantity);
                      // Un déconditionnement laisse le total inchangé : ni signe,
                      // ni couleur d'entrée ou de sortie, seul le partage change.
                      const sign = qty > 0 ? "+" : qty < 0 ? "-" : "";
                      const quantityColor =
                        qty > 0
                          ? "text-green-600"
                          : qty < 0
                            ? "text-red-600"
                            : "text-gray-600";
                      const unitCost = parseFloat(movement.unit_cost || "0");
                      const movementValue = Math.abs(qty) * unitCost;

                      return (
                        <TableRow key={movement.id}>
                          <TableCell className="whitespace-nowrap text-sm text-gray-600">
                            {formatDateTime(movement.created_at)}
                          </TableCell>

                          <TableCell className="max-w-[260px]">
                            <div
                              className="truncate text-sm font-medium text-gray-900"
                              title={movement.product_name}
                            >
                              {movement.product_name}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                              {movement.product_sku && (
                                <span className="font-mono">{movement.product_sku}</span>
                              )}
                              <span className="flex items-center gap-1 md:hidden">
                                <WarehouseIcon className="h-3 w-3" />
                                {movement.warehouse_name}
                              </span>
                            </div>
                            {movement.notes && (
                              <p
                                className="mt-0.5 truncate text-xs text-gray-400"
                                title={movement.notes}
                              >
                                {movement.notes}
                              </p>
                            )}
                          </TableCell>

                          <TableCell>
                            <Badge className={`${badge.color} whitespace-nowrap`}>
                              <Icon className="h-3 w-3 mr-1" />
                              {movement.movement_type_display}
                            </Badge>
                          </TableCell>

                          <TableCell className="hidden md:table-cell text-sm text-gray-600">
                            {movement.warehouse_name}
                          </TableCell>

                          <TableCell className="hidden xl:table-cell text-sm text-gray-500">
                            {movement.created_by_name || "-"}
                          </TableCell>

                          <TableCell
                            className={`text-right whitespace-nowrap font-semibold tabular-nums ${quantityColor}`}
                          >
                            {sign}
                            {movement.quantity_display ||
                              formatDecimal(Math.abs(qty))}
                          </TableCell>

                          {/* Le mouvement n'enregistre que des TOTAUX à ces deux
                              bornes : le partage scellé/vrac du rayon à cet
                              instant n'est nulle part. Le serveur nomme donc
                              l'unité de détail (« 99 bouteilles ») au lieu
                              d'inventer un nombre de casiers. */}
                          <TableCell className="hidden lg:table-cell text-right text-sm text-gray-500 tabular-nums whitespace-nowrap">
                            {movement.quantity_before_display?.trim() ||
                              formatDecimal(movement.quantity_before)}{" "}
                            →{" "}
                            {movement.quantity_after_display?.trim() ||
                              formatDecimal(movement.quantity_after)}
                          </TableCell>

                          <TableCell className="hidden xl:table-cell text-right text-sm text-gray-600 tabular-nums">
                            {unitCost > 0 ? formatPrice(movementValue) : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pied de tableau : bornes affichées, taille de page et pagination */}
            {totalCount > 0 && (
              <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="whitespace-nowrap">
                    {rangeStart} à {rangeEnd} sur {totalCount}
                  </span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={value => setPageSize(Number(value))}
                  >
                    <SelectTrigger className="h-8 w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[20, 50, 100].map(size => (
                        <SelectItem key={size} value={String(size)}>
                          {size} par page
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {totalPages > 1 && (
                  <DataPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    hasNext={hasNext}
                    hasPrevious={hasPrevious}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Movement Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="flex max-h-[min(90vh,calc(100dvh-1rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 space-y-1.5 px-6 pt-6 pb-3 pr-12 text-left">
            <DialogTitle>Nouveau mouvement de stock</DialogTitle>
            <DialogDescription>
              Créez un mouvement manuel pour ajuster le stock
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-6 pb-2">
              <div className="space-y-2">
              <Label htmlFor="product">Produit *</Label>
              <SearchableSelectAsync
                onSearch={searchProducts}
                value={formData.product || undefined}
                onValueChange={value => setFormData({ ...formData, product: value })}
                placeholder="Sélectionner un produit"
                searchPlaceholder="Rechercher un produit..."
              />
              </div>

              <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="warehouse">Entrepôt *</Label>
                <SearchableSelectAsyncWithEmpty
                  value={formData.warehouse || null}
                  onValueChange={value =>
                    setFormData({ ...formData, warehouse: value || "" })
                  }
                  onSearch={
                    session?.accessToken && organization?.id
                      ? createWarehouseSearchHandler(session.accessToken, organization.id)
                      : async () => []
                  }
                  emptyLabel="-"
                  placeholder="Sélectionner un entrepôt"
                  searchPlaceholder="Rechercher un entrepôt..."
                  disabled={!session?.accessToken || !organization?.id}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="movement_type">Type de mouvement *</Label>
                <Select
                  value={formData.movement_type}
                  onValueChange={value =>
                    setFormData({ ...formData, movement_type: value as MovementType })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner le type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SELECTABLE_MOVEMENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              </div>

              {/* Un bloc par canal : chacun porte sa quantité, ses deux prix et
                  sa marge. Le marchand lit « 2 cartons à 6 000 » d'un seul
                  tenant, au lieu de rapprocher une quantité et un prix rangés
                  dans deux zones différentes. */}
              {!isPackageOnly && (
                <ChannelPriceBlock
                  channel="retail"
                  title={`Au détail · ${retailWord}`}
                  currencySymbol={currencySymbol}
                  costLabel={`Prix d'achat d'une ${retailWord}`}
                  sellingLabel={`Prix de vente d'une ${retailWord}`}
                  costPrice={isStockIn ? formData.unit_cost ?? null : null}
                  sellingPrice={sellingPrices.selling_price}
                  onCostChange={value =>
                    setFormData({ ...formData, unit_cost: value ?? undefined })
                  }
                  onSellingChange={value =>
                    setSellingPrices(prev => ({ ...prev, selling_price: value }))
                  }
                  disabled={!isStockIn}
                  quantitySlot={
                    <div className="space-y-1.5">
                      <Label htmlFor="loose_quantity">
                        {packagingFactor
                          ? `Nombre de ${retailWordPlural} à l'unité`
                          : "Quantité *"}
                      </Label>
                      <Input
                        id="loose_quantity"
                        type="number"
                        value={
                          packagingFactor
                            ? formData.loose_quantity ?? ""
                            : formData.quantity ?? ""
                        }
                        onChange={e => {
                          const value = e.target.value ? parseFloat(e.target.value) : undefined;
                          setFormData(
                            packagingFactor
                              ? { ...formData, loose_quantity: value }
                              : { ...formData, quantity: value ?? 0 }
                          );
                        }}
                        min="0"
                        step="1"
                        placeholder="0"
                      />
                    </div>
                  }
                />
              )}

              {packagingFactor && (
                <ChannelPriceBlock
                  channel="wholesale"
                  title={`En gros · ${packageWord}`}
                  conversionHint={`1 ${packageWord} = ${packagingFactor} ${retailWordPlural}`}
                  currencySymbol={currencySymbol}
                  costLabel={`Prix d'achat d'un ${packageWord}`}
                  sellingLabel={`Prix de vente d'un ${packageWord}`}
                  costPrice={isStockIn ? formData.package_unit_cost ?? null : null}
                  sellingPrice={sellingPrices.wholesale_price}
                  onCostChange={value =>
                    setFormData({ ...formData, package_unit_cost: value ?? undefined })
                  }
                  onSellingChange={value =>
                    setSellingPrices(prev => ({ ...prev, wholesale_price: value }))
                  }
                  disabled={!isStockIn}
                  quantitySlot={
                    <div className="space-y-1.5">
                      <Label htmlFor="package_quantity">
                        Nombre de {packageWordPlural}
                      </Label>
                      <Input
                        id="package_quantity"
                        type="number"
                        value={formData.package_quantity ?? ""}
                        onChange={e => setFormData({
                          ...formData,
                          package_quantity: e.target.value ? parseFloat(e.target.value) : undefined,
                        })}
                        min="0"
                        step="1"
                        placeholder="0"
                      />
                    </div>
                  }
                />
              )}

              {/* Récapitulatif de la conversion, avant validation */}
              {conversionSummary && (
                <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
                  {conversionSummary}
                  {blendedCostPreview !== null && (
                    <>
                      {" "}
                      Valorisées à {formatPrice(blendedCostPreview, currencySymbol)} la{" "}
                      {retailWord}.
                    </>
                  )}
                </div>
              )}

              {/* Report des prix sur la fiche produit : jamais coché d'avance,
                  un achat à prix exceptionnel ne doit pas retarifer le
                  catalogue à l'insu du marchand. */}
              {isStockIn && selectedProduct && (
                <PermissionGate permission="products.edit">
                  <label
                    htmlFor="update_product_prices"
                    className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer"
                  >
                    <input
                      id="update_product_prices"
                      type="checkbox"
                      checked={updateProductPrices}
                      onChange={e => setUpdateProductPrices(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-orange-500"
                    />
                    <span className="text-sm">
                      <span className="font-medium text-gray-900">
                        Mettre à jour les prix de la fiche produit
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        Les prix de vente saisis servent au calcul de la marge.
                        Cochez pour les enregistrer aussi sur la fiche. Le coût de
                        ce mouvement est enregistré dans tous les cas.
                      </span>
                    </span>
                  </label>
                </PermissionGate>
              )}

              {/* Champs pour les entrées de stock (lots) */}
              {["purchase", "initial", "return_in", "transfer_in", "adjustment_in"].includes(formData.movement_type) && (
              <div className="space-y-4">

                <div className="space-y-2">
                  <Label htmlFor="location">Emplacement (optionnel)</Label>
                  <SearchableSelect
                    options={locationSelectOptions}
                    value={formData.location ? formData.location : "__none__"}
                    onValueChange={value =>
                      setFormData({ ...formData, location: value === "__none__" ? "" : value })
                    }
                    placeholder={
                      formData.warehouse
                        ? "Rechercher un emplacement…"
                        : "Sélectionnez d’abord un entrepôt"
                    }
                    searchPlaceholder="Nom ou code…"
                    emptyMessage="Aucun emplacement"
                    disabled={!formData.warehouse}
                  />
                  {locations.length === 0 && formData.warehouse && (
                    <p className="text-xs text-gray-500">Aucun emplacement disponible pour cet entrepôt</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiry_date">
                    Date d'expiration {selectedProduct?.has_expiry_date ? "*" : "(optionnel)"}
                  </Label>
                  <Input
                    id="expiry_date"
                    type="date"
                    value={formData.expiry_date || ""}
                    onChange={e => setFormData({ ...formData, expiry_date: e.target.value })}
                    required={selectedProduct?.has_expiry_date}
                  />
                  {selectedProduct?.has_expiry_date ? (
                    <p className="text-xs text-orange-600 font-medium">
                      ⚠️ Ce produit est périssable, la date d'expiration est obligatoire
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">Pour les produits périssables uniquement</p>
                  )}
                </div>
              </div>
              )}

              <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notes optionnelles..."
                rows={2}
              />
              </div>
            </div>

            <DialogFooter className="shrink-0 border-t bg-card px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {session?.accessToken && organization?.id && (
        <SupplyExportDialog
          open={isSupplyDialogOpen}
          onOpenChange={setIsSupplyDialogOpen}
          accessToken={session.accessToken as string}
          organizationId={organization.id}
          baseFilters={{
            warehouse: exportFilters.warehouse,
            category: exportFilters.category,
            date_from: exportFilters.date_from,
            date_to: exportFilters.date_to,
            month: exportFilters.month,
          }}
          periodLabel={periodDescription}
        />
      )}
    </div>
  );
}
