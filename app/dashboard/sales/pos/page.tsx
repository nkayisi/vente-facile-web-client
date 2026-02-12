"use client";

import { Customer, getCustomers, createCustomer, CreateCustomerData } from "@/actions/contacts.actions";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import { getProducts, Product } from "@/actions/products.actions";
import {
  CloseSessionData,
  closeSession,
  CreatePaymentData,
  createSale,
  CreateSaleItemData,
  getCurrentSession,
  getPaymentMethods,
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
  Banknote,
  Building2,
  Check,
  CreditCard,
  Loader2,
  LogOut,
  Minus,
  Package,
  Percent,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  User,
  UserPlus,
  X
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatPrice, formatNumber } from "@/lib/format";

interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
}

export default function POSPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

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
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Payment dialog
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

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
  const [closingBalance, setClosingBalance] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [isClosingSession, setIsClosingSession] = useState(false);

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

          // Fetch products, customers, payment methods
          const [productsResult, customersResult, paymentMethodsResult] = await Promise.all([
            getProducts(session.accessToken, org.id, { is_active: true, in_stock: true }),
            getCustomers(session.accessToken, org.id),
            getPaymentMethods(session.accessToken, org.id, { is_active: true }),
          ]);

          if (productsResult.success && productsResult.data) {
            setProducts(productsResult.data.results || []);
          }
          if (customersResult.success && customersResult.data) {
            setCustomers(customersResult.data);
          }
          if (paymentMethodsResult.success && paymentMethodsResult.data) {
            setPaymentMethods(paymentMethodsResult.data);
            // Set default payment method
            const defaultMethod = paymentMethodsResult.data.find((m: PaymentMethod) => m.is_default);
            if (defaultMethod) {
              setSelectedPaymentMethod(defaultMethod.id);
            } else if (paymentMethodsResult.data.length > 0) {
              setSelectedPaymentMethod(paymentMethodsResult.data[0].id);
            }
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
  }, [session, router]);

  // Focus search on load
  useEffect(() => {
    if (!isLoading && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isLoading]);

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

  // Add product to cart
  const addToCart = (product: Product) => {
    const available = getAvailableStock(product);
    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    const currentQty = existingIndex >= 0 ? cart[existingIndex].quantity : 0;

    if (product.track_inventory && !product.allow_negative_stock && currentQty + 1 > available) {
      toast.warning(
        `Stock insuffisant pour "${product.name}". Disponible: ${available}`,
        { duration: 4000 }
      );
      return;
    }

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          product,
          quantity: 1,
          unit_price: parseFloat(product.selling_price),
          discount_percentage: 0,
        },
      ]);
    }

    setSearchQuery("");
    searchInputRef.current?.focus();
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

  // Update item discount
  const updateItemDiscount = (index: number, discount: number) => {
    const newCart = [...cart];
    newCart[index].discount_percentage = Math.min(100, Math.max(0, discount));
    setCart(newCart);
  };

  // Arrondir à 2 décimales
  const r2 = (n: number) => Math.round(n * 100) / 100;

  // Calculate totals
  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + r2(item.quantity * item.unit_price), 0);
  };

  const calculateItemDiscount = () => {
    return cart.reduce((sum, item) => {
      const itemTotal = r2(item.quantity * item.unit_price);
      return sum + r2(itemTotal * item.discount_percentage / 100);
    }, 0);
  };

  const calculateGlobalDiscountAmount = () => {
    const subtotalAfterItemDiscount = r2(calculateSubtotal() - calculateItemDiscount());
    return r2(subtotalAfterItemDiscount * globalDiscount / 100);
  };

  const calculateTax = () => {
    return cart.reduce((sum, item) => {
      if (!item.product.is_taxable) return sum;

      const itemTotal = r2(item.quantity * item.unit_price);
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


  // Process payment
  const handlePayment = async () => {
    if (!selectedPaymentMethod) {
      toast.error("Sélectionnez un mode de paiement");
      return;
    }

    if (!session?.accessToken || !organization || !currentSession) {
      toast.error("Session invalide");
      return;
    }

    const total = calculateTotal();
    const amount = parseFloat(paymentAmount) || total;

    if (amount <= 0) {
      toast.error("Montant invalide");
      return;
    }

    if (amount < total) {
      toast.error(`Le montant payé (${formatPrice(amount)}) est inférieur au total (${formatPrice(total)})`);
      return;
    }

    setIsProcessing(true);

    try {
      const items: CreateSaleItemData[] = cart.map(item => ({
        product: item.product.id,
        quantity: item.quantity,
        unit_price: r2(item.unit_price),
        discount_percentage: r2(item.discount_percentage),
      }));

      const payments: CreatePaymentData[] = [
        {
          payment_method: selectedPaymentMethod,
          amount: r2(amount),
        },
      ];

      const result = await createSale(session.accessToken, organization.id, {
        register: currentSession.register,
        warehouse: currentSession.warehouse || undefined,
        customer: selectedCustomer?.id,
        sale_type: "retail",
        discount_percentage: globalDiscount,
        is_pos: true,
        items,
        payments,
      });

      if (result.success) {
        toast.success(`Vente ${result.data?.reference} créée avec succès`);

        // Reset cart
        setCart([]);
        setSelectedCustomer(null);
        setGlobalDiscount(0);
        setPaymentAmount("");
        setShowPaymentDialog(false);

        // Refresh products to get updated stock
        if (organization) {
          const productsResult = await getProducts(session.accessToken, organization.id, { is_active: true, in_stock: true });
          if (productsResult.success && productsResult.data) {
            setProducts(productsResult.data.results || []);
          }
        }

        // Focus search
        searchInputRef.current?.focus();
      } else {
        // Parse backend errors for clear display
        const errors = result.errors;
        let errorMsg = result.message || "Erreur lors de la création de la vente";

        if (errors) {
          // Handle stock validation errors
          if (errors.items) {
            const itemsError = Array.isArray(errors.items) ? errors.items.join(". ") : String(errors.items);
            errorMsg = itemsError;
          }
          // Handle other field errors
          const fieldErrors = Object.entries(errors)
            .filter(([key]) => key !== 'items')
            .map(([, val]) => Array.isArray(val) ? val.join(". ") : String(val))
            .filter(Boolean);
          if (fieldErrors.length > 0) {
            errorMsg = [errorMsg, ...fieldErrors].join(" | ");
          }
        }

        toast.error(errorMsg, {
          duration: 6000,
          description: errorMsg.includes("Stock") ? "Veuillez ajuster les quantités dans le panier." : undefined,
        });

        // Close payment dialog on stock error so seller can adjust cart
        if (errorMsg.includes("Stock") || errorMsg.includes("stock")) {
          setShowPaymentDialog(false);
        }
      }
    } catch (error) {
      toast.error("Une erreur est survenue lors de la vente");
    } finally {
      setIsProcessing(false);
    }
  };

  // Close session handler
  const handleCloseSession = async () => {
    if (!session?.accessToken || !organization || !currentSession) return;

    setIsClosingSession(true);
    try {
      const data: CloseSessionData = {
        closing_balance: parseFloat(closingBalance) || 0,
        notes: closingNotes || undefined,
      };

      const result = await closeSession(
        session.accessToken,
        organization.id,
        currentSession.id,
        data
      );

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

  // Filter products
  const filteredProducts = products.filter(
    p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery))
  );

  // Filter customers
  const filteredCustomers = customers.filter(
    c =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch))
  );

  // Get payment method icon
  const getPaymentIcon = (type: string) => {
    switch (type) {
      case "cash":
        return <Banknote className="h-5 w-5" />;
      case "card":
        return <CreditCard className="h-5 w-5" />;
      case "mobile_money":
        return <Smartphone className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const total = calculateTotal();
  const change = (parseFloat(paymentAmount) || 0) - total;

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col lg:flex-row gap-4 -m-4 lg:-m-6 p-4 lg:p-6 bg-gray-100 relative">
      {/* Products Section */}
      <div className="flex-1 flex flex-col min-h-0 pb-20 lg:pb-0">
        {/* Search + Close Session */}
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              ref={searchInputRef}
              placeholder="Rechercher un produit (nom, SKU, code-barres)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-lg bg-white"
            />
          </div>
          <Button
            variant="outline"
            className="h-12 bg-white text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            onClick={() => {
              setClosingBalance("");
              setClosingNotes("");
              setShowCloseSessionDialog(true);
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Fermer la caisse
          </Button>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto">
          {searchQuery && filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Aucun produit trouvé</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {(searchQuery ? filteredProducts : products.slice(0, 20)).map(product => (
                <Card
                  key={product.id}
                  className={`cursor-pointer hover:shadow-md transition-shadow py-0 ${product.track_inventory && getRemainingStock(product) <= 0 ? 'opacity-50' : ''}`}
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-3">
                    <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden relative">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="h-8 w-8 text-gray-300" />
                      )}
                      {product.track_inventory && (
                        <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-xs font-bold ${getRemainingStock(product) <= 0
                          ? 'bg-red-500 text-white'
                          : getRemainingStock(product) <= (product.reorder_point || 5)
                            ? 'bg-amber-500 text-white'
                            : 'bg-green-600 text-white'
                          }`}>
                          {formatNumber(getAvailableStock(product))}
                        </div>
                      )}
                    </div>
                    <h3 className="font-medium text-sm text-gray-900 truncate">{product.name}</h3>
                    <p className="text-xs text-gray-500 truncate">{product.sku}</p>
                    <p className="text-sm font-bold text-orange-600 mt-1">
                      {formatPrice(parseFloat(product.selling_price))}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Cart Toggle Bar */}
      {cart.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t shadow-[0_-4px_12px_rgba(0,0,0,0.1)] px-4 py-3 cursor-pointer"
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
      )}

      {/* Mobile Cart Overlay */}
      {showMobileCart && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileCart(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
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
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item, index) => {
                const stockAvailable = getAvailableStock(item.product);
                const overStock = item.product.track_inventory && !item.product.allow_negative_stock && item.quantity > stockAvailable;
                return (
                  <div key={item.product.id} className={`rounded-lg p-3 ${overStock ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 truncate">{item.product.name}</h4>
                        <p className="text-xs text-gray-500">{formatPrice(item.unit_price)} × {item.quantity}</p>
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
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(index, -1)}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(index, 1)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="font-bold text-gray-900">
                        {formatPrice(item.quantity * item.unit_price * (1 - item.discount_percentage / 100))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Mobile Cart Footer */}
            <div className="p-4 border-t space-y-3">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  placeholder="Remise %"
                  value={globalDiscount || ""}
                  onChange={e => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                  className="h-8"
                  min="0"
                  max="100"
                />
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-orange-600">{formatPrice(total)}</span>
              </div>
              <Button
                className="w-full h-12 text-lg bg-orange-500 hover:bg-orange-600"
                disabled={cart.length === 0}
                onClick={() => {
                  setShowMobileCart(false);
                  const totalAmount = calculateTotal();
                  setPaymentAmount(totalAmount.toString());
                  setSelectedPaymentMethod("");
                  setShowPaymentDialog(true);
                }}
              >
                <CreditCard className="h-5 w-5 mr-2" />
                Payer {formatPrice(total)}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Section - Desktop */}
      <div className="hidden lg:flex w-96 flex-col bg-white rounded-lg shadow-lg">
        {/* Cart Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-gray-900 truncate">
                        {item.product.name}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {formatPrice(item.unit_price)} × {item.quantity}
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
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(index, -1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(index, 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="font-bold text-gray-900">
                      {formatPrice(item.quantity * item.unit_price * (1 - item.discount_percentage / 100))}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Footer */}
        <div className="p-4 border-t space-y-3">
          {/* Global Discount */}
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-gray-400" />
            <Input
              type="number"
              placeholder="Remise %"
              value={globalDiscount || ""}
              onChange={e => setGlobalDiscount(parseFloat(e.target.value) || 0)}
              className="h-8"
              min="0"
              max="100"
            />
          </div>

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Sous-total</span>
              <span>{formatPrice(calculateSubtotal())}</span>
            </div>
            {calculateItemDiscount() > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Remises articles</span>
                <span>-{formatPrice(calculateItemDiscount())}</span>
              </div>
            )}
            {globalDiscount > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Remise globale ({globalDiscount}%)</span>
                <span>-{formatPrice(calculateGlobalDiscountAmount())}</span>
              </div>
            )}
            {calculateTax() > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Taxes (TVA)</span>
                <span>+{formatPrice(calculateTax())}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total à payer</span>
              <span className="text-orange-600">{formatPrice(total)}</span>
            </div>
          </div>

          {/* Payment Button */}
          <Button
            className="w-full h-12 text-lg bg-orange-500 hover:bg-orange-600"
            disabled={cart.length === 0}
            onClick={() => {
              const totalAmount = calculateTotal();
              setPaymentAmount(totalAmount.toString());
              setSelectedPaymentMethod("");
              setShowPaymentDialog(true);
            }}
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Payer {formatPrice(total)}
          </Button>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Paiement</DialogTitle>
            <DialogDescription>
              Total à payer: <span className="font-bold text-orange-600">{formatPrice(total)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Payment Methods */}
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map(method => (
                <Button
                  key={method.id}
                  variant={selectedPaymentMethod === method.id ? "default" : "outline"}
                  className={`h-16 flex-col ${selectedPaymentMethod === method.id ? "bg-orange-500 hover:bg-orange-600" : ""
                    }`}
                  onClick={() => setSelectedPaymentMethod(method.id)}
                >
                  {getPaymentIcon(method.method_type)}
                  <span className="text-xs mt-1">{method.name}</span>
                </Button>
              ))}
            </div>

            {/* Total Breakdown */}
            <div className="p-3 bg-gray-50 rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Sous-total</span>
                <span className="font-medium">{formatPrice(calculateSubtotal())}</span>
              </div>
              {calculateItemDiscount() > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Remises</span>
                  <span>-{formatPrice(calculateItemDiscount())}</span>
                </div>
              )}
              {globalDiscount > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Remise globale</span>
                  <span>-{formatPrice(calculateGlobalDiscountAmount())}</span>
                </div>
              )}
              {calculateTax() > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Taxes (TVA)</span>
                  <span>+{formatPrice(calculateTax())}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-1 border-t border-gray-300">
                <span>Total à payer</span>
                <span className="text-orange-600">{formatPrice(total)}</span>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>Montant reçu (CDF)</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                className="h-12 text-xl text-center font-bold"
                placeholder={total.toString()}
              />
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2">
              {[1000, 5000, 10000, 20000].map(amount => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentAmount(((parseFloat(paymentAmount) || 0) + amount).toString())}
                >
                  +{amount / 1000}k
                </Button>
              ))}
            </div>

            {/* Change */}
            {change > 0 && (
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-green-700">Monnaie à rendre</span>
                  <span className="text-xl font-bold text-green-700">{formatPrice(change)}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Annuler
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handlePayment}
              disabled={isProcessing || (parseFloat(paymentAmount) || 0) < total}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirmer
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
              Caisse: {currentSession?.register_name} — Ouverte par {currentSession?.opened_by_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Solde d'ouverture</span>
                <span className="font-medium">{formatPrice(parseFloat(currentSession?.opening_balance || "0"))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Ventes effectuées</span>
                <span className="font-medium">{currentSession?.sales_count || 0} ventes</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total des ventes</span>
                <span className="text-orange-600">{formatPrice(parseFloat(currentSession?.sales_total || "0"))}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Solde de fermeture (CDF)</Label>
              <Input
                type="number"
                value={closingBalance}
                onChange={e => setClosingBalance(e.target.value)}
                placeholder="Comptez l'argent en caisse..."
                className="h-12 text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Input
                value={closingNotes}
                onChange={e => setClosingNotes(e.target.value)}
                placeholder="Remarques sur la session..."
              />
            </div>

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
