"use client";

import { flattenDrfErrors } from "@/lib/api/drf-error";
import { Customer, getCustomers, createCustomer, CreateCustomerData } from "@/actions/contacts.actions";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import { getProducts, Product } from "@/actions/products.actions";
import { getLockedProducts, LockedProductsResponse } from "@/actions/inventory.actions";
import { getOrganizationCurrencies, OrganizationCurrency, getCustomerLoyalty, CustomerLoyalty, getLoyaltyProgram, LoyaltyProgram, getOrganizationSettings, OrganizationSettings } from "@/actions/settings.actions";
import {
  closeSession,
  CreatePaymentData,
  createSale,
  CreateSaleItemData,
  getCurrentSession,
  getPaymentMethods,
  markReceiptPrinted,
  PaymentMethod,
  RegisterSession,
} from "@/actions/sales.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Building2,
  Check,
  CreditCard,
  Loader2,
  LogOut,
  Minus,
  Package,
  MapPin,
  Pencil,
  Phone,
  Tag,
  Plus,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  User,
  UserPlus,
  X,
  Printer,
  Receipt,
  FileText,
  HandCoins,
  CircleDollarSign,
  Star,
  Gift,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatPoints, formatPrice, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatValue } from "@/components/shared/StatValue";
import { ProductThumb } from "@/components/products/product-thumb";
import { PackagedSelection, QuantityPicker } from "@/components/sales/quantity-picker";
import { ChannelAvailability, remainingChannels } from "@/lib/packaging";
import { unpackStock } from "@/actions/stock.actions";
import { usePermissions } from "@/components/auth/permissions-provider";
import { pluralizeUnit } from "@/lib/units";
import { useCurrency } from "@/components/providers/currency-provider";
import {
  assignPdfToPrintWindow,
  closePrintTabIfBlank,
  generateReceiptPdfUrl,
  openPrintTab,
  ReceiptData,
} from "@/lib/receipt-printer";

/** Aligné sur le défaut backend (`max_sale_discount_percent` dans les paramètres org). */
const MAX_SALE_DISCOUNT_PERCENT = 50;

function clampSaleDiscountPercent(value: number): number {
  const n = Number.isFinite(value) ? value : 0;
  return Math.min(MAX_SALE_DISCOUNT_PERCENT, Math.max(0, n));
}

interface CartItem {
  product: Product;
  /**
   * Quantité totale en unité de détail - miroir exact du champ backend.
   * Pour un produit vendu en gros, elle vaut
   * `packageQuantity × contenu + part vendue à l'unité`.
   */
  quantity: number;
  /** Conditionnements entiers sur cette ligne (0 pour une vente à l'unité) */
  packageQuantity: number;
  unit_price: number;
  discount_percentage: number;
}

/** Contenu d'un conditionnement, ou `null` si le produit se vend à l'unité. */
function packagingFactorOf(product: Product): number | null {
  if (!product.selling_mode || product.selling_mode === "retail_only") return null;
  return product.units_per_package || null;
}

/** Part de la ligne vendue à l'unité - dérivée, jamais stockée. */
function looseQuantityOf(item: CartItem): number {
  const factor = packagingFactorOf(item.product);
  if (!factor || !item.packageQuantity) return item.quantity;
  return item.quantity - item.packageQuantity * factor;
}


/**
 * Bouton d'édition de la quantité d'une ligne vendue en gros.
 *
 * Il n'édite rien lui-même : il sert d'ancre au même sélecteur que l'ajout,
 * pour que modifier une ligne et la créer soient un seul geste appris une fois.
 * Les produits à l'unité conservent le compteur plus / moins.
 */
function PackagedQuantityTrigger({
  item,
  onClick,
  open,
  className,
  ...anchorProps
}: Omit<React.ComponentProps<"button">, "onClick"> & {
  item: CartItem;
  onClick: () => void;
  open: boolean;
}) {
  const packLabel = item.product.packaging_unit_symbol || "pqt";
  const unitLabel = item.product.unit_symbol || "u";
  const loose = looseQuantityOf(item);

  return (
    <button
      // `PopoverAnchor asChild` pose sa ref ici : sans ce passe-plat, le
      // popover n'a pas d'ancre et ne s'affiche nulle part sur desktop.
      {...anchorProps}
      type="button"
      data-qty-anchor
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={`Modifier la quantité de ${item.product.name}`}
      className={cn(
        "flex h-10 items-center gap-2 rounded-lg border px-2.5 text-sm font-semibold tabular-nums outline-none transition-[background-color,border-color,transform] focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-[0.96]",
        open
          ? "border-orange-400 bg-orange-50 text-slate-900"
          : "border-slate-200 bg-white text-slate-900 hover:border-orange-300 hover:bg-orange-50/50",
        className
      )}
    >
      {item.packageQuantity > 0 ? (
        <span>
          {item.packageQuantity}
          <span className="ml-0.5 text-xs font-medium text-slate-500">{packLabel}</span>
        </span>
      ) : null}
      {item.packageQuantity > 0 && loose > 0 ? (
        <span className="text-slate-300">+</span>
      ) : null}
      {loose > 0 || item.packageQuantity === 0 ? (
        <span>
          {loose}
          <span className="ml-0.5 text-xs font-medium text-slate-500">{unitLabel}</span>
        </span>
      ) : null}
      <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-400" />
    </button>
  );
}

/**
 * Édition d'une ligne du panier : quantité et remise, par le même sélecteur
 * que l'ajout.
 *
 * Les produits vendus à l'unité gardent les boutons moins / plus autour du
 * libellé, où l'ajustement de 1 ne demande aucune réflexion. Les produits
 * vendus en gros n'en ont pas : « plus un » y serait ambigu, une unité ou un
 * conditionnement.
 */
function CartLineQuantityEditor({
  item,
  surface,
  openKey,
  onOpenKeyChange,
  maxBase,
  looseAvailable,
  sealedAvailable,
  onUnpack,
  maxDiscountPercent,
  onConfirm,
  onRemove,
  onStep,
}: {
  item: CartItem;
  surface: "d" | "m";
  openKey: string | null;
  onOpenKeyChange: (key: string | null) => void;
  maxBase: number | null;
  looseAvailable: number | null;
  sealedAvailable: number | null;
  onUnpack?: (packages: number) => Promise<void>;
  maxDiscountPercent: number;
  onConfirm: (selection: PackagedSelection) => void;
  onRemove: () => void;
  onStep: (delta: number) => void;
}) {
  const key = `${surface}:${item.product.id}`;
  const isOpen = openKey === key;
  const packaged = packagingFactorOf(item.product) !== null;

  return (
    <div className="flex items-center gap-2">
      {!packaged ? (
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 transition-transform active:scale-[0.96]"
          onClick={() => onStep(-1)}
          aria-label="Retirer une unité"
        >
          <Minus className="h-4 w-4" />
        </Button>
      ) : null}

      <QuantityPicker
        product={item.product}
        open={isOpen}
        onOpenChange={(next) => onOpenKeyChange(next ? key : null)}
        initial={{ packages: item.packageQuantity, loose: looseQuantityOf(item) }}
        maxBase={maxBase}
        looseAvailable={looseAvailable}
        sealedAvailable={sealedAvailable}
        onUnpack={onUnpack}
        discountPercent={item.discount_percentage}
        maxDiscountPercent={maxDiscountPercent}
        onConfirm={onConfirm}
        onRemove={onRemove}
        submitLabel="Mettre à jour"
      >
        <PackagedQuantityTrigger
          item={item}
          open={isOpen}
          onClick={() => onOpenKeyChange(isOpen ? null : key)}
        />
      </QuantityPicker>

      {!packaged ? (
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 transition-transform active:scale-[0.96]"
          onClick={() => onStep(1)}
          aria-label="Ajouter une unité"
        >
          <Plus className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

/** Libellé lisible d'une ligne : « 2 paquets + 3 bouteilles ». */
function describeCartLine(item: CartItem): string {
  const factor = packagingFactorOf(item.product);
  const retail = item.product.unit_name || "unité";
  if (!factor) return `${item.quantity} ${pluralizeUnit(retail, item.quantity)}`;

  const pack = item.product.packaging_unit_name || "conditionnement";
  const loose = looseQuantityOf(item);
  const parts: string[] = [];
  if (item.packageQuantity > 0) {
    parts.push(`${item.packageQuantity} ${pluralizeUnit(pack, item.packageQuantity)}`);
  }
  if (loose > 0 || parts.length === 0) {
    parts.push(`${loose} ${pluralizeUnit(retail, loose)}`);
  }
  return parts.join(" + ");
}

/**
 * Arrondi d'une saisie de points au centième.
 *
 * Les points sont fractionnaires : tronquer à l'entier interdisait au client
 * d'utiliser le solde qu'il vient de gagner (0,58 point devenait 0).
 */
function roundPoints(value: number): number {
  return Math.floor(value * 100) / 100;
}

export default function POSPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const justAddedTimerRef = useRef<number | null>(null);
  const { currency: defaultCurrency } = useCurrency();
  // Même droit que la saisie d'un mouvement de stock : ouvrir un conditionnement
  // est un mouvement, il est simplement déclenché depuis la caisse.
  const { hasPermission } = usePermissions();
  const canCreateStockMovement = hasPermission("stock_movements.create");

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [currentSession, setCurrentSession] = useState<RegisterSession | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [globalDiscountAmount, setGlobalDiscountAmount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // Produit dont le sélecteur de quantité est ouvert depuis la grille.
  const [qtyPickerProductId, setQtyPickerProductId] = useState<string | null>(null);
  // Ligne de panier dont le sélecteur est ouvert (édition), par id produit.
  const [editingLineProductId, setEditingLineProductId] = useState<string | null>(null);
  // Ligne qui vient d'être ajoutée : sert au retour visuel bref sur la carte.
  const [justAddedProductId, setJustAddedProductId] = useState<string | null>(null);
  // Confirmation avant de quitter la caisse avec un panier non vide.
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Payment dialog
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // Garde anti double-soumission : synchrone, vérifié AVANT toute attente réseau.
  // useState seul ne suffit pas car React batche les mises à jour et un double-clic
  // rapide peut déclencher 2 fois `handlePayment` avant le re-render.
  const submittingRef = useRef(false);
  const [isGeneratingProforma, setIsGeneratingProforma] = useState(false);
  const [isCreditSale, setIsCreditSale] = useState(false);

  // Multi-currency state
  const [orgCurrencies, setOrgCurrencies] = useState<OrganizationCurrency[]>([]);
  // Devise de la facture (devise de la vente) - défaut = devise principale.
  const [invoiceCurrency, setInvoiceCurrency] = useState<string>("");
  // Devise de la monnaie rendue (choix caissier).
  const [changeCurrency, setChangeCurrency] = useState<string>("");
  // Règlements (encaissement fractionné multi-devise) : une ligne par tender.
  type Tender = { id: string; method: string; currency: string; amount: string; reference: string };
  const [tenders, setTenders] = useState<Tender[]>([]);

  // Customer dialog
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDialogMode, setCustomerDialogMode] = useState<"search" | "create">("search");
  const [newCustomerData, setNewCustomerData] = useState<CreateCustomerData>({
    name: "",
    phone: "",
    customer_type: "individual",
  });
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  // Mobile cart toggle
  const [showMobileCart, setShowMobileCart] = useState(false);

  // Close session dialog
  const [showCloseSessionDialog, setShowCloseSessionDialog] = useState(false);
  const [isClosingSession, setIsClosingSession] = useState(false);

  // Loyalty points
  const [customerLoyalty, setCustomerLoyalty] = useState<CustomerLoyalty | null>(null);
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null);
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);

  // Inventory lock state
  const [lockedProductIds, setLockedProductIds] = useState<Set<string>>(new Set());
  const [activeInventorySessions, setActiveInventorySessions] = useState<LockedProductsResponse['active_sessions']>([]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          // Check for active session
          const sessionResult = await getCurrentSession(session.accessToken, org.id);
          if (!sessionResult.success) {
            toast.error("Aucune session de caisse ouverte");
            router.push("/dashboard/sales/registers");
            return;
          }
          setCurrentSession(sessionResult.data!);

          // Fetch products, customers, payment methods, currencies, locked products
          const posWarehouseId = sessionResult.data?.warehouse || undefined;
          const [productsResult, customersResult, paymentMethodsResult, currenciesResult, lockedResult] = await Promise.all([
            getProducts(session.accessToken, org.id, {
              is_active: true,
              in_stock: true,
              ...(posWarehouseId ? { warehouse: posWarehouseId } : {}),
            }),
            getCustomers(session.accessToken, org.id),
            getPaymentMethods(session.accessToken, org.id, { is_active: true }),
            getOrganizationCurrencies(session.accessToken, org.id),
            getLockedProducts(session.accessToken, org.id),
          ]);

          if (productsResult.success && productsResult.data) {
            setProducts(productsResult.data.results || []);
          } else {
            toast.error(productsResult.message || "Erreur lors du chargement des produits");
          }
          if (customersResult.success && customersResult.data) {
            setCustomers(customersResult.data.results || []);
          }
          if (paymentMethodsResult.success && paymentMethodsResult.data) {
            setPaymentMethods(paymentMethodsResult.data);
          }
          if (currenciesResult.success && currenciesResult.data) {
            setOrgCurrencies(currenciesResult.data);
          }

          // Set locked products from active inventory sessions
          if (lockedResult.success && lockedResult.data) {
            setLockedProductIds(new Set(lockedResult.data.locked_product_ids));
            setActiveInventorySessions(lockedResult.data.active_sessions);
            if (lockedResult.data.has_active_inventory) {
              toast.warning(
                `Inventaire en cours: ${lockedResult.data.active_sessions.length} session(s) active(s). Certains produits sont bloqués.`,
                { duration: 5000 }
              );
            }
          }

          // Fetch loyalty program and org settings
          const [loyaltyResult, settingsResult] = await Promise.all([
            getLoyaltyProgram(session.accessToken, org.id),
            getOrganizationSettings(session.accessToken, org.id),
          ]);
          if (loyaltyResult.success && loyaltyResult.data) {
            setLoyaltyProgram(loyaltyResult.data);
          }
          if (settingsResult.success && settingsResult.data) {
            setOrgSettings(settingsResult.data);
          }
        }
      } catch (error) {
        console.error("Error fetching POS data:", error);
        toast.error("Erreur lors du chargement");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.accessToken, router]);

  // Focus search on load
  useEffect(() => {
    if (!isLoading && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isLoading]);

  // Load customer loyalty points when customer is selected
  useEffect(() => {
    const loadCustomerLoyalty = async () => {
      if (!session?.accessToken || !organization || !selectedCustomer) {
        setCustomerLoyalty(null);
        setUsePoints(false);
        setPointsToUse(0);
        return;
      }
      try {
        const result = await getCustomerLoyalty(session.accessToken, organization.id, selectedCustomer.id);
        if (result.success && result.data) {
          setCustomerLoyalty(result.data);
        } else {
          setCustomerLoyalty(null);
        }
      } catch (error) {
        console.error("Error loading customer loyalty:", error);
        setCustomerLoyalty(null);
      }
    };
    loadCustomerLoyalty();
  }, [session?.accessToken, organization, selectedCustomer]);

  // Get available stock for a product (considering what's already in cart)
  const getAvailableStock = (product: Product) => {
    return product.stock_quantity ?? 0;
  };

  // Get remaining stock (available minus what's in cart)
  const getRemainingStock = (product: Product) => {
    const available = getAvailableStock(product);
    const inCart = cart.find(item => item.product.id === product.id)?.quantity || 0;
    return available - inCart;
  };

  /** Quantité max qu’on peut encore ajouter au panier (respect du stock). */
  const getMaxAddableQty = (product: Product) => {
    if (!product.track_inventory || product.allow_negative_stock) return 9999;
    return Math.max(0, getRemainingStock(product));
  };

  const canAddProductToCart = (product: Product) => {
    if (lockedProductIds.has(product.id)) return false;
    return getMaxAddableQty(product) > 0;
  };

  /**
   * Sortie de la caisse vers la liste des caisses.
   *
   * Destination fixe plutôt que `router.back()` : l'historique peut venir
   * d'un encaissement ou d'un rechargement, et la liste des caisses est le
   * parent réel de cet écran (c'est déjà là que la page redirige quand aucune
   * session n'est ouverte). Le panier vit en mémoire : partir sans prévenir le
   * perdrait, d'où la confirmation dès qu'il contient quelque chose.
   */
  const leavePos = () => {
    if (cart.length > 0) {
      setShowLeaveDialog(true);
      return;
    }
    router.push("/dashboard/sales/registers");
  };

  /** Retour visuel bref sur la carte qui vient d'alimenter le panier. */
  const flashAdded = (productId: string) => {
    if (justAddedTimerRef.current) window.clearTimeout(justAddedTimerRef.current);
    setJustAddedProductId(productId);
    justAddedTimerRef.current = window.setTimeout(() => setJustAddedProductId(null), 700);
  };

  useEffect(() => {
    return () => {
      if (justAddedTimerRef.current) window.clearTimeout(justAddedTimerRef.current);
    };
  }, []);

  /**
   * Ajoute une saisie « X conditionnements + Y unités » au panier.
   *
   * Les deux parts restent distinctes jusqu'au serveur : lui seul décide
   * d'ouvrir un conditionnement. La quantité totale n'est qu'un miroir local
   * de `PackagingService.to_base`.
   */
  const addToCart = (product: Product, selection: PackagedSelection) => {
    const factor = packagingFactorOf(product);
    const packages = factor ? Math.max(0, Math.floor(selection.packages)) : 0;
    const loose = Math.max(0, Math.floor(selection.loose));
    const qty = factor ? packages * factor + loose : loose;

    if (qty < 1) {
      toast.error("Quantité invalide");
      return;
    }

    if (lockedProductIds.has(product.id)) {
      const invSession = activeInventorySessions[0];
      toast.error(
        `"${product.name}" est bloqué par un inventaire en cours (${invSession?.reference || "Inventaire"}). Veuillez attendre la fin de l'inventaire.`,
        { duration: 5000 }
      );
      return;
    }

    const available = getAvailableStock(product);
    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    const currentQty = existingIndex >= 0 ? cart[existingIndex].quantity : 0;

    if (product.track_inventory && !product.allow_negative_stock && currentQty + qty > available) {
      toast.warning(
        `Stock insuffisant pour "${product.name}". Disponible: ${available}, déjà au panier: ${currentQty}.`,
        { duration: 4000 }
      );
      return;
    }

    // Fusion avec une ligne existante : le sélecteur a validé le scellé pour sa
    // propre saisie, mais la somme des deux lignes peut dépasser ce qui reste.
    // Sans ce contrôle, le refus n'arriverait qu'au 400 de l'encaissement.
    const sealedLeft = addableSealed(product);
    if (existingIndex >= 0 && packages > 0 && sealedLeft !== null && packages > sealedLeft) {
      const packageWord = pluralizeUnit(
        product.packaging_unit_name || "conditionnement",
        sealedLeft
      );
      toast.warning(
        `"${product.name}" : il ne reste que ${sealedLeft} ${packageWord} scellé${sealedLeft > 1 ? "s" : ""} en tenant compte du panier.`,
        { duration: 5000 }
      );
      return;
    }

    if (existingIndex >= 0) {
      const newCart = [...cart];
      const line = newCart[existingIndex];
      newCart[existingIndex] = {
        ...line,
        quantity: line.quantity + qty,
        packageQuantity: line.packageQuantity + packages,
      };
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          product,
          quantity: qty,
          packageQuantity: packages,
          unit_price: parseFloat(product.selling_price || "0"),
          discount_percentage: 0,
        },
      ]);
    }

    flashAdded(product.id);
    setSearchQuery("");
    setSearchResults([]);
  };

  /**
   * Remplace la saisie d'une ligne existante par « X conditionnements +
   * Y unités ». Le sélecteur a déjà borné la valeur au stock ; ce garde-fou
   * couvre le cas où le panier a bougé pendant que la feuille était ouverte.
   */
  const setCartLineSelection = (index: number, selection: PackagedSelection) => {
    const item = cart[index];
    if (!item) return;

    const factor = packagingFactorOf(item.product);
    const packages = factor ? Math.max(0, Math.floor(selection.packages)) : 0;
    const loose = Math.max(0, Math.floor(selection.loose));
    const nextQuantity = factor ? packages * factor + loose : loose;

    if (nextQuantity < 1) {
      toast.error("La ligne doit contenir au moins une unité");
      return;
    }

    const available = getAvailableStock(item.product);
    if (
      item.product.track_inventory &&
      !item.product.allow_negative_stock &&
      nextQuantity > available
    ) {
      toast.warning(
        `Stock insuffisant pour « ${item.product.name} ». Disponible : ${
          item.product.stock_display || available
        }.`,
        { duration: 4000 }
      );
      return;
    }

    const newCart = [...cart];
    newCart[index] = {
      ...item,
      packageQuantity: packages,
      quantity: nextQuantity,
      discount_percentage:
        selection.discountPercentage === undefined
          ? item.discount_percentage
          : clampSaleDiscountPercent(selection.discountPercentage),
    };
    setCart(newCart);
  };

  /**
   * Unités de détail encore ajoutables, `null` quand rien ne les borne
   * (produit non suivi, ou entrepôt qui tolère le stock négatif).
   */
  const addableBase = (product: Product): number | null => {
    if (!product.track_inventory || product.allow_negative_stock) return null;
    return Math.max(0, getRemainingStock(product));
  };

  /**
   * Ce que les deux canaux offrent encore, une fois retranché ce que le panier
   * consomme déjà. `null` quand le partage n'est pas connu (multi-entrepôts) :
   * le serveur reste seul juge, on n'invente pas un zéro bloquant.
   *
   * La simulation rejoue l'ordre du serveur (contenants scellés d'abord, puis
   * ouverture pour servir le détail), sans quoi deux lignes du même produit se
   * compteraient mal.
   */
  const addableChannels = (
    product: Product,
    ignoreCartLine = false
  ): ChannelAvailability => {
    const factor = packagingFactorOf(product);
    if (product.stock_loose === null || product.stock_loose === undefined) {
      return { sealed: null, loose: null };
    }
    const stock: ChannelAvailability = {
      sealed:
        product.stock_packages === null || product.stock_packages === undefined
          ? null
          : product.stock_packages,
      loose: parseFloat(product.stock_loose) || 0,
    };
    if (ignoreCartLine || !factor) return stock;

    const line = cart.find(item => item.product.id === product.id);
    if (!line) return stock;
    return remainingChannels(
      stock,
      { packages: line.packageQuantity, loose: looseQuantityOf(line) },
      factor
    );
  };

  const addableLoose = (product: Product, ignoreCartLine = false): number | null =>
    addableChannels(product, ignoreCartLine).loose;

  /**
   * Contenants encore scellés et donc réellement vendables en gros. Borne
   * absente si l'entrepôt tolère le découvert, comme le fait
   * `PackagingService.assert_sealed_available`.
   */
  const addableSealed = (product: Product, ignoreCartLine = false): number | null => {
    if (!product.track_inventory || product.allow_negative_stock) return null;
    return addableChannels(product, ignoreCartLine).sealed;
  };

  /** Relit le catalogue de l'entrepôt courant après un mouvement de stock. */
  const refreshProducts = async () => {
    if (!session?.accessToken || !organization) return;
    const result = await getProducts(session.accessToken, organization.id, {
      is_active: true,
      in_stock: true,
      ...(currentSession?.warehouse ? { warehouse: currentSession.warehouse } : {}),
    });
    if (result.success && result.data) {
      setProducts(result.data.results || []);
    }
  };

  /**
   * Ouvre des conditionnements depuis la caisse, quand le produit interdit le
   * déconditionnement automatique. Sans cela, le sélecteur renvoyait vers un
   * écran de stock qui n'offrait aucune action : impasse pour le caissier.
   *
   * `undefined` quand le droit manque ou qu'aucun entrepôt n'est rattaché à la
   * session : le sélecteur se contente alors d'expliquer le refus.
   */
  const unpackHandlerFor = (product: Product) => {
    if (!canCreateStockMovement || !currentSession?.warehouse) return undefined;
    if (product.allow_auto_unpacking !== false) return undefined;
    return async (packages: number) => {
      if (!session?.accessToken || !organization || !currentSession.warehouse) return;
      const result = await unpackStock(
        session.accessToken,
        organization.id,
        product.id,
        currentSession.warehouse,
        packages
      );
      if (!result.success) {
        toast.error(result.message || "Impossible d'ouvrir le conditionnement");
        return;
      }
      toast.success(`${product.name} : ${result.data?.stock_display ?? "stock mis à jour"}`);
      await refreshProducts();
    };
  };

  // Update cart item quantity
  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      newCart.splice(index, 1);
      setCart(newCart);
      return;
    }

    // Check stock when increasing
    if (delta > 0 && item.product.track_inventory && !item.product.allow_negative_stock) {
      const available = getAvailableStock(item.product);
      if (newQty > available) {
        toast.warning(
          `Stock insuffisant pour "${item.product.name}". Disponible: ${available}`,
          { duration: 4000 }
        );
        return;
      }
    }

    newCart[index].quantity = newQty;
    setCart(newCart);
  };

  // Remove item from cart
  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  // Arrondir à 2 décimales
  const r2 = (n: number) => Math.round(n * 100) / 100;
  // Tolérance de comparaison monétaire : absorbe l'erreur flottante résiduelle
  // après arrondi par devise. Une seule constante partagée par l'affichage ET
  // le bouton « Encaisser » pour qu'ils ne se contredisent jamais.
  const MONEY_EPS = 1e-6;

  // Calculate totals
  /**
   * Montant brut d'une ligne, miroir de `SaleItem.save()` côté serveur.
   *
   * Le prix d'un conditionnement n'est pas le prix unitaire multiplié par son
   * contenu : c'est justement l'intérêt commercial du gros. Une ligne mixte
   * additionne donc les deux tarifs. Le backend reste l'autorité : ce calcul
   * ne sert qu'à l'affichage avant validation.
   */
  const lineGross = (item: CartItem) => {
    const factor = packagingFactorOf(item.product);
    if (!factor || item.packageQuantity <= 0) {
      return r2(item.quantity * item.unit_price);
    }
    const packagePrice = parseFloat(item.product.wholesale_price || "0");
    return r2(
      item.packageQuantity * packagePrice + looseQuantityOf(item) * item.unit_price
    );
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + lineGross(item), 0);
  };

  const calculateItemDiscount = () => {
    return cart.reduce((sum, item) => {
      return sum + r2(lineGross(item) * item.discount_percentage / 100);
    }, 0);
  };

  const getMaxGlobalDiscountAmount = () => {
    return r2(calculateSubtotal() - calculateItemDiscount());
  };

  const calculateGlobalDiscountAmount = () => {
    const maxAllowed = getMaxGlobalDiscountAmount();
    return r2(Math.min(globalDiscountAmount, maxAllowed));
  };

  const getProductLocationLabel = (product: Product) => {
    const parts: string[] = [];
    if (product.stock_location?.trim()) parts.push(product.stock_location.trim());
    if (product.warehouse_name?.trim()) parts.push(product.warehouse_name.trim());
    return parts.length > 0 ? parts.join(" · ") : "-";
  };

  const calculateTax = () => {
    return cart.reduce((sum, item) => {
      if (!item.product.is_taxable) return sum;

      const itemTotal = lineGross(item);
      const itemDiscount = r2(itemTotal * item.discount_percentage / 100);
      const itemAfterDiscount = r2(itemTotal - itemDiscount);

      const taxRate = parseFloat(item.product.tax_rate?.toString() || '0');
      return sum + r2(itemAfterDiscount * taxRate / 100);
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const itemDiscount = calculateItemDiscount();
    const globalDiscountAmount = calculateGlobalDiscountAmount();
    const tax = calculateTax();
    return r2(subtotal - itemDiscount - globalDiscountAmount + tax);
  };

  /**
   * Remise obtenue en réglant une part de la vente en points, en devise
   * principale (`point_value` y est libellé).
   *
   * `calculateTotal()` reste volontairement **brut** : c'est lui qui plafonne le
   * nombre de points saisissables, un total déjà net rendrait le calcul
   * circulaire.
   */
  const calculateLoyaltyDiscount = () => {
    if (!usePoints || pointsToUse <= 0 || !loyaltyProgram?.is_active) return 0;
    const pointValue = loyaltyProgram.point_value ? parseFloat(loyaltyProgram.point_value) : 1;
    return r2(Math.min(pointsToUse * pointValue, calculateTotal()));
  };

  /** Ce que le client doit réellement, points déduits, en devise principale. */
  const calculateNetTotal = () => r2(calculateTotal() - calculateLoyaltyDiscount());

  // ---------------------------------------------------------------------------
  // Multi-devise : conversions basées sur OrganizationCurrency.exchange_rate
  // (= unités de devise principale pour 1 unité de cette devise ; principale = 1).
  // ---------------------------------------------------------------------------
  const getPrimaryCurrency = () => orgCurrencies.find(c => c.is_primary);
  const primaryCode = () => getPrimaryCurrency()?.currency_code || defaultCurrency.code;
  const rateOf = (code: string) => {
    const c = orgCurrencies.find(x => x.currency_code === code);
    const r = c ? parseFloat(c.exchange_rate) : 1;
    return r > 0 ? r : 1;
  };
  const symbolOf = (code: string) =>
    orgCurrencies.find(x => x.currency_code === code)?.currency_symbol || code;
  // Convertit un montant de la devise `from` vers la devise `to` (via la principale).
  const convertAmount = (amount: number, from: string, to: string) => {
    if (!amount || from === to) return amount;
    const inPrimary = amount * rateOf(from);
    return inPrimary / rateOf(to);
  };
  // Décimales physiques d'une devise (CDF = 0, USD/EUR = 2). Défaut 2 si inconnue.
  const decimalsOf = (code: string) => {
    const c = orgCurrencies.find(x => x.currency_code === code);
    return c ? c.currency_decimal_places : (defaultCurrency.decimal_places ?? 2);
  };
  // Arrondi d'un montant à la plus petite unité physique de sa devise.
  const roundMoney = (amount: number, code: string) => {
    const f = Math.pow(10, decimalsOf(code));
    return Math.round((amount + Number.EPSILON) * f) / f;
  };
  // Convertit un prix (depuis la principale) vers `to` puis arrondit à ses décimales.
  const convMoney = (amount: number, from: string, to: string) =>
    roundMoney(convertAmount(amount, from, to), to);
  // Formate un montant avec le bon nombre de décimales pour sa devise.
  const money = (amount: number, code?: string) => {
    const cur = code || saleCurrency();
    const formatted = new Intl.NumberFormat("fr-CD", {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimalsOf(cur),
    }).format(amount);
    return `${formatted} ${symbolOf(cur)}`;
  };
  // Devise de la vente (facture).
  const saleCurrency = () => invoiceCurrency || primaryCode();
  // Total de la facture exprimé dans la devise de la vente.
  //
  // Reproduit fidèlement le calcul backend (`Sale.calculate_totals` +
  // `SaleItem.save`) : chaque prix unitaire est d'abord CONVERTI et ARRONDI dans
  // la devise de facture (exactement ce qu'on envoie), puis les lignes sont
  // sommées. Sinon, convertir le total agrégé donne un chiffre qui diverge de
  // ce que le backend facture → `amount_due`/monnaie faux.
  const totalInSale = () => {
    const cur = saleCurrency();
    let subtotal = 0, itemDiscount = 0, tax = 0;
    for (const item of cart) {
      const unit = convMoney(item.unit_price, primaryCode(), cur);
      // Vente en gros : le tarif du conditionnement s'applique à la part
      // vendue en emballages entiers, converti dans la devise de facture.
      const factor = packagingFactorOf(item.product);
      const line =
        factor && item.packageQuantity > 0
          ? roundMoney(
              item.packageQuantity *
                convMoney(
                  parseFloat(item.product.wholesale_price || "0"),
                  primaryCode(),
                  cur
                ) +
                looseQuantityOf(item) * unit,
              cur
            )
          : roundMoney(item.quantity * unit, cur);
      const disc = roundMoney(line * item.discount_percentage / 100, cur);
      subtotal += line;
      itemDiscount += disc;
      if (item.product.is_taxable) {
        const rate = parseFloat(item.product.tax_rate?.toString() || '0');
        tax += roundMoney((line - disc) * rate / 100, cur);
      }
    }
    const globalDisc = convMoney(calculateGlobalDiscountAmount(), primaryCode(), cur);
    // La remise fidélité s'applique après coup, comme côté serveur : elle
    // s'ajoute à `discount_amount` sur la vente déjà totalisée. Sans elle, la
    // modale annonçait un montant à encaisser pré-remise, corrigé seulement
    // après le retour du serveur.
    const loyaltyDisc = convMoney(calculateLoyaltyDiscount(), primaryCode(), cur);
    return roundMoney(subtotal - itemDiscount - globalDisc - loyaltyDisc + tax, cur);
  };
  // Somme des règlements convertie (et arrondie) dans la devise de la vente.
  const paidInSale = () =>
    roundMoney(
      tenders.reduce((s, t) => s + convertAmount(parseFloat(t.amount) || 0, t.currency, saleCurrency()), 0),
      saleCurrency(),
    );
  // Rétro-compat : plusieurs blocs comparent le payé au total EN PRINCIPALE.
  const getAmountInPrimary = () =>
    roundMoney(
      tenders.reduce((s, t) => s + convertAmount(parseFloat(t.amount) || 0, t.currency, primaryCode()), 0),
      primaryCode(),
    );
  // Monnaie à rendre, dans la devise choisie par le caissier.
  const changeInChangeCurrency = () => {
    const over = paidInSale() - totalInSale();
    if (over <= MONEY_EPS) return 0;
    return convMoney(over, saleCurrency(), changeCurrency || saleCurrency());
  };

  // Règlement unique (grille de moyens de paiement - un seul règlement).
  const newTenderId = () => Math.random().toString(36).slice(2);
  // Patch du règlement courant (le seul de la liste).
  const patchPayment = (patch: Partial<Tender>) =>
    setTenders(prev => (prev.length ? [{ ...prev[0], ...patch }] : prev));

  // Open payment dialog
  const openPaymentDialog = () => {
    const totalAmount = calculateTotal();
    if (totalAmount < 0) {
      toast.error("Le total ne peut pas être négatif. Réduisez les remises.");
      return;
    }
    const primary = getPrimaryCurrency();
    const primaryC = primary?.currency_code || "CDF";
    setInvoiceCurrency(primaryC);
    setChangeCurrency(primaryC);
    setIsCreditSale(false);
    // Règlement pré-rempli au total, en espèces, dans la devise principale
    // (= devise de facture par défaut), arrondi à ses décimales.
    const cashMethod = paymentMethods.find(m => m.method_type === "cash");
    const firstMethod = cashMethod?.id || paymentMethods[0]?.id || "";
    setTenders([{
      id: newTenderId(),
      method: firstMethod,
      currency: primaryC,
      amount: roundMoney(totalAmount, primaryC).toString(),
      reference: "",
    }]);
    setShowPaymentDialog(true);
  };

  const getMethodById = (id: string) => paymentMethods.find(m => m.id === id);

  // Icône de la grille des moyens de paiement selon le type.
  const methodIcon = (type: PaymentMethod["method_type"]) => {
    switch (type) {
      case "cash": return <Banknote className="h-5 w-5" />;
      case "mobile_money": return <Smartphone className="h-5 w-5" />;
      case "card":
      case "bank_transfer": return <CreditCard className="h-5 w-5" />;
      default: return <CircleDollarSign className="h-5 w-5" />;
    }
  };

  // Process payment
  const handlePayment = async () => {
    // Protection double-clic : refuser si une soumission est déjà en cours.
    if (submittingRef.current) {
      return;
    }

    if (!session?.accessToken || !organization || !currentSession) {
      toast.error("Session invalide");
      return;
    }

    if (isCreditSale && !selectedCustomer) {
      toast.error("Sélectionnez un client pour une vente à crédit");
      return;
    }

    const invCur = saleCurrency();
    const total = calculateTotal();               // en devise principale
    const totalSale = totalInSale();               // en devise de facture
    const paidSale = paidInSale();                 // en devise de facture
    // Règlements valides (montant > 0 et méthode choisie).
    const validTenders = tenders.filter(t => (parseFloat(t.amount) || 0) > 0 && t.method);
    const creditAmountSale = totalSale - paidSale;

    if (total < 0) {
      toast.error("Le total ne peut pas être négatif.");
      return;
    }

    if (!isCreditSale && validTenders.length === 0) {
      toast.error("Ajoutez au moins un règlement");
      return;
    }
    if (tenders.some(t => (parseFloat(t.amount) || 0) < 0)) {
      toast.error("Un montant de règlement ne peut pas être négatif.");
      return;
    }

    // Vente normale : le total encaissé doit couvrir le total facturé.
    if (!isCreditSale && paidSale + MONEY_EPS < totalSale) {
      toast.error(
        `Le montant payé (${money(paidSale, invCur)}) est inférieur au total (${money(totalSale, invCur)})`
      );
      return;
    }

    // Vente à crédit
    if (isCreditSale && selectedCustomer) {
      if (creditAmountSale < -MONEY_EPS) {
        toast.error(
          "Le montant payé dépasse le total. Pour une vente entièrement réglée, choisissez le mode comptant."
        );
        return;
      }
      const creditLimit = parseFloat(selectedCustomer.credit_limit || "0");
      const currentBalance = parseFloat(selectedCustomer.current_balance || "0");
      // La dette client est tenue en devise principale.
      const creditInPrimary = total - getAmountInPrimary();
      const newBalance = currentBalance + creditInPrimary;
      if (creditLimit > 0 && newBalance > creditLimit) {
        toast.error(`Limite de crédit dépassée. Limite: ${formatPrice(creditLimit)}, Dette actuelle: ${formatPrice(currentBalance)}, Nouveau total: ${formatPrice(newBalance)}`);
        return;
      }
    }

    const printTab = openPrintTab();
    // Verrou synchrone AVANT setState pour bloquer le second clic immédiat.
    submittingRef.current = true;
    setIsProcessing(true);

    try {
      // Prix unitaires convertis dans la devise de la facture (le backend
      // recalcule les totaux à partir de ces prix, en devise de vente).
      const items: CreateSaleItemData[] = cart.map(item => {
        const base: CreateSaleItemData = {
          product: item.product.id,
          unit_price: convMoney(item.unit_price, primaryCode(), invCur),
          discount_percentage: r2(item.discount_percentage),
        };

        // Produit vendu en gros : on envoie la saisie du caissier (paquets et
        // unités) plutôt qu'un total calculé ici. Le serveur fait la conversion
        // et reste seul juge de la quantité enregistrée.
        const factor = packagingFactorOf(item.product);
        if (factor) {
          return {
            ...base,
            package_quantity: item.packageQuantity,
            loose_quantity: looseQuantityOf(item),
            package_unit_price: convMoney(
              parseFloat(item.product.wholesale_price || "0"),
              primaryCode(),
              invCur
            ),
          };
        }
        return { ...base, quantity: item.quantity };
      });

      // Un CreatePaymentData par règlement (montant remis dans sa devise).
      const payments: CreatePaymentData[] = validTenders.map(t => ({
        payment_method: t.method,
        tendered_amount: roundMoney(parseFloat(t.amount), t.currency),
        currency: t.currency,
        // Taux : devise de la vente pour 1 unité de la devise du règlement.
        exchange_rate: t.currency === invCur
          ? undefined
          : rateOf(t.currency) / rateOf(invCur),
        ...(t.reference ? { reference: t.reference } : {}),
      }));

      const saleType = isCreditSale ? "credit" : "retail";

      // Réduction obtenue par les points, en devise principale (`point_value` y
      // est libellé). Le serveur la reconvertit dans la devise de facture via
      // `resolve_redemption(target_currency=...)`, on ne la restreint donc plus
      // aux factures en principale : cette garde faisait disparaître les points
      // en silence, sans le moindre message au caissier.
      const pointsDiscount = calculateLoyaltyDiscount();

      const result = await createSale(session.accessToken, organization.id, {
        register: currentSession.register,
        warehouse: currentSession.warehouse || undefined,
        customer: selectedCustomer?.id,
        sale_type: saleType,
        // Remise globale convertie dans la devise de la facture.
        global_discount_amount: convMoney(calculateGlobalDiscountAmount(), primaryCode(), invCur),
        discount_percentage: 0,
        currency: invCur,
        exchange_rate: rateOf(invCur),
        change_currency: changeCurrency || invCur,
        is_pos: true,
        items,
        payments,
        // Points de fidélité utilisés. Le serveur plafonne et convertit.
        points_used: usePoints ? pointsToUse : undefined,
      });

      if (result.success && result.data) {
        // Valeurs autoritatives renvoyées par le backend (peuvent différer du calcul
        // local en cas d'arrondis Decimal vs float ou de cap des points loyauté).
        const saleAuthoritative = result.data;
        const backendTotal = parseFloat(saleAuthoritative.total) || (total - pointsDiscount);
        const backendDiscount = parseFloat(saleAuthoritative.discount_amount) || 0;
        const backendLoyaltyRedemption = parseFloat(saleAuthoritative.loyalty_redemption_amount || "0") || 0;
        const backendChange = parseFloat(saleAuthoritative.change_amount) || 0;
        const backendAmountDue = parseFloat(saleAuthoritative.amount_due) || 0;

        const pdfOutcome = (() => {
          const paperWidth = (orgSettings?.receipt_paper_width === 80 ? 80 : 58) as 58 | 80;
          const receiptData: ReceiptData = {
            orgName: organization.name || "Vente Facile",
            orgAddress: organization.address || undefined,
            orgPhone: organization.phone || undefined,
            registerName: currentSession.register_name,
            cashierName: currentSession.opened_by_name,
            reference: saleAuthoritative.reference,
            date: new Date().toLocaleString("fr-CD"),
            customerName: selectedCustomer?.name,
            customerPhone: selectedCustomer?.phone || undefined,
            // Lignes reprises de la réponse du serveur, qui fait autorité sur
            // les montants. Une ligne mixte est imprimée en deux sous-lignes
            // lisibles pour le client : « 2 paquets » puis « 3 bouteilles ».
            items: (saleAuthoritative.items || []).flatMap(line => {
              const discount = parseFloat(line.discount_percentage) || 0;
              const packages = parseFloat(line.package_quantity || "0") || 0;
              const loose = parseFloat(line.loose_quantity || "0") || 0;
              const packagePrice = parseFloat(line.package_unit_price || "0") || 0;
              const unitPrice = parseFloat(line.unit_price) || 0;
              const net = (amount: number) => r2(amount * (1 - discount / 100));

              if (packages > 0 && line.packaging_factor) {
                const packWord = pluralizeUnit(
                  line.package_unit_name || "paquet",
                  packages
                );
                const rows = [{
                  name: `${line.product_name} (${packWord})`,
                  quantity: packages,
                  unit_price: packagePrice,
                  discount_percentage: discount,
                  total: net(packages * packagePrice),
                }];
                if (loose > 0) {
                  rows.push({
                    name: `${line.product_name} (${pluralizeUnit(line.unit_name || "unité", loose)})`,
                    quantity: loose,
                    unit_price: unitPrice,
                    discount_percentage: discount,
                    total: net(loose * unitPrice),
                  });
                }
                return rows;
              }

              return [{
                name: line.product_name,
                quantity: parseFloat(line.quantity) || 0,
                unit_price: unitPrice,
                discount_percentage: discount,
                total: parseFloat(line.total) || 0,
              }];
            }),
            subtotal: calculateSubtotal(),
            taxAmount: calculateTax(),
            // discount_amount inclut déjà la part loyauté (calculée par le backend).
            discountAmount: backendDiscount,
            globalDiscountAmount: calculateGlobalDiscountAmount(),
            total: backendTotal,
            payments: (() => {
              // Un ligne par règlement, dans sa devise réelle (tiroir fidèle).
              const receiptPayments: { method: string; amount: number; currency: string }[] =
                validTenders.map(t => ({
                  method: getMethodById(t.method)?.name || "Règlement",
                  amount: parseFloat(t.amount) || 0,
                  currency: t.currency,
                }));
              if (backendAmountDue > 0) {
                receiptPayments.push({
                  method: "À crédit",
                  amount: backendAmountDue,
                  currency: invCur,
                });
              }
              return receiptPayments;
            })(),
            amountPaid: paidSale,
            change: !isCreditSale ? backendChange : 0,
            currency: invCur,
            receiptHeader: orgSettings?.receipt_header || undefined,
            receiptFooter: orgSettings?.receipt_footer || undefined,
            isCreditSale: backendAmountDue > 0,
            amountDue: backendAmountDue,
            showLoyaltyPoints: !!(
              orgSettings?.show_loyalty_points_on_receipt &&
              selectedCustomer &&
              saleAuthoritative.loyalty_program_active
            ),
            // Valeurs telles qu'écrites au registre par le serveur. Le POS
            // rejouait auparavant le barème avec la seule formule « pourcentage »
            // en dur : sur un programme `fixed_per_amount`, qui est le défaut,
            // le reçu annonçait dix fois les points réellement crédités.
            loyaltyPointsEarned: saleAuthoritative.loyalty_points_earned ?? 0,
            loyaltyPointsUsed: saleAuthoritative.loyalty_points_used ?? 0,
            loyaltyPointsBalance: saleAuthoritative.loyalty_points_balance ?? 0,
            loyaltyRedemptionAmount: backendLoyaltyRedemption,
          };
          const pdfUrl = generateReceiptPdfUrl(receiptData, paperWidth);
          return assignPdfToPrintWindow(printTab, pdfUrl, {
            filename: `recu-${result.data.reference}.pdf`,
          });
        })();

        toast.success(`Vente ${result.data.reference} créée avec succès`, {
          description:
            pdfOutcome === "opened"
              ? "PDF ouvert et enregistré - utilisez Thermer ou Partager pour imprimer."
              : "Reçu téléchargé - l’onglet n’a pas pu s’ouvrir ; ouvrez le fichier dans Thermer.",
        });

        // Emballages ouverts automatiquement : le caissier est informé après
        // coup, sans modale ni clic supplémentaire. L'opération a déjà eu lieu.
        for (const notice of saleAuthoritative.unpacking_notices || []) {
          toast.warning(notice.product_name, {
            description: notice.message,
            duration: 6000,
          });
        }

        // Mark receipt as printed - on attend la réponse pour pouvoir signaler
        // une éventuelle erreur (le statut DB doit refléter la réalité).
        try {
          const printedRes = await markReceiptPrinted(session.accessToken, organization.id, result.data.id);
          if (printedRes && printedRes.success === false) {
            toast.error("Le reçu n'a pas pu être marqué comme imprimé côté serveur. Vérifiez dans l'historique.");
          }
        } catch (err: unknown) {
          console.error("Failed to mark receipt as printed:", err);
          toast.error("Impossible de mettre à jour le statut d'impression du reçu.");
        }

        // Reset cart
        setCart([]);
        setSelectedCustomer(null);
        setGlobalDiscountAmount(0);
        setIsCreditSale(false);
        setShowPaymentDialog(false);
        setUsePoints(false);
        setPointsToUse(0);
        setCustomerLoyalty(null);

        // Refresh products to get updated stock
        if (organization) {
          const productsResult = await getProducts(session.accessToken, organization.id, {
            is_active: true,
            in_stock: true,
            ...(currentSession?.warehouse ? { warehouse: currentSession.warehouse } : {}),
          });
          if (productsResult.success && productsResult.data) {
            setProducts(productsResult.data.results || []);
          } else {
            toast.error(productsResult.message || "Erreur lors du rafraîchissement des produits");
          }
        }
      } else {
        // Parse backend errors récursivement : DRF retourne souvent des structures
        // imbriquées (errors.payments[0].amount = ["..."], errors.items[2].quantity).
        // Sans ce dépliage, le toast affichait "[object Object]" ou du JSON brut.
        const errors = result.errors;
        let errorMsg = result.message || "Erreur lors de la création de la vente";
        let description: string | undefined;

        if (errors) {
          const flat = flattenDrfErrors(errors);
          if (flat.length > 0) {
            errorMsg = flat[0];
            if (flat.length > 1) {
              description = flat.slice(1).join(" • ");
            }
          }
        }

        toast.error(errorMsg, {
          duration: 6000,
          description: description ?? (errorMsg.toLowerCase().includes("stock")
            ? "Veuillez ajuster les quantités dans le panier."
            : undefined),
        });

        if (errorMsg.includes("Stock") || errorMsg.includes("stock")) {
          setShowPaymentDialog(false);
        }
        closePrintTabIfBlank(printTab);
      }
    } catch (error) {
      closePrintTabIfBlank(printTab);
      toast.error("Une erreur est survenue lors du paiement");
    } finally {
      setIsProcessing(false);
      submittingRef.current = false;
    }
  };

  /** PDF proforma uniquement - aucun appel API vente, pas de mouvement de stock. */
  const handleGenerateProforma = () => {
    const total = calculateTotal();
    if (cart.length === 0) {
      toast.error("Le panier est vide");
      return;
    }
    if (total < 0) {
      toast.error("Le total ne peut pas être négatif.");
      return;
    }
    if (!organization || !currentSession) {
      toast.error("Session invalide");
      return;
    }

    const printTab = openPrintTab();
    setIsGeneratingProforma(true);

    try {
      const dateCompact = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const ref = `PROF-${dateCompact}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const paperWidth = (orgSettings?.receipt_paper_width === 80 ? 80 : 58) as 58 | 80;
      const primaryCode = getPrimaryCurrency()?.currency_code || "CDF";

      const receiptData: ReceiptData = {
        orgName: organization.name || "Vente Facile",
        orgAddress: organization.address || undefined,
        orgPhone: organization.phone || undefined,
        registerName: currentSession.register_name,
        cashierName: currentSession.opened_by_name,
        reference: ref,
        date: new Date().toLocaleString("fr-CD"),
        customerName: selectedCustomer?.name,
        customerPhone: selectedCustomer?.phone || undefined,
        items: cart.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          quantity_label: packagingFactorOf(item.product)
            ? describeCartLine(item)
            : undefined,
          unit_price: item.unit_price,
          discount_percentage: item.discount_percentage,
          total: r2(item.quantity * item.unit_price * (1 - item.discount_percentage / 100)),
        })),
        subtotal: calculateSubtotal(),
        taxAmount: calculateTax(),
        discountAmount: r2(calculateItemDiscount() + calculateGlobalDiscountAmount()),
        globalDiscountAmount: calculateGlobalDiscountAmount(),
        total,
        payments: [],
        amountPaid: 0,
        change: 0,
        currency: primaryCode,
        receiptHeader: orgSettings?.receipt_header || undefined,
        isProforma: true,
        isCreditSale: false,
        showLoyaltyPoints: false,
      };

      const pdfUrl = generateReceiptPdfUrl(receiptData, paperWidth);
      const pdfOutcome = assignPdfToPrintWindow(printTab, pdfUrl, {
        filename: `proforma-${ref}.pdf`,
      });

      toast.success(`Proforma ${ref}`, {
        description:
          pdfOutcome === "opened"
            ? "PDF ouvert et enregistré - utilisez Thermer ou Partager pour imprimer."
            : "PDF téléchargé - l’onglet n’a pas pu s’ouvrir ; ouvrez le fichier dans Thermer.",
      });

      setCart([]);
      setSelectedCustomer(null);
      setGlobalDiscountAmount(0);
      setIsCreditSale(false);
      setShowPaymentDialog(false);
      setUsePoints(false);
      setPointsToUse(0);
      setCustomerLoyalty(null);
      setShowMobileCart(false);
    } catch {
      closePrintTabIfBlank(printTab);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setIsGeneratingProforma(false);
    }
  };

  // Close session handler
  const handleCloseSession = async () => {
    if (!session?.accessToken || !organization || !currentSession) return;

    setIsClosingSession(true);
    try {
      const result = await closeSession(session.accessToken, organization.id, currentSession.id);

      if (result.success) {
        toast.success("Session de caisse fermée avec succès");
        router.push("/dashboard/sales/registers");
      } else {
        toast.error(result.message || "Erreur lors de la fermeture de la session");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsClosingSession(false);
    }
  };

  // Create customer inline from POS
  const handleCreateCustomer = async () => {
    if (!session?.accessToken || !organization) return;
    if (!newCustomerData.name.trim()) {
      toast.error("Le nom du client est obligatoire");
      return;
    }
    if (!newCustomerData.phone?.trim()) {
      toast.error("Le téléphone est obligatoire");
      return;
    }

    setIsCreatingCustomer(true);
    try {
      const result = await createCustomer(session.accessToken, organization.id, newCustomerData);
      if (result.success && result.data) {
        toast.success(`Client "${result.data.name}" créé avec succès`);
        setCustomers(prev => [result.data!, ...prev]);
        setSelectedCustomer(result.data);
        setShowCustomerDialog(false);
        setCustomerDialogMode("search");
        setNewCustomerData({ name: "", phone: "", customer_type: "individual" });
      } else {
        toast.error(result.message || "Erreur lors de la création du client");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  // Recherche backend des produits avec debounce
  const handleProductSearch = useCallback((query: string) => {
    setSearchQuery(query);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      if (!session?.accessToken || !organization) {
        setIsSearching(false);
        return;
      }
      const result = await getProducts(session.accessToken, organization.id, {
        search: query,
        is_active: true,
        in_stock: true,
        page_size: 50,
        ...(currentSession?.warehouse ? { warehouse: currentSession.warehouse } : {}),
      });
      if (result.success && result.data) {
        setSearchResults(result.data.results || []);
      } else {
        setSearchResults([]);
        toast.error(result.message || "Erreur lors de la recherche des produits");
      }
      setIsSearching(false);
    }, 300);
  }, [session?.accessToken, organization, currentSession?.warehouse]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  // Produits affichés : résultats de recherche backend ou produits initiaux
  const displayedProducts = searchQuery.trim() ? searchResults : products;

  // Filter customers
  const filteredCustomers = customers.filter(
    c =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch))
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // Ce que le client doit, points déduits. Hors modale d'encaissement,
  // `usePoints` est faux et cette valeur vaut le total brut.
  const total = calculateNetTotal();
  const change = getAmountInPrimary() - total;

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col lg:flex-row gap-4 -m-4 lg:-m-6 p-4 lg:p-6 bg-gray-100 relative">
      {/* Products Section */}
      <div className="flex-1 flex flex-col min-h-0 pb-20 lg:pb-0">
        {/* Search Bar */}
        <div className="mb-4 flex gap-2 items-center justify-between lg:gap-4">
          {/* Sortie de caisse : premier élément de la ligne, donc premier au clavier */}
          <Button
            variant="outline"
            className="h-12 shrink-0 bg-white px-3 text-gray-700 transition-transform hover:bg-gray-50 active:scale-[0.96] sm:px-4"
            onClick={leavePos}
            aria-label="Revenir à la liste des caisses"
          >
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Retour</span>
          </Button>
          <div className="w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              ref={searchInputRef}
              placeholder="Rechercher un produit (nom, SKU, code-barres)..."
              value={searchQuery}
              onChange={e => handleProductSearch(e.target.value)}
              className="pl-10 h-12 text-lg bg-white"
            />
          </div>
          {/* Close Session Button - Desktop only */}
          <div className="hidden lg:block">
            <Button
              variant="outline"
              className="w-full sm:max-w-max h-12 bg-white text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={() => setShowCloseSessionDialog(true)}
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span>Fermer la caisse</span>
            </Button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500 mr-2" />
              <p className="text-gray-500">Recherche...</p>
            </div>
          ) : searchQuery.trim() && displayedProducts.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Aucun produit trouvé</p>
            </div>
          ) : !searchQuery.trim() && products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
              <Package className="h-10 w-10 text-gray-300" />
              <p className="font-medium text-gray-600">Aucun produit avec stock disponible</p>
              <p className="max-w-md text-sm text-gray-500">
                {currentSession?.warehouse_name
                  ? `Aucun produit n'a de stock disponible dans l'entrepôt « ${currentSession.warehouse_name} ». Réceptionnez ou transférez du stock vers cet entrepôt pour le vendre ici.`
                  : "Aucun produit n'a de stock disponible. Réceptionnez ou transférez du stock vers votre entrepôt pour le vendre ici."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {!searchQuery.trim() && products.length > 20 && (
                <div className="p-2 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-700 flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Affichage des 20 premiers produits sur {products.length}. Utilisez la
                    recherche ci-dessus pour parcourir tout le catalogue.
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {(searchQuery.trim() ? displayedProducts : products.slice(0, 20)).map(product => {
                const isLocked = lockedProductIds.has(product.id);
                const canAdd = canAddProductToCart(product);
                const stockDepleted =
                  product.track_inventory &&
                  !product.allow_negative_stock &&
                  getRemainingStock(product) <= 0;
                const stockQty = getAvailableStock(product);
                const stockLow =
                  product.track_inventory &&
                  getRemainingStock(product) <= (product.reorder_point || 5);
                const stockEmpty =
                  product.track_inventory &&
                  !product.allow_negative_stock &&
                  getRemainingStock(product) <= 0;
                const locationLabel = getProductLocationLabel(product);

                // Le stock d'un produit vendu en gros doit se lire « 1 pqt + 10 btl »,
                // jamais « 22 » : le caissier raisonne en emballages, pas en unités.
                const stockOverlayLabel = !product.track_inventory
                  ? "-"
                  : packagingFactorOf(product) && product.stock_packages !== null &&
                    product.stock_packages !== undefined
                    ? `${product.stock_packages} ${product.packaging_unit_symbol || "pqt"}` +
                      (parseFloat(product.stock_loose || "0") > 0
                        ? ` + ${formatNumber(parseFloat(product.stock_loose || "0"))} ${product.unit_symbol || ""}`.trimEnd()
                        : "")
                    : `${formatNumber(stockQty)}${product.unit_symbol ? ` ${product.unit_symbol}` : ""}`;

                // Prix affichés par canal. Un produit vendu en gros seul n'a pas
                // de prix de détail : afficher le sien donnerait « 0 FC ».
                const packageLabel =
                  product.packaging_unit_symbol || product.packaging_unit_name || "pqt";
                const wholesalePrice = parseFloat(product.wholesale_price || "0");
                const isPackageOnlyProduct = product.selling_mode === "wholesale_only";
                const mainPriceLabel = isPackageOnlyProduct
                  ? `${formatPrice(wholesalePrice)} / ${packageLabel}`
                  : formatPrice(parseFloat(product.selling_price));
                const secondaryPriceLabel =
                  !isPackageOnlyProduct && packagingFactorOf(product) && wholesalePrice > 0
                    ? `${formatPrice(wholesalePrice)} / ${packageLabel}`
                    : null;

                const cardVisual = (
                  <CardContent className="flex h-full min-h-[88px] gap-2.5 p-2.5">
                    {/* Vignette + stock toujours superposé sur l'image */}
                    <div className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-black/[0.06]">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt=""
                          className={cn(
                            "h-full w-full object-cover",
                            isLocked && "grayscale"
                          )}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-8 w-8 text-slate-300" />
                        </div>
                      )}

                      {/* Badge stock - superposé sur l'image */}
                      <div
                        className={cn(
                          "absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 px-1 py-0.5 text-[10px] font-bold leading-none tabular-nums shadow-sm backdrop-blur-[2px]",
                          isLocked
                            ? "bg-red-700/90 text-white"
                            : !product.track_inventory
                              ? "bg-slate-800/75 text-white"
                              : stockEmpty
                                ? "bg-red-600/95 text-white"
                                : stockLow
                                  ? "bg-amber-500/95 text-white"
                                  : "bg-emerald-600/95 text-white"
                        )}
                        title={
                          product.track_inventory
                            ? `Stock disponible : ${stockQty}`
                            : "Sans suivi de stock"
                        }
                      >
                        <Package className="h-2.5 w-2.5 shrink-0 opacity-90" />
                        <span>{stockOverlayLabel}</span>
                      </div>

                      {isLocked ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-500/30">
                          <AlertTriangle className="h-5 w-5 text-red-700 drop-shadow-sm" />
                        </div>
                      ) : null}
                    </div>

                    {/* Infos - disposition horizontale optimisée */}
                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3
                          className={cn(
                            "line-clamp-2 min-w-0 flex-1 text-[12px] font-semibold leading-tight",
                            isLocked ? "text-red-800" : "text-slate-900"
                          )}
                          title={product.name}
                        >
                          {product.name}
                        </h3>
                        <div className="shrink-0 text-right">
                          <p
                            className={cn(
                              "text-[12px] font-bold leading-tight tabular-nums",
                              isLocked ? "text-red-600" : "text-orange-600"
                            )}
                          >
                            {mainPriceLabel}
                          </p>
                          {secondaryPriceLabel && (
                            <p className="text-[10px] leading-tight tabular-nums text-slate-500">
                              {secondaryPriceLabel}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <p
                          className="truncate text-[10px] text-slate-600"
                          title={product.category_name || undefined}
                        >
                          <Tag className="mr-0.5 inline h-3 w-3 -translate-y-px text-orange-500" />
                          {product.category_name?.trim() || "Sans catégorie"}
                        </p>
                        <p
                          className="truncate text-[10px] text-slate-500"
                          title={product.brand_name || undefined}
                        >
                          {product.brand_name?.trim() || "Sans marque"}
                        </p>
                        <p
                          className="truncate text-[10px] text-slate-400"
                          title={locationLabel}
                        >
                          <MapPin className="mr-0.5 inline h-2.5 w-2.5 -translate-y-px" />
                          {locationLabel}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                );

                const isQtyOpen = qtyPickerProductId === product.id;
                const justAdded = justAddedProductId === product.id;

                return (
                  <Card
                    key={product.id}
                    className={cn(
                      "relative flex h-full flex-col overflow-hidden py-0 transition-[box-shadow,transform] duration-150",
                      isQtyOpen && "z-10",
                      justAdded && "ring-2 ring-emerald-500",
                      isLocked
                        ? "border-red-300 bg-red-50 opacity-60"
                        : stockDepleted
                          ? "opacity-50"
                          : ""
                    )}
                  >
                    {canAdd ? (
                      <QuantityPicker
                        product={product}
                        open={isQtyOpen}
                        onOpenChange={(next) =>
                          setQtyPickerProductId(next ? product.id : null)
                        }
                        maxBase={addableBase(product)}
                        looseAvailable={addableLoose(product)}
                        sealedAvailable={addableSealed(product)}
                        onUnpack={unpackHandlerFor(product)}
                        onConfirm={(selection) => addToCart(product, selection)}
                      >
                        <button
                          type="button"
                          data-qty-anchor
                          onClick={() =>
                            setQtyPickerProductId(isQtyOpen ? null : product.id)
                          }
                          aria-haspopup="dialog"
                          aria-expanded={isQtyOpen}
                          className={cn(
                            "block w-full cursor-pointer rounded-lg text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 hover:bg-gray-50/80",
                            isQtyOpen && "bg-orange-50/60"
                          )}
                        >
                          {cardVisual}
                        </button>
                      </QuantityPicker>
                    ) : (
                      <div className="cursor-not-allowed">{cardVisual}</div>
                    )}
                  </Card>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t shadow-[0_-4px_12px_rgba(0,0,0,0.1)] px-4 py-3">
        {cart.length > 0 ? (
          <div
            className="cursor-pointer"
            onClick={() => setShowMobileCart(true)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingCart className="h-6 w-6 text-orange-500" />
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{cart.length} article{cart.length > 1 ? "s" : ""}</p>
                  {selectedCustomer && (
                    <p className="text-xs text-gray-500">{selectedCustomer.name}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-orange-600">{formatPrice(total)}</p>
                <p className="text-xs text-gray-500">Voir le panier</p>
              </div>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full h-12 bg-white text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            onClick={() => {
              setShowCloseSessionDialog(true);
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span>Fermer la caisse</span>
          </Button>
        )}
      </div>

      {/* Mobile Cart Overlay */}
      {showMobileCart && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileCart(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] flex min-h-0 flex-col animate-in slide-in-from-bottom duration-300">
            {/* Mobile Cart Handle */}
            <div className="flex items-center justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            {/* Mobile Cart Header */}
            <div className="px-4 pb-3 border-b">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900">Panier</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{cart.length} articles</Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowMobileCart(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              {/* Customer Selection */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="flex-1 justify-start"
                  onClick={() => setShowCustomerDialog(true)}
                >
                  <User className="h-4 w-4 mr-2" />
                  <span className="truncate">
                    {selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.code})` : "Sélectionner un client"}
                  </span>
                </Button>
                {selectedCustomer && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-gray-400 hover:text-red-500"
                    onClick={() => setSelectedCustomer(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {/* Mobile Cart Items */}
            <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
              {cart.map((item, index) => {
                const stockAvailable = getAvailableStock(item.product);
                const overStock = item.product.track_inventory && !item.product.allow_negative_stock && item.quantity > stockAvailable;
                return (
                  <div key={item.product.id} className={`rounded-lg p-3 ${overStock ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <ProductThumb
                        src={item.product.image}
                        alt={item.product.name}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 truncate">{item.product.name}</h4>
                        <p className="flex items-center gap-1.5 text-xs text-gray-500">
                          <span className="truncate">{describeCartLine(item)}</span>
                          {item.discount_percentage > 0 ? (
                            <span className="shrink-0 rounded bg-orange-100 px-1 py-px text-[10px] font-bold tabular-nums text-orange-700">
                              -{item.discount_percentage} %
                            </span>
                          ) : null}
                        </p>
                        {overStock && (
                          <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                            <AlertTriangle className="h-3 w-3" />
                            Stock insuffisant ! Disponible: {stockAvailable}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeFromCart(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <CartLineQuantityEditor
                        item={item}
                        surface="m"
                        openKey={editingLineProductId}
                        onOpenKeyChange={setEditingLineProductId}
                        maxBase={
                          item.product.track_inventory && !item.product.allow_negative_stock
                            ? getAvailableStock(item.product)
                            : null
                        }
                        looseAvailable={addableLoose(item.product, true)}
                        sealedAvailable={addableSealed(item.product, true)}
                        onUnpack={unpackHandlerFor(item.product)}
                        maxDiscountPercent={MAX_SALE_DISCOUNT_PERCENT}
                        onConfirm={(selection) => setCartLineSelection(index, selection)}
                        onRemove={() => removeFromCart(index)}
                        onStep={(delta) => updateQuantity(index, delta)}
                      />
                      <p className="font-bold text-gray-900">
                        {formatPrice(lineGross(item) * (1 - item.discount_percentage / 100))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Mobile Cart Footer - compact pour laisser max. de place aux lignes */}
            <div className="shrink-0 border-t px-3 py-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 shrink-0 text-gray-400" />
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Remise (montant)"
                  value={globalDiscountAmount || ""}
                  onChange={e => {
                    const raw = parseFloat(e.target.value) || 0;
                    setGlobalDiscountAmount(r2(Math.min(Math.max(0, raw), getMaxGlobalDiscountAmount())));
                  }}
                  className="h-8 tabular-nums"
                />
              </div>
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="text-orange-600">{formatPrice(total)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  type="button"
                  title={
                    cart.length === 0
                      ? "Ajoutez d'abord un produit au panier."
                      : total < 0
                        ? "Le total est négatif - réduisez les remises."
                        : "Générer une facture proforma (sans vente ni stock)"
                  }
                  className="h-10 min-w-0 px-2 text-sm font-medium"
                  disabled={cart.length === 0 || total < 0 || isGeneratingProforma || isProcessing}
                  onClick={handleGenerateProforma}
                >
                  {isGeneratingProforma ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0" />
                  )}
                  <span className="ml-1.5 truncate">Proforma</span>
                </Button>
                <Button
                  type="button"
                  title={
                    cart.length === 0
                      ? "Ajoutez d'abord un produit au panier."
                      : total < 0
                        ? "Le total est négatif - réduisez les remises."
                        : `Encaisser ${formatPrice(total)}`
                  }
                  className="h-10 min-w-0 bg-orange-500 px-2 text-sm font-medium hover:bg-orange-600"
                  disabled={cart.length === 0 || total < 0 || isProcessing || isGeneratingProforma}
                  onClick={() => {
                    setShowMobileCart(false);
                    openPaymentDialog();
                  }}
                >
                  <CreditCard className="h-4 w-4 shrink-0" />
                  <span className="ml-1.5 truncate">Payer</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Section - Desktop - min-h-0 pour que la liste scroll et prenne tout l’espace vertical */}
      <div className="hidden min-h-0 w-96 shrink-0 flex-col rounded-lg bg-white shadow-lg lg:flex">
        {/* Cart Header */}
        <div className="shrink-0 border-b px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Panier</h2>
            <Badge variant="secondary">{cart.length} articles</Badge>
          </div>

          {/* Customer Selection */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1 justify-start"
              onClick={() => setShowCustomerDialog(true)}
            >
              <User className="h-4 w-4 mr-2" />
              <span className="truncate">
                {selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.code})` : "Sélectionner un client"}
              </span>
            </Button>
            {selectedCustomer && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-gray-400 hover:text-red-500"
                onClick={() => setSelectedCustomer(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingCart className="h-12 w-12 mb-2" />
              <p>Panier vide</p>
            </div>
          ) : (
            cart.map((item, index) => {
              const stockAvailable = getAvailableStock(item.product);
              const overStock = item.product.track_inventory && !item.product.allow_negative_stock && item.quantity > stockAvailable;
              return (
                <div key={item.product.id} className={`rounded-lg p-3 ${overStock ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <ProductThumb
                      src={item.product.image}
                      alt={item.product.name}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-gray-900 truncate">
                        {item.product.name}
                      </h4>
                      <p className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="truncate">{describeCartLine(item)}</span>
                        {item.discount_percentage > 0 ? (
                          <span className="shrink-0 rounded bg-orange-100 px-1 py-px text-[10px] font-bold tabular-nums text-orange-700">
                            -{item.discount_percentage} %
                          </span>
                        ) : null}
                      </p>
                      {overStock && (
                        <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                          <AlertTriangle className="h-3 w-3" />
                          Stock insuffisant ! Disponible: {stockAvailable}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500"
                      onClick={() => removeFromCart(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <CartLineQuantityEditor
                      item={item}
                      surface="d"
                      openKey={editingLineProductId}
                      onOpenKeyChange={setEditingLineProductId}
                      maxBase={
                        item.product.track_inventory && !item.product.allow_negative_stock
                          ? getAvailableStock(item.product)
                          : null
                      }
                      looseAvailable={addableLoose(item.product, true)}
                      sealedAvailable={addableSealed(item.product, true)}
                      onUnpack={unpackHandlerFor(item.product)}
                      maxDiscountPercent={MAX_SALE_DISCOUNT_PERCENT}
                      onConfirm={(selection) => setCartLineSelection(index, selection)}
                      onRemove={() => removeFromCart(index)}
                      onStep={(delta) => updateQuantity(index, delta)}
                    />
                    <p className="font-bold text-gray-900">
                      {formatPrice(lineGross(item) * (1 - item.discount_percentage / 100))}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Footer - compact : une rangée d’actions + totaux resserrés */}
        <div className="shrink-0 space-y-2 border-t px-3 py-2.5">
          {/* Global Discount */}
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 shrink-0 text-gray-400" />
            <Input
              type="number"
              step="any"
              min="0"
              placeholder="Remise (montant)"
              value={globalDiscountAmount || ""}
              onChange={e => {
                const raw = parseFloat(e.target.value) || 0;
                setGlobalDiscountAmount(r2(Math.min(Math.max(0, raw), getMaxGlobalDiscountAmount())));
              }}
              className="h-8 tabular-nums"
            />
          </div>

          {/* Totals */}
          <div className="space-y-0.5 text-xs leading-tight">
            <div className="flex justify-between text-gray-600">
              <span>Sous-total</span>
              <span className="tabular-nums">{formatPrice(calculateSubtotal())}</span>
            </div>
            {calculateItemDiscount() > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Rem. articles</span>
                <span className="tabular-nums">-{formatPrice(calculateItemDiscount())}</span>
              </div>
            )}
            {calculateGlobalDiscountAmount() > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Remise</span>
                <span className="tabular-nums">-{formatPrice(calculateGlobalDiscountAmount())}</span>
              </div>
            )}
            {calculateTax() > 0 && (
              <div className="flex justify-between text-green-700">
                <span>TVA</span>
                <span className="tabular-nums">+{formatPrice(calculateTax())}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-1 text-sm font-bold text-gray-900">
              <span>Total</span>
              <span className="text-orange-600 tabular-nums">{formatPrice(total)}</span>
            </div>
          </div>

          {/* Paiement / proforma - une ligne, hauteur réduite */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              type="button"
              title={
                cart.length === 0
                  ? "Ajoutez d'abord un produit au panier."
                  : total < 0
                    ? "Le total est négatif - réduisez les remises."
                    : "Générer une facture proforma (sans vente ni stock)"
              }
              className="h-10 min-w-0 px-2 text-sm font-medium"
              disabled={cart.length === 0 || total < 0 || isGeneratingProforma || isProcessing}
              onClick={handleGenerateProforma}
            >
              {isGeneratingProforma ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 shrink-0" />
              )}
              <span className="ml-1.5 truncate">Proforma</span>
            </Button>
            <Button
              type="button"
              title={
                cart.length === 0
                  ? "Ajoutez d'abord un produit au panier."
                  : total < 0
                    ? "Le total est négatif - réduisez les remises."
                    : `Encaisser ${formatPrice(total)}`
              }
              className="h-10 min-w-0 bg-orange-500 px-2 text-sm font-medium hover:bg-orange-600"
              disabled={cart.length === 0 || total < 0 || isProcessing || isGeneratingProforma}
              onClick={openPaymentDialog}
            >
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="ml-1.5 truncate">Payer</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={(open) => {
        if (isProcessing) {
          // L'utilisateur tente de fermer le dialog pendant un submit en
          // cours (Esc, clic backdrop, ou fermeture forcée). On bloque la
          // fermeture et on l'informe explicitement : sinon il pense que
          // la vente n'a pas été créée et risque de doubler.
          if (!open) {
            toast.info(
              "Traitement en cours, merci de patienter avant de fermer."
            );
          }
          return;
        }
        setShowPaymentDialog(open);
        if (!open) {
          setIsCreditSale(false);
        }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-orange-500" />
              Encaissement
            </DialogTitle>
            <DialogDescription className="text-start">
              Sélectionnez le mode de paiement et confirmez le montant
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 overflow-y-auto flex-1 pr-2">

            {/* Loyalty Points Usage */}
            {selectedCustomer && loyaltyProgram?.is_active && customerLoyalty && customerLoyalty.current_points >= (loyaltyProgram.min_points_to_redeem || 100) && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Points de fidélité</Label>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-600" />
                      <span className="font-medium text-amber-800">
                        {formatPoints(customerLoyalty.current_points)} pts disponibles
                      </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={usePoints}
                        onChange={(e) => {
                          setUsePoints(e.target.checked);
                          if (e.target.checked) {
                            // Par défaut, utiliser tous les points disponibles (max = total de la facture en points)
                            const maxPointsValue = calculateTotal() / (loyaltyProgram.point_value ? parseFloat(loyaltyProgram.point_value) : 1);
                            const pointsToApply = Math.min(customerLoyalty.current_points, roundPoints(maxPointsValue));
                            setPointsToUse(pointsToApply);
                          } else {
                            setPointsToUse(0);
                          }
                        }}
                        className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                      />
                      <span className="text-sm text-amber-700">Utiliser mes points</span>
                    </label>
                  </div>
                  {usePoints && (
                    <div className="space-y-2 pt-2 border-t border-amber-200">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={pointsToUse}
                          onChange={(e) => {
                            // Cap à la fois par solde dispo ET par la valeur monétaire
                            // utilisable sur le total courant : un client ne peut pas
                            // appliquer plus de points que ce que la facture vaut.
                            const pointValue = loyaltyProgram.point_value
                              ? parseFloat(loyaltyProgram.point_value)
                              : 1;
                            const totalNow = calculateTotal();
                            const maxByTotal = pointValue > 0
                              ? roundPoints(totalNow / pointValue)
                              : customerLoyalty.current_points;
                            const value = Math.min(
                              Math.max(0, roundPoints(parseFloat(e.target.value) || 0)),
                              customerLoyalty.current_points,
                              maxByTotal,
                            );
                            setPointsToUse(value);
                          }}
                          // Pas de pas entier : le solde peut être fractionnaire.
                          step="0.01"
                          min={loyaltyProgram.min_points_to_redeem || 100}
                          max={customerLoyalty.current_points}
                          className="w-24 h-8 text-center"
                        />
                        <span className="text-sm text-amber-700">points</span>
                        <span className="text-sm text-amber-600 ml-auto">
                          = {formatPrice(pointsToUse * (loyaltyProgram.point_value ? parseFloat(loyaltyProgram.point_value) : 1))} de réduction
                        </span>
                      </div>
                      <p className="text-xs text-amber-500">
                        Min: {loyaltyProgram.min_points_to_redeem || 100} pts | 1 pt = {formatPrice(loyaltyProgram.point_value ? parseFloat(loyaltyProgram.point_value) : 1)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* La facture reste TOUJOURS dans la devise principale ; seul le
                montant reçu peut être encaissé dans une autre devise. */}

            {/* Credit sale warning and info */}
            {isCreditSale && (
              <div className="space-y-2">
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Vente à crédit - un client est obligatoire
                  </p>
                  {!selectedCustomer && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 border-amber-300 text-amber-700 hover:bg-amber-100"
                      onClick={() => setShowCustomerDialog(true)}
                    >
                      <User className="h-3.5 w-3.5 mr-1.5" />
                      Sélectionner un client
                    </Button>
                  )}
                  {selectedCustomer && (
                    <div className="mt-2 flex items-center justify-between p-2 bg-white rounded border border-amber-200">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-amber-600" />
                        <p className="text-xs text-amber-800 font-medium">{selectedCustomer.name}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowCustomerDialog(true)}
                          className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                        >
                          Changer
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCustomer(null);
                            setCustomerLoyalty(null);
                            setUsePoints(false);
                            setPointsToUse(0);
                            setIsCreditSale(false);
                          }}
                          className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pre-warning : limite de crédit dépassée AVANT submit */}
                {selectedCustomer && (() => {
                  const creditLimit = parseFloat(selectedCustomer.credit_limit || "0");
                  const currentBalance = parseFloat(selectedCustomer.current_balance || "0");
                  // creditAmount = total - paiement (en devise primaire). On le
                  // recalcule ici car la variable du handler n'est pas en scope JSX.
                  const paidInPrimary = getAmountInPrimary();
                  const creditAmountLocal = Math.max(0, total - paidInPrimary);
                  const projectedBalance = currentBalance + creditAmountLocal;
                  if (creditLimit > 0 && projectedBalance > creditLimit) {
                    return (
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          Limite de crédit dépassée
                        </p>
                        <ul className="mt-1.5 text-xs text-red-700 space-y-0.5">
                          <li>Dette actuelle : {formatPrice(currentBalance)}</li>
                          <li>+ crédit de cette vente : {formatPrice(creditAmountLocal)}</li>
                          <li>= total projeté : <strong>{formatPrice(projectedBalance)}</strong></li>
                          <li>Limite autorisée : {formatPrice(creditLimit)}</li>
                        </ul>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {/* 2. Récapitulatif (dans la devise de la facture) */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Récapitulatif</Label>
              <div className="p-3 bg-gray-50 rounded-xl space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Sous-total ({cart.reduce((s, i) => s + i.quantity, 0)} articles)</span>
                  <span className="font-medium">{money(convMoney(calculateSubtotal(), primaryCode(), saleCurrency()))}</span>
                </div>
                {calculateItemDiscount() > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Remises articles</span>
                    <span>-{money(convMoney(calculateItemDiscount(), primaryCode(), saleCurrency()))}</span>
                  </div>
                )}
                {calculateGlobalDiscountAmount() > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Remise</span>
                    <span>-{money(convMoney(calculateGlobalDiscountAmount(), primaryCode(), saleCurrency()))}</span>
                  </div>
                )}
                {calculateTax() > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Taxes (TVA)</span>
                    <span>+{money(convMoney(calculateTax(), primaryCode(), saleCurrency()))}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-300">
                  <span>Total à payer</span>
                  <span className="text-orange-600">{money(totalInSale())}</span>
                </div>
                {/* Équivalent dans la devise encaissée (si différente) */}
                {(() => {
                  const t0 = tenders[0];
                  if (!t0 || t0.currency === saleCurrency()) return null;
                  return (
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>≈ à encaisser en {t0.currency}</span>
                      <span>{money(convMoney(totalInSale(), saleCurrency(), t0.currency), t0.currency)}</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* 3. Moyen de paiement (grille) + montant */}
            {(() => {
              const t = tenders[0];
              if (!t) return null;
              const amt = parseFloat(t.amount) || 0;
              const method = getMethodById(t.method);
              // Devise réellement encaissée (celle du montant reçu).
              const payCur = t.currency;
              // Montants exprimés dans la devise reçue (« montant converti »).
              const totalInPay = convMoney(totalInSale(), saleCurrency(), payCur);
              const paidInPay = convMoney(paidInSale(), saleCurrency(), payCur);
              const missingInPay = roundMoney(totalInPay - paidInPay, payCur);
              return (
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Moyen de paiement
              </Label>

              {/* Grille : moyens de paiement + Crédit */}
              <div className="grid grid-cols-3 gap-2">
                {paymentMethods.map(m => {
                  const selected = !isCreditSale && t.method === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setIsCreditSale(false); patchPayment({ method: m.id }); }}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 transition-all ${selected
                        ? "border-orange-500 bg-orange-50 text-orange-700 shadow-sm"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                      {methodIcon(m.method_type)}
                      <span className="text-xs font-medium text-center leading-tight">{m.name}</span>
                    </button>
                  );
                })}
                {/* Tuile Crédit */}
                <button
                  type="button"
                  title={!selectedCustomer ? "Sélectionnez d'abord un client" : undefined}
                  onClick={() => {
                    if (!selectedCustomer) {
                      toast.error("Sélectionnez un client avant de passer en vente à crédit");
                      return;
                    }
                    setIsCreditSale(true);
                  }}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 transition-all ${isCreditSale
                    ? "border-amber-500 bg-amber-50 text-amber-700 shadow-sm"
                    : !selectedCustomer
                      ? "border-gray-200 bg-gray-50 text-gray-400 opacity-60"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  <HandCoins className="h-5 w-5" />
                  <span className="text-xs font-medium">Crédit</span>
                </button>
              </div>

              {/* Montant reçu (ou acompte en mode crédit) + devise du règlement */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {isCreditSale ? "Acompte (optionnel)" : "Montant reçu"}
                  </Label>
                  {orgCurrencies.length > 1 && (
                    <div className="flex gap-1">
                      {orgCurrencies.map(c => (
                        <button
                          key={c.currency_code}
                          type="button"
                          onClick={() => {
                            // Conserver la VALEUR reçue en la ré-exprimant dans la
                            // nouvelle devise (ex. 20 USD → 46 000 CDF).
                            const amt = parseFloat(t.amount) || 0;
                            const conv = amt > 0
                              ? roundMoney(convertAmount(amt, t.currency, c.currency_code), c.currency_code).toString()
                              : t.amount;
                            patchPayment({ currency: c.currency_code, amount: conv });
                          }}
                          className={`px-2 py-1 rounded-md border text-xs font-semibold ${t.currency === c.currency_code
                            ? "border-orange-500 bg-orange-50 text-orange-700"
                            : "border-gray-200 bg-white text-gray-500"
                            }`}
                        >
                          {c.currency_code}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <CircleDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="number" step="any" min="0"
                    value={t.amount}
                    onChange={e => patchPayment({ amount: e.target.value })}
                    className="h-11 text-xl text-center font-bold pl-10 pr-16 ring-0"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
                    {symbolOf(t.currency)}
                  </span>
                </div>
                {t.currency !== saleCurrency() && amt > 0 && (
                  <p className="text-xs text-blue-600">
                    = {money(convMoney(amt, t.currency, saleCurrency()))}
                    {"  "}(1 {t.currency} = {formatNumber(rateOf(t.currency) / rateOf(saleCurrency()))} {symbolOf(saleCurrency())})
                  </p>
                )}
                {method?.requires_reference && !isCreditSale && (
                  <Input
                    value={t.reference}
                    onChange={e => patchPayment({ reference: e.target.value })}
                    placeholder="N° transaction, référence..."
                    className="h-9"
                  />
                )}
              </div>

              {/* Total payé + monnaie/crédit - exprimés dans la devise ENCAISSÉE */}
              <div className="p-3 bg-gray-50 rounded-xl space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total payé</span>
                  <span className="font-semibold">{money(paidInPay, payCur)}</span>
                </div>

                {/* Vente à crédit : montant restant à crédit (devise encaissée) */}
                {isCreditSale && totalInSale() - paidInSale() > MONEY_EPS && (
                  <div className="flex justify-between text-orange-700 font-medium">
                    <span>Montant à crédit</span>
                    <span className="text-lg font-bold">{money(missingInPay, payCur)}</span>
                  </div>
                )}

                {/* Insuffisant (comptant) */}
                {!isCreditSale && paidInSale() + MONEY_EPS < totalInSale() && (
                  <div className="flex justify-between text-red-600 font-medium">
                    <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Il manque</span>
                    <span>{money(missingInPay, payCur)}</span>
                  </div>
                )}

                {/* Monnaie à rendre + devise de la monnaie (choix caissier) */}
                {!isCreditSale && paidInSale() - totalInSale() > MONEY_EPS && (
                  <div className="pt-2 border-t border-gray-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-green-700 font-medium">Monnaie à rendre</span>
                      {orgCurrencies.length > 1 && (
                        <div className="flex gap-1">
                          {orgCurrencies.map(c => (
                            <button
                              key={c.currency_code}
                              type="button"
                              onClick={() => setChangeCurrency(c.currency_code)}
                              className={`px-2 py-1 rounded-md border text-xs font-semibold ${(changeCurrency || saleCurrency()) === c.currency_code
                                ? "border-green-500 bg-green-50 text-green-700"
                                : "border-gray-200 bg-white text-gray-500"
                                }`}
                            >
                              {c.currency_code}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <span className="text-2xl font-bold text-green-700">
                        {money(changeInChangeCurrency(), changeCurrency || saleCurrency())}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
              );
            })()}
          </div>

          {/* Footer with confirm button */}
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 flex-shrink-0 border-t mt-2">
            <Button
              variant="outline"
              onClick={() => setShowPaymentDialog(false)}
              disabled={isProcessing}
              className="sm:flex-1"
            >
              Annuler
            </Button>
            <Button
              className="sm:flex-[2] bg-green-600 hover:bg-green-700 gap-2"
              onClick={handlePayment}
              disabled={(() => {
                if (isProcessing) return true;
                if (total < 0) return true;
                // Comptant : comparer le payé au total EN DEVISE DE VENTE avec la
                // même tolérance que l'affichage (sinon bouton bloqué alors que
                // l'UI indique « payé en totalité »).
                if (!isCreditSale && paidInSale() + MONEY_EPS < totalInSale()) return true;
                if (isCreditSale && !selectedCustomer) return true;
                if (isCreditSale && selectedCustomer) {
                  const creditLimit = parseFloat(selectedCustomer.credit_limit || "0");
                  const currentBalance = parseFloat(selectedCustomer.current_balance || "0");
                  const paidInPrimary = getAmountInPrimary();
                  const creditAmount = total - paidInPrimary;
                  const newBalance = currentBalance + creditAmount;
                  if (creditLimit > 0 && newBalance > creditLimit) return true;
                }
                return false;
              })()}
            >
              {isProcessing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Printer className="h-5 w-5" />
              )}
              {isProcessing
                ? "Traitement..."
                : isCreditSale
                  ? "Confirmer la vente à crédit"
                  : `Encaisser ${(() => {
                      const pc = tenders[0]?.currency || saleCurrency();
                      return money(convMoney(totalInSale(), saleCurrency(), pc), pc);
                    })()}`
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Session Dialog */}
      <Dialog open={showCloseSessionDialog} onOpenChange={setShowCloseSessionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fermer la session de caisse</DialogTitle>
            <DialogDescription>
              Caisse: {currentSession?.register_name} - Ouverte par {currentSession?.opened_by_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Ventes effectuées</span>
                <span className="font-medium">{currentSession?.sales_count || 0} ventes</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total des ventes</span>
                <span className="text-orange-600">{formatPrice(parseFloat(currentSession?.sales_total || "0"))}</span>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Le solde de fermeture est calculé automatiquement à partir des paiements en espèces enregistrés.
            </p>

            {cart.length > 0 && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Vous avez {cart.length} article(s) dans le panier. Ils seront perdus si vous fermez la session.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseSessionDialog(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleCloseSession}
              disabled={isClosingSession}
            >
              {isClosingSession ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Fermer la session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sortie de caisse avec un panier en cours */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quitter la caisse ?</DialogTitle>
            <DialogDescription>
              La session de caisse reste ouverte : vous pourrez y revenir depuis la
              liste des caisses.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm leading-snug text-amber-800">
              Le panier en cours ({cart.length} article{cart.length > 1 ? "s" : ""}
              {" "}pour {formatPrice(total)}) sera perdu.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>
              Rester à la caisse
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowLeaveDialog(false);
                router.push("/dashboard/sales/registers");
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quitter sans encaisser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Dialog */}
      <Dialog open={showCustomerDialog} onOpenChange={(open) => {
        setShowCustomerDialog(open);
        if (!open) {
          setCustomerDialogMode("search");
          setCustomerSearch("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {customerDialogMode === "search" ? "Sélectionner un client" : "Nouveau client"}
            </DialogTitle>
            <DialogDescription>
              {customerDialogMode === "search"
                ? "Recherchez un client existant ou créez-en un nouveau"
                : "Créez rapidement un client pour cette vente"}
            </DialogDescription>
          </DialogHeader>

          {customerDialogMode === "search" ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par nom ou téléphone..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredCustomers.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 mb-3">Aucun client trouvé</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewCustomerData({
                          name: customerSearch,
                          phone: "",
                          customer_type: "individual",
                        });
                        setCustomerDialogMode("create");
                      }}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Créer &quot;{customerSearch}&quot;
                    </Button>
                  </div>
                ) : (
                  filteredCustomers.map(customer => (
                    <Button
                      key={customer.id}
                      variant="ghost"
                      className="w-full justify-start h-auto py-3"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setShowCustomerDialog(false);
                        setCustomerSearch("");
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-full">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium">{customer.name} <span className="text-xs text-gray-400 font-normal">{customer.code}</span></p>
                          <p className="text-xs text-gray-500">
                            {customer.phone || "Pas de téléphone"}
                          </p>
                        </div>
                      </div>
                    </Button>
                  ))
                )}
              </div>

              <DialogFooter className="flex-row justify-between sm:justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewCustomerData({ name: "", phone: "", customer_type: "individual" });
                    setCustomerDialogMode("create");
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Nouveau client
                </Button>
                <Button variant="outline" onClick={() => setShowCustomerDialog(false)}>
                  Fermer
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Type */}
              <div className="space-y-2">
                <Label>Type de client</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={newCustomerData.customer_type === "individual" ? "default" : "outline"}
                    className={newCustomerData.customer_type === "individual" ? "bg-orange-500 hover:bg-orange-600" : ""}
                    onClick={() => setNewCustomerData({ ...newCustomerData, customer_type: "individual", company_name: "", tax_id: "" })}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Particulier
                  </Button>
                  <Button
                    type="button"
                    variant={newCustomerData.customer_type === "business" ? "default" : "outline"}
                    className={newCustomerData.customer_type === "business" ? "bg-orange-500 hover:bg-orange-600" : ""}
                    onClick={() => setNewCustomerData({ ...newCustomerData, customer_type: "business" })}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Entreprise
                  </Button>
                </div>
              </div>

              {/* Nom */}
              <div className="space-y-2">
                <Label htmlFor="pos-customer-name">
                  {newCustomerData.customer_type === "business" ? "Nom de l'entreprise" : "Nom complet"} *
                </Label>
                <Input
                  id="pos-customer-name"
                  value={newCustomerData.name}
                  onChange={e => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                  placeholder={newCustomerData.customer_type === "business" ? "Ex: Congo Tech SARL" : "Ex: Jean Mukendi"}
                  autoFocus
                />
              </div>

              {/* Raison sociale (entreprise) */}
              {newCustomerData.customer_type === "business" && (
                <div className="space-y-2">
                  <Label htmlFor="pos-customer-company">Raison sociale</Label>
                  <Input
                    id="pos-customer-company"
                    value={newCustomerData.company_name || ""}
                    onChange={e => setNewCustomerData({ ...newCustomerData, company_name: e.target.value })}
                    placeholder="Raison sociale complète"
                  />
                </div>
              )}

              {/* Téléphone */}
              <div className="space-y-2">
                <Label htmlFor="pos-customer-phone">Téléphone *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="pos-customer-phone"
                    value={newCustomerData.phone}
                    onChange={e => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                    placeholder="+243 XXX XXX XXX"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="pos-customer-email">Email</Label>
                <Input
                  id="pos-customer-email"
                  type="email"
                  value={newCustomerData.email || ""}
                  onChange={e => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                  placeholder="client@exemple.com"
                />
              </div>

              {/* Adresse */}
              <div className="space-y-2">
                <Label htmlFor="pos-customer-address">Adresse</Label>
                <Input
                  id="pos-customer-address"
                  value={newCustomerData.address || ""}
                  onChange={e => setNewCustomerData({ ...newCustomerData, address: e.target.value })}
                  placeholder="Avenue, numéro, quartier..."
                />
              </div>

              {/* NIF/RCCM (entreprise) */}
              {newCustomerData.customer_type === "business" && (
                <div className="space-y-2">
                  <Label htmlFor="pos-customer-tax">N° Impôt / RCCM</Label>
                  <Input
                    id="pos-customer-tax"
                    value={newCustomerData.tax_id || ""}
                    onChange={e => setNewCustomerData({ ...newCustomerData, tax_id: e.target.value })}
                    placeholder="NIF ou RCCM"
                  />
                </div>
              )}

              <DialogFooter className="flex-row justify-between sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCustomerDialogMode("search")}
                >
                  Retour
                </Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={handleCreateCustomer}
                  disabled={isCreatingCustomer || !newCustomerData.name.trim() || !newCustomerData.phone?.trim()}
                >
                  {isCreatingCustomer ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Créer et sélectionner
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
