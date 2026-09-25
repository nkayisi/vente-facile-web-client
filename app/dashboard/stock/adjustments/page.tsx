"use client";

import { messageDeRefus } from "@/lib/perimeter-refusal";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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
import { SearchableSelectAsyncWithEmpty } from "@/components/ui/searchable-select-async-empty";
import { createWarehouseSearchHandler } from "@/lib/select-search-handlers";
import { SearchableSelectAsync } from "@/components/ui/searchable-select-async";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  ArrowLeft,
  Loader2,
  Plus,
  ClipboardCheck,
  MoreVertical,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Warehouse as WarehouseIcon,
  Package,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice, formatDate } from "@/lib/format";
import { getProduct, Product } from "@/actions/products.actions";
import { createProductSearchHandler } from "@/lib/product-search";
import {
  getPackaging,
  formatPackagedSplit,
  formatPackagedDifference,
  splitPackaged,
} from "@/lib/packaging";
import {
  afficherPartage,
  ecartDuComptage,
  resumeConversion,
  verifierQuantite,
  type ErreursQuantite,
  type PartageStock,
  type SaisieQuantite,
} from "@/lib/stock/lignes-conditionnees";
import { PackagedQuantityInput } from "@/components/stock/packaged-quantity-input";
import {
  getStockAdjustments,
  createStockAdjustment,
  approveStockAdjustment,
  rejectStockAdjustment,
  getWarehouses,
  getStocks,
  StockAdjustment,
  Warehouse,
  Stock,
  AdjustmentType,
  AdjustmentStatus,
  CreateStockAdjustmentData,
} from "@/actions/stock.actions";
import { DataPagination } from "@/components/shared/DataPagination";
import { useOrganization } from "@/components/auth/organization-checker";
import { PerimeterFilters, type PerimeterValue } from "@/components/filters/perimeter-filters";
import { usePerimeter } from "@/hooks/use-perimeter";

const STATUS_CONFIG: Record<AdjustmentStatus, { label: string; color: string; icon: any }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-700", icon: Clock },
  pending: { label: "En attente", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  approved: { label: "Approuvé", color: "bg-green-100 text-green-700", icon: CheckCircle },
  rejected: { label: "Rejeté", color: "bg-red-100 text-red-700", icon: XCircle },
};

const ADJUSTMENT_TYPES: { value: AdjustmentType; label: string }[] = [
  { value: "count", label: "Inventaire" },
  { value: "damage", label: "Dommage" },
  { value: "theft", label: "Vol" },
  { value: "expired", label: "Périmé" },
  { value: "correction", label: "Correction" },
  { value: "other", label: "Autre" },
];

/**
 * Ligne du formulaire d'ajustement.
 *
 * `expected_loose_quantity` est un champ CLIENT : il porte la part vrac lue sur
 * la ligne de stock, ce qui permet d'afficher un écart ventilé par canal avant
 * l'envoi. Le serveur relève la même valeur de son côté à la création, il ne
 * l'accepte donc pas en entrée et elle est retirée du corps de la requête.
 */
type AdjustmentFormItem = CreateStockAdjustmentData["items"][number] & {
  expected_loose_quantity?: number;
};

type AdjustmentFormData = Omit<CreateStockAdjustmentData, "items"> & {
  items: AdjustmentFormItem[];
};

export default function AdjustmentsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const { organization } = useOrganization();
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const pageSize = 20;

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<AdjustmentFormData>({
    warehouse: "",
    adjustment_type: "count",
    reason: "",
    items: [],
  });

  // Item being added
  // ⚠ `quantity_counted` est OPTIONNEL, et ce n'est pas un détail de typage :
  // `undefined` dit « rien tapé », `0` dit « rayon vide ». Tant qu'il valait
  // `number` initialisé à 0, les deux étaient le même nombre, et le `|| null`
  // qui en découlait transformait un zéro TAPÉ en « rien tapé » : un rayon
  // vidé par un vol se faisait refuser « Indiquez ce que vous avez compté,
  // même si c'est zéro » - c'est-à-dire exactement ce que l'opérateur venait
  // de faire. Le champ, lui, effaçait le 0 sous ses yeux.
  const [newItem, setNewItem] = useState<{
    product: string;
    quantity_counted?: number;
    quantity_expected: number;
    /** Part vrac du stock théorique, LUE sur la ligne de stock */
    expected_loose_quantity?: number;
    unit_cost: number;
    counted_package_quantity?: number;
    counted_loose_quantity?: number;
  }>({
    product: "",
    quantity_expected: 0,
    unit_cost: 0,
  });

  /** Messages sous les champs de quantité. Un appui doit RÉPONDRE. */
  const [newItemErrors, setNewItemErrors] = useState<ErreursQuantite>({});

  /**
   * La ligne de stock de l'article choisi, DANS L'ENTREPÔT VISÉ.
   *
   * ┌────────────────────────────────────────────────────────────────────────┐
   * │ L'ATTENDU NE SE LIT PLUS DANS UNE LISTE PAGINÉE.                      │
   * │                                                                        │
   * │ Il venait de `warehouseStocks`, alimenté par `getStockByWarehouse`,    │
   * │ qui ne garde que la PREMIÈRE PAGE de `stocks/by-warehouse/` - une      │
   * │ action paginée côté serveur. Sur un dépôt de plus d'une page de        │
   * │ rayons, tout article au-delà était compté contre un attendu de ZÉRO.   │
   * │                                                                        │
   * │ Le stock final n'en souffrait pas (`approve_adjustment` POSE le        │
   * │ comptage, il n'ajoute pas l'écart), mais `quantity_difference` était   │
   * │ faux, donc le mouvement enregistré aussi : le journal annonçait        │
   * │ « +50 trouvés » là où le rayon n'avait pas bougé, et son sens          │
   * │ (`adjustment_in` / `adjustment_out`) avec lui. Un inventaire sert      │
   * │ précisément à ce que ce chiffre-là soit juste.                         │
   * │                                                                        │
   * │ La ligne est donc demandée À L'UNITÉ, ce qui ne dépend d'aucune liste. │
   * └────────────────────────────────────────────────────────────────────────┘
   */
  const [itemStock, setItemStock] = useState<Stock | null>(null);

  /**
   * Conditionnement du produit en cours de saisie. Un produit vendu par
   * contenant se compte comme il est rangé : « 3 cartons + 2 bouteilles ».
   */
  const newItemPackaging = getPackaging(products.find(p => p.id === newItem.product));

  /**
   * Le THÉORIQUE, relevé sur la ligne de stock et jamais saisi.
   *
   * Ses deux compteurs sont LUS : redécouper le total au facteur du jour
   * annoncerait « 4 casiers + 3 bouteilles » pour un rayon qui en porte 3 et
   * 27, et l'écart s'appuierait alors sur un attendu qui n'a jamais existé.
   */
  const attendu: PartageStock | null = itemStock
    ? {
        contenants: Number(itemStock.package_quantity ?? 0),
        vrac: Number(itemStock.loose_quantity ?? 0),
        total: Number(itemStock.quantity ?? 0),
      }
    : null;

  const saisie: SaisieQuantite = {
    conditionnement: newItemPackaging,
    contenants: newItem.counted_package_quantity ?? null,
    vrac: newItemPackaging
      ? (newItem.counted_loose_quantity ?? null)
      : (newItem.quantity_counted ?? null),
  };
  const recap = resumeConversion(saisie, "comptez");
  // L'écart se lit PENDANT la saisie : c'est lui qui dit s'il faut recompter,
  // et le découvrir une ligne plus bas est déjà trop tard.
  const ecartEnCours =
    attendu && (saisie.contenants != null || saisie.vrac != null)
      ? ecartDuComptage(newItemPackaging, attendu, saisie)
      : null;

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        // L'organisation vient du contexte d'`OrganizationChecker`,
        // qui ne rend ses enfants qu'une fois celle-ci chargée. La
        // redemander ici plaçait un `GET /organizations/` en tête
        // d'attente, avant la première requête utile de la page.
        if (organization) {
          const org = organization;

          // Fetch warehouses
          const warehousesResult = await getWarehouses(session.accessToken, org.id);
          if (warehousesResult.success && warehousesResult.data) {
            setWarehouses(warehousesResult.data);
          }

          // Fetch adjustments
          await fetchAdjustments(org.id);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.accessToken, organization?.id]);

  // Fetch adjustments with filters
  const perimetre = usePerimeter();
  const [perimeterValue, setPerimeterValue] = useState<PerimeterValue>({
    warehouse: null,
    user: null,
  });

  const fetchAdjustments = useCallback(async (orgId?: string) => {
    if (!session?.accessToken) return;
    const id = orgId || organization?.id;
    if (!id) return;

    const filters: any = { page: currentPage, page_size: pageSize };
    if (selectedStatus !== "all") filters.status = selectedStatus;
    if (searchQuery) filters.search = searchQuery;
    // ENTREPÔT SEUL : ni un transfert ni un ajustement ne se filtre par
    // utilisateur - ce sont des mouvements de marchandise, pas des journées de
    // travail. Le serveur applique la sémantique OU sur un transfert (source
    // OU destination) : le borner sur la seule source cacherait au magasinier
    // de destination ce qu'il doit réceptionner.
    {
      const scope = perimetre.effective({
        warehouse: perimeterValue.warehouse ?? undefined,
      });
      if (scope.warehouse) filters.warehouse = scope.warehouse;
    }

    const result = await getStockAdjustments(session.accessToken, id, filters);
    if (result.success && result.data) {
      setAdjustments(result.data.results);
      setTotalCount(result.data.count);
      setHasNext(result.data.next !== null);
      setHasPrevious(result.data.previous !== null);
    }
    // `perimetre` et l'entrepôt choisi EN DÉPENDANCE : sans eux, changer de
    // dépôt ne relance pas la requête, et le filtre est inerte - l'écran
    // annonce un périmètre qu'il n'a jamais appliqué.
  }, [
    session?.accessToken, organization?.id, currentPage, pageSize,
    selectedStatus, searchQuery, perimetre, perimeterValue.warehouse,
  ]);

  /**
   * Changer un filtre remet à la page 1.
   *
   * ⚠ Cette fonction était écrite pour cela et n'avait AUCUN appelant : les
   * trois filtres de la page posaient leur `setState` en direct. Depuis la
   * page 3, filtrer rendait donc « Aucun résultat » sur un écran qui en a -
   * un vide qui se lit comme une absence de données. La câbler, c'est traiter
   * le défaut qu'elle signalait.
   *
   * Générique : le périmètre n'est pas une chaîne, et c'est le filtre qu'on
   * oubliait le plus souvent.
   */
  const handleFilterChange = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Refetch when filters or page change
  useEffect(() => {
    if (organization) {
      fetchAdjustments();
    }
  }, [organization, fetchAdjustments]);

  /*
   * ┌────────────────────────────────────────────────────────────────────────┐
   * │ LE STOCK A QUITTÉ LE LIBELLÉ DES OPTIONS.                             │
   * │                                                                        │
   * │ Il s'y écrivait « (Stock: 0) » pour tout article absent de la première │
   * │ page de `stocks/by-warehouse/`, seule page que l'écran chargeait : un  │
   * │ rayon plein s'annonçait vide dans la liste déroulante. Le théorique se │
   * │ lit maintenant sous le sélecteur, relevé À L'UNITÉ sur la vraie ligne  │
   * │ de stock - donc juste, et à un seul endroit. Deux affichages du même   │
   * │ chiffre dont l'un peut mentir, c'est un de trop.                       │
   * └────────────────────────────────────────────────────────────────────────┘
   */
  const searchProducts = useCallback(
    async (query: string) => {
      if (!session?.accessToken || !organization) return [];
      return createProductSearchHandler(session.accessToken, organization.id, {
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
   * Le théorique de l'article choisi, dans l'entrepôt visé.
   *
   * Les dépendances sont PRIMITIVES : un objet reconstruit à chaque rendu
   * relancerait l'effet sans fin, sans erreur et sans rien à l'écran.
   */
  useEffect(() => {
    const produit = newItem.product;
    const depot = formData.warehouse;
    if (!session?.accessToken || !organization?.id || !produit || !depot) {
      setItemStock(null);
      return;
    }
    let vivant = true;
    getStocks(session.accessToken, organization.id, { warehouse: depot, product: produit }).then(
      res => {
        // Une réponse arrivée APRÈS un changement d'article ne doit pas se
        // ranger : elle décrirait le théorique du précédent, et l'écart entier
        // porterait sur le mauvais rayon.
        if (vivant) setItemStock(res.success && res.data?.length ? res.data[0] : null);
      }
    );
    return () => {
      vivant = false;
    };
  }, [newItem.product, formData.warehouse, session?.accessToken, organization?.id]);

  // Add item to adjustment
  const addItem = async () => {
    if (!newItem.product) {
      toast.error("Veuillez sélectionner un produit");
      return;
    }

    let product = products.find(p => p.id === newItem.product);
    if (!product && session?.accessToken && organization) {
      const res = await getProduct(session.accessToken, organization.id, newItem.product);
      const refus = messageDeRefus(res);
      if (refus) toast.error(refus);
      if (res.success && res.data) {
        product = res.data;
        setProducts(prev => (prev.some(p => p.id === product!.id) ? prev : [...prev, product!]));
      }
    }
    if (!product) {
      toast.error("Produit introuvable");
      return;
    }

    // L'attendu vient de la ligne de stock DEMANDÉE À L'UNITÉ, jamais d'une
    // liste paginée : voir l'encadré sur `itemStock`. Sa part vrac est LUE,
    // jamais redécoupée au facteur du jour.
    const expectedQty = attendu?.total ?? 0;
    const expectedLoose = attendu?.vrac ?? 0;

    const packaging = getPackaging(product);
    const packages = newItem.counted_package_quantity ?? 0;
    const loose = newItem.counted_loose_quantity ?? 0;

    // ┌──────────────────────────────────────────────────────────────────────┐
    // │ ZÉRO EST UNE VALEUR ICI, ET UNE VALEUR QUI COMPTE.                  │
    // │                                                                      │
    // │ « 0 compté face à un théorique de 10 » est précisément l'écart qu'un │
    // │ ajustement existe pour écrire, et c'était REFUSÉ : le contrôle       │
    // │ demandait `packages > 0 || loose > 0`. Un rayon vidé par un vol ne   │
    // │ pouvait donc pas s'enregistrer. Ce qui est refusé est la saisie      │
    // │ VIDE - deux champs blancs ne disent pas « rien en rayon », ils ne    │
    // │ disent rien.                                                         │
    // │                                                                      │
    // │ Au passage, le chemin SANS conditionnement n'avait aucun contrôle du │
    // │ tout : un comptage jamais tapé partait à zéro, et l'écart valait     │
    // │ tout le rayon.                                                       │
    // └──────────────────────────────────────────────────────────────────────┘
    const erreurs = verifierQuantite(
      {
        conditionnement: packaging,
        contenants: newItem.counted_package_quantity ?? null,
        vrac: packaging
          ? (newItem.counted_loose_quantity ?? null)
          : (newItem.quantity_counted ?? null),
      },
      { zeroAccepte: true }
    );
    setNewItemErrors(erreurs);
    if (Object.keys(erreurs).length > 0) return;

    const ligne = {
      product: newItem.product,
      // Produit vendu par contenant : on transmet la saisie telle quelle,
      // le serveur recompose le total. Sinon, quantité simple d'origine.
      ...(packaging
        ? {
            counted_package_quantity: packages,
            // Une valeur restée d'un article précédent ne doit pas partir : sur
            // un article vendu en gros seul, le champ n'existe pas à l'écran.
            counted_loose_quantity: packaging.packageOnly ? 0 : loose,
          }
        // `?? 0` sans risque : `verifierQuantite` vient de refuser la saisie
        // vide, donc la valeur a été tapée - fût-elle zéro.
        : { quantity_counted: newItem.quantity_counted ?? 0 }),
      quantity_expected: expectedQty,
      expected_loose_quantity: expectedLoose,
      unit_cost: parseFloat(product.cost_price) || 0,
    };

    setFormData({
      ...formData,
      // Le même article deux fois n'est pas deux comptages : le second REMPLACE
      // le premier. Deux lignes sur le même produit donneraient deux écarts
      // contradictoires sur le même rayon, et le serveur appliquerait le
      // dernier sans que rien ne le dise.
      items: [...formData.items.filter(i => i.product !== newItem.product), ligne],
    });

    setNewItem({ product: "", quantity_expected: 0, unit_cost: 0 });
    setNewItemErrors({});
  };

  // Remove item from adjustment
  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !organization?.id) return;

    if (!formData.warehouse) {
      toast.error("Veuillez sélectionner un entrepôt");
      return;
    }

    // L'explication est OBLIGATOIRE, comme sur le terminal. Le serveur
    // l'accepte vide, mais un ajustement fait bouger du stock sans autre pièce
    // justificative, et le TYPE seul ne dit pas pourquoi.
    if (!formData.reason?.trim()) {
      toast.error("Expliquez la raison de cet ajustement");
      return;
    }

    if (formData.items.length === 0) {
      toast.error("Veuillez ajouter au moins un article");
      return;
    }

    setIsSubmitting(true);

    try {
      // `expected_loose_quantity` ne sert qu'à l'aperçu de l'écart : le serveur
      // relève lui-même la part vrac du stock, il n'accepte pas ce champ.
      const payload: CreateStockAdjustmentData = {
        ...formData,
        items: formData.items.map(({ expected_loose_quantity: _ignored, ...item }) => item),
      };
      const result = await createStockAdjustment(session.accessToken, organization.id, payload);
      if (result.success) {
        toast.success("Ajustement créé avec succès");
        setShowCreateDialog(false);
        fetchAdjustments();
        setFormData({
          warehouse: "",
          adjustment_type: "count",
          reason: "",
          items: [],
        });
      } else {
        toast.error(result.message || "Erreur lors de la création");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle adjustment actions
  const handleAction = async (adjustmentId: string, action: "approve" | "reject") => {
    if (!session?.accessToken || !organization?.id) return;

    setIsSubmitting(true);

    try {
      let result;
      if (action === "approve") {
        result = await approveStockAdjustment(session.accessToken, organization.id, adjustmentId);
      } else {
        result = await rejectStockAdjustment(session.accessToken, organization.id, adjustmentId);
      }

      if (result?.success) {
        toast.success(result.message);
        fetchAdjustments();
      } else {
        toast.error(result?.message || "Erreur lors de l'action");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
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
            <h1 className="text-2xl font-bold text-gray-900">Ajustements de stock</h1>
            <p className="text-sm text-gray-500 mt-1">
              Corrections et inventaires ({totalCount} au total)
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouvel ajustement
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher par référence..."
            value={searchQuery}
            onChange={e => handleFilterChange(setSearchQuery, e.target.value)}
            className="pl-9"
          />
        </div>

        <PerimeterFilters
          value={perimeterValue}
          onChange={v => handleFilterChange(setPerimeterValue, v)}
          withUser={false}
        />

        <Select value={selectedStatus} onValueChange={v => handleFilterChange(setSelectedStatus, v)}>
          <SelectTrigger className="max-w-max">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Adjustments List */}
      {adjustments.length === 0 ? (
        <Card className="p-0">
          <CardContent className="p-8 text-center">
            <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun ajustement</h3>
            <p className="text-sm text-gray-500 mb-4">
              Créez un ajustement pour corriger les niveaux de stock
            </p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Créer un ajustement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {adjustments.map(adjustment => {
            const statusConfig = STATUS_CONFIG[adjustment.status];
            const StatusIcon = statusConfig.icon;
            const typeLabel =
              ADJUSTMENT_TYPES.find(t => t.value === adjustment.adjustment_type)?.label ||
              adjustment.adjustment_type;

            return (
              <Card key={adjustment.id} className="p-0">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Icon */}
                      <div className={`p-2 rounded-lg ${statusConfig.color}`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-gray-900">{adjustment.reference}</h3>
                          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                          <Badge variant="outline">{typeLabel}</Badge>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <WarehouseIcon className="h-4 w-4" />
                          <span>{adjustment.warehouse_name}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span>{adjustment.items_count} article(s)</span>
                          <span>Créé le {formatDate(adjustment.created_at)}</span>
                          {adjustment.created_by_name && (
                            <span>Par: {adjustment.created_by_name}</span>
                          )}
                          {adjustment.total_difference && (
                            <span
                              className={
                                parseFloat(adjustment.total_difference) >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              Différence: {formatPrice(adjustment.total_difference)}
                            </span>
                          )}
                        </div>

                        {adjustment.reason && (
                          <p className="mt-2 text-sm text-gray-500 bg-gray-50 p-2 rounded">
                            {adjustment.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/dashboard/stock/adjustments/${adjustment.id}`)
                          }
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Voir détails
                        </DropdownMenuItem>

                        {adjustment.status === "draft" && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleAction(adjustment.id, "approve")}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approuver et appliquer
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAction(adjustment.id, "reject")}
                              className="text-red-600"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Rejeter
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6">
              <DataPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                hasNext={hasNext}
                hasPrevious={hasPrevious}
              />
            </div>
          )}
        </div>
      )}

      {/* Create Adjustment Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvel ajustement de stock</DialogTitle>
            <DialogDescription>
              Corrigez les niveaux de stock après un inventaire ou une perte
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Entrepôt *</Label>
                <SearchableSelectAsyncWithEmpty
                  value={formData.warehouse || null}
                  onValueChange={value =>
                    setFormData({ ...formData, warehouse: value || "", items: [] })
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
                <Label>Type d'ajustement *</Label>
                <Select
                  value={formData.adjustment_type}
                  onValueChange={value =>
                    setFormData({ ...formData, adjustment_type: value as AdjustmentType })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ADJUSTMENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              {/* OBLIGATOIRE, comme sur le terminal, qui bloquait déjà dessus.
                  Le serveur l'accepte vide (`reason = TextField(blank=True)`),
                  mais un ajustement fait bouger du stock sans autre pièce
                  justificative : le TYPE dit « comptage » ou « casse », il ne
                  dit pas POURQUOI. Les deux surfaces demandaient deux choses
                  différentes pour le même acte. */}
              <Label htmlFor="adjustment_reason">Explication *</Label>
              <Textarea
                id="adjustment_reason"
                value={formData.reason}
                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Comptage du 30/08, casse en réserve..."
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Elle figure sur la pièce et dans l&apos;historique.
              </p>
            </div>

            {/*
              LE BOUTON SUIT LES CHAMPS QU'IL VALIDE.

              Il était posé SUR LA MÊME LIGNE que le sélecteur de produit, donc
              AU-DESSUS du bloc de comptage qu'il enregistre : on lisait
              « produit, ajouter », puis on découvrait des cases en dessous.
              L'ordre de lecture doit être l'ordre du geste - choisir, compter,
              ajouter.
            */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <Label>Compter un article</Label>
                {formData.items.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {formData.items.length} déjà au comptage
                  </span>
                )}
              </div>

              {!formData.warehouse ? (
                <p className="text-sm text-muted-foreground">
                  Choisissez d&apos;abord l&apos;entrepôt : c&apos;est lui qui dit ce que le
                  système attend.
                </p>
              ) : (
                <>
                  <SearchableSelectAsync
                    onSearch={searchProducts}
                    value={newItem.product || undefined}
                    onValueChange={value => {
                      setNewItem({
                        ...newItem,
                        product: value,
                        quantity_counted: undefined,
                        counted_package_quantity: undefined,
                        counted_loose_quantity: undefined,
                      });
                      setNewItemErrors({});
                    }}
                    placeholder="Sélectionner un produit"
                    searchPlaceholder="Rechercher un produit..."
                    className="w-full"
                  />

                  {!newItem.product ? (
                    <p className="text-sm text-muted-foreground">
                      Cherchez un article par son nom, son code ou son code-barres.
                    </p>
                  ) : (
                    <>
                      {/* Le théorique est RELEVÉ, jamais saisi : le laisser
                          modifiable permettrait d'écrire un écart qui n'existe
                          pas. Ses deux compteurs sont LUS sur la ligne de
                          stock, jamais redécoupés depuis leur somme. */}
                      <p className="text-xs text-muted-foreground">
                        {attendu ? (
                          <>
                            Le système attend :{" "}
                            <span className="font-medium text-foreground">
                              {afficherPartage(newItemPackaging, attendu)}
                            </span>
                          </>
                        ) : (
                          "Aucune ligne de stock dans cet entrepôt : le théorique est à zéro."
                        )}
                      </p>

                      <PackagedQuantityInput
                        packaging={newItemPackaging}
                        packages={newItem.counted_package_quantity}
                        loose={newItem.counted_loose_quantity}
                        quantity={newItem.quantity_counted}
                        onChange={next => {
                          setNewItem({
                            ...newItem,
                            counted_package_quantity: next.packages,
                            counted_loose_quantity: next.loose,
                            quantity_counted: next.quantity,
                          });
                          setNewItemErrors({});
                        }}
                        recap={recap}
                        erreurs={newItemErrors}
                        simpleLabel="Quantité comptée"
                        idPrefix="counted"
                      />

                      {ecartEnCours && (
                        <div className="flex items-center justify-between rounded-md border px-3 py-2">
                          <span className="text-sm text-muted-foreground">Écart constaté</span>
                          <span
                            className={`text-sm font-medium tabular-nums ${
                              ecartEnCours.signe < 0
                                ? "text-destructive"
                                : ecartEnCours.signe > 0
                                  ? "text-success"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {/* Un écart NUL reste neutre : le peindre en vert
                                ferait du vert la couleur ordinaire de l'écran,
                                et on ne verrait plus le vrai. */}
                            {ecartEnCours.signe === 0 ? "Conforme" : ecartEnCours.texte}
                          </span>
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={addItem}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter au comptage
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Items List */}
            {formData.items.length > 0 && (
              <div className="border rounded-lg divide-y">
                {formData.items.map((item, index) => {
                  const product = products.find(p => p.id === item.product);
                  const packaging = getPackaging(product);
                  // Le total n'est recomposé ici que pour l'aperçu : c'est le
                  // serveur qui fait foi sur la quantité enregistrée.
                  const counted = packaging
                    ? (item.counted_package_quantity ?? 0) * packaging.factor +
                      (item.counted_loose_quantity ?? 0)
                    : (item.quantity_counted ?? 0);
                  const diff = counted - item.quantity_expected;
                  // Partage attendu LU sur le stock, jamais redivisé depuis son
                  // total : c'est lui qui rend l'écart par canal exact.
                  const expectedSplit = packaging
                    ? splitPackaged(
                        item.quantity_expected,
                        item.expected_loose_quantity ?? 0,
                        packaging.factor
                      )
                    : null;
                  return (
                    <div key={index} className="flex items-center justify-between p-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{product?.name}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                          <span>
                            Attendu:{" "}
                            {packaging && expectedSplit
                              ? formatPackagedSplit(
                                  packaging,
                                  expectedSplit.packages,
                                  expectedSplit.loose
                                )
                              : item.quantity_expected}
                          </span>
                          <span>
                            Compté:{" "}
                            {packaging
                              ? formatPackagedSplit(
                                  packaging,
                                  item.counted_package_quantity ?? 0,
                                  item.counted_loose_quantity ?? 0
                                )
                              : counted}
                          </span>
                          <span
                            className={
                              diff > 0
                                ? "text-green-600 font-medium"
                                : diff < 0
                                  ? "text-red-600 font-medium"
                                  : ""
                            }
                          >
                            Diff:{" "}
                            {packaging && expectedSplit
                              ? formatPackagedDifference(
                                  packaging,
                                  (item.counted_package_quantity ?? 0) -
                                    expectedSplit.packages,
                                  (item.counted_loose_quantity ?? 0) -
                                    expectedSplit.loose
                                )
                              : `${diff > 0 ? "+" : ""}${diff}`}
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting || formData.items.length === 0 || !formData.reason?.trim()
                }
                className="bg-orange-500 hover:bg-orange-600"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer l'ajustement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
