"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CreditCard,
  DollarSign,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShoppingCart,
  Trash2,
  User,
  Calendar,
  FileText,
  TrendingUp,
  Wallet,
  History,
  Banknote,
  AlertTriangle,
  Settings,
  Receipt,
  Smartphone,
  CheckCircle,
  CircleDollarSign,
  Printer,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatPrice, formatDateTime } from "@/lib/format";
import { useCurrency } from "@/components/providers/currency-provider";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getCustomer,
  deleteCustomer,
  updateCustomer,
  getCustomerTransactions,
  Customer,
  CustomerTransaction,
} from "@/actions/contacts.actions";
import {
  getSales,
  addPaymentToSale,
  getPaymentMethods,
  Sale,
  PaymentMethod,
} from "@/actions/sales.actions";
import {
  assignPdfToPrintWindow,
  closePrintTabIfBlank,
  generatePaymentReceiptPdfUrl,
  openPrintTab,
  PaymentReceiptData,
} from "@/lib/receipt-printer";
import { getCustomerLoyalty, CustomerLoyalty, LoyaltyProgram, getLoyaltyProgram } from "@/actions/settings.actions";
import { Star } from "lucide-react";

export default function CustomerDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;
  const { currency: defaultCurrency } = useCurrency();

  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Transactions
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [isLoadingTxns, setIsLoadingTxns] = useState(false);
  const [txnFilter, setTxnFilter] = useState<string>("all");

  // Credit limit dialog
  const [showCreditLimitDialog, setShowCreditLimitDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creditLimitValue, setCreditLimitValue] = useState("");

  // Loyalty points
  const [customerLoyalty, setCustomerLoyalty] = useState<CustomerLoyalty | null>(null);
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null);

  // Invoice payment dialog
  const [showInvoicePaymentDialog, setShowInvoicePaymentDialog] = useState(false);
  const [pendingSales, setPendingSales] = useState<Sale[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [invoicePaymentAmount, setInvoicePaymentAmount] = useState("");
  const [invoicePaymentRef, setInvoicePaymentRef] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          const result = await getCustomer(session.accessToken, org.id, customerId);
          if (result.success && result.data) {
            setCustomer(result.data);

            // Charger les points de fidélité du client
            const [loyaltyResult, programResult] = await Promise.all([
              getCustomerLoyalty(session.accessToken, org.id, customerId),
              getLoyaltyProgram(session.accessToken, org.id),
            ]);

            console.log('[Customer Detail] Loyalty result:', loyaltyResult);
            console.log('[Customer Detail] Program result:', programResult);

            if (loyaltyResult.success && loyaltyResult.data) {
              setCustomerLoyalty(loyaltyResult.data);
            } else {
              console.log('[Customer Detail] No loyalty data for customer');
            }

            if (programResult.success) {
              if (programResult.data) {
                console.log('[Customer Detail] Setting loyalty program:', programResult.data);
                setLoyaltyProgram(programResult.data);
              } else {
                console.log('[Customer Detail] Program result is null');
              }
            } else {
              console.error('[Customer Detail] Failed to load loyalty program:', programResult.message);
            }
          } else {
            toast.error("Client non trouvé");
            router.push("/dashboard/contacts/customers");
          }
        }
      } catch (error) {
        toast.error("Erreur lors du chargement");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.accessToken, customerId]);

  // Debug loyalty program state
  useEffect(() => {
    console.log('[Customer Detail] loyaltyProgram state changed:', loyaltyProgram);
  }, [loyaltyProgram]);

  // Refresh all data (customer + transactions)
  const refreshData = useCallback(async () => {
    if (!session?.accessToken || !organization) return;
    try {
      const result = await getCustomer(session.accessToken, organization.id, customerId);
      if (result.success && result.data) {
        setCustomer(result.data);
      }
    } catch (error) {
      console.error("Error refreshing customer:", error);
    }
  }, [session?.accessToken, organization, customerId]);

  // Load pending sales for this customer
  const loadPendingSales = useCallback(async () => {
    if (!session?.accessToken || !organization) return;
    try {
      const [partiallyPaidResult, pendingResult, methodsResult] = await Promise.all([
        getSales(session.accessToken, organization.id, { status: "partially_paid", customer: customerId }),
        getSales(session.accessToken, organization.id, { status: "pending", customer: customerId }),
        getPaymentMethods(session.accessToken, organization.id, { is_active: true }),
      ]);

      const allSales = [
        ...(Array.isArray(partiallyPaidResult.data) ? partiallyPaidResult.data : (partiallyPaidResult.data as any)?.results || []),
        ...(Array.isArray(pendingResult.data) ? pendingResult.data : (pendingResult.data as any)?.results || [])
      ];
      setPendingSales(allSales);

      if (methodsResult.success && methodsResult.data) {
        setPaymentMethods(Array.isArray(methodsResult.data) ? methodsResult.data : (methodsResult.data as any).results || []);
      }
    } catch (error) {
      console.error("Error loading pending sales:", error);
    }
  }, [session?.accessToken, organization, customerId]);

  // Load transactions
  const loadTransactions = useCallback(async () => {
    if (!session?.accessToken || !organization) return;
    setIsLoadingTxns(true);
    try {
      const typeParam = txnFilter === "all" ? undefined : txnFilter;
      const result = await getCustomerTransactions(
        session.accessToken, organization.id, customerId, typeParam
      );
      if (result.success && result.data) {
        setTransactions(result.data);
      }
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setIsLoadingTxns(false);
    }
  }, [session?.accessToken, organization, customerId, txnFilter]);

  useEffect(() => {
    if (organization && customer) {
      loadTransactions();
      loadPendingSales();
    }
  }, [organization, customer, txnFilter]);

  // Handle invoice payment
  const handleInvoicePayment = async () => {
    if (!session?.accessToken || !organization || !customer || !selectedSale) return;

    if (!selectedPaymentMethod) {
      toast.error("Sélectionnez un mode de paiement");
      return;
    }

    const amount = parseFloat(invoicePaymentAmount);
    if (amount <= 0) {
      toast.error("Montant invalide");
      return;
    }

    const amountDue = parseFloat(selectedSale.amount_due);
    if (amount > amountDue) {
      toast.error(`Le montant ne peut pas dépasser ${formatPrice(amountDue)}`);
      return;
    }

    const printTab = openPrintTab();
    setIsSubmitting(true);
    try {
      const result = await addPaymentToSale(
        session.accessToken,
        organization.id,
        selectedSale.id,
        {
          payment_method: selectedPaymentMethod,
          amount: amount,
          reference: invoicePaymentRef || undefined,
        }
      );

      if (result.success) {
        const selectedMethod = paymentMethods.find(m => m.id === selectedPaymentMethod);
        const previouslyPaid = parseFloat(selectedSale.amount_paid);
        const remainingBalance = amountDue - amount;

        const receiptData: PaymentReceiptData = {
          orgName: organization.name || "Vente Facile",
          receiptNumber: `PAY-${Date.now().toString(36).toUpperCase()}`,
          date: new Date().toLocaleString("fr-CD"),
          customerName: customer.name,
          customerPhone: customer.phone || undefined,
          paymentMethod: selectedMethod?.name || "Espèces",
          paymentReference: invoicePaymentRef || undefined,
          amountPaid: amount,
          currency: defaultCurrency.code,
          saleReference: selectedSale.reference,
          saleTotalAmount: parseFloat(selectedSale.total),
          previouslyPaid: previouslyPaid,
          remainingBalance: remainingBalance,
        };

        const pdfUrl = generatePaymentReceiptPdfUrl(receiptData);
        const pdfOutcome = assignPdfToPrintWindow(printTab, pdfUrl, {
          filename: `paiement-${selectedSale.reference}.pdf`,
        });

        toast.success("Paiement ajouté avec succès", {
          description:
            pdfOutcome === "opened"
              ? "PDF ouvert et enregistré — utilisez Thermer ou Partager pour imprimer."
              : "Reçu téléchargé — l’onglet n’a pas pu s’ouvrir ; ouvrez le fichier dans Thermer.",
        });

        setShowInvoicePaymentDialog(false);
        setSelectedSale(null);
        setSelectedPaymentMethod("");
        setInvoicePaymentAmount("");
        setInvoicePaymentRef("");

        // Refresh data
        await refreshData();
        loadTransactions();
        loadPendingSales();
      } else {
        closePrintTabIfBlank(printTab);
        toast.error(result.message || "Erreur lors de l'ajout du paiement");
      }
    } catch (error) {
      closePrintTabIfBlank(printTab);
      console.error("Error adding payment:", error);
      toast.error("Erreur lors de l'ajout du paiement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openInvoicePaymentDialog = (sale: Sale) => {
    setSelectedSale(sale);
    setInvoicePaymentAmount(sale.amount_due);
    // Définir Espèces comme méthode par défaut
    const cashMethod = paymentMethods.find(m => m.method_type === "cash");
    setSelectedPaymentMethod(cashMethod?.id || "");
    setInvoicePaymentRef("");
    setShowInvoicePaymentDialog(true);
  };

  const handleUpdateCreditLimit = async () => {
    if (!session?.accessToken || !organization || !customer) return;
    const newLimit = parseFloat(creditLimitValue);
    if (isNaN(newLimit) || newLimit < 0) {
      toast.error("Le montant doit être 0 ou plus");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateCustomer(
        session.accessToken, organization.id, customer.id,
        { credit_limit: newLimit }
      );
      if (result.success) {
        toast.success("Limite de crédit mise à jour");
        setShowCreditLimitDialog(false);
        await refreshData();
      } else {
        toast.error(result.message || "Erreur");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!session?.accessToken || !organization || !customer) return;

    setIsDeleting(true);
    try {
      const result = await deleteCustomer(session.accessToken, organization.id, customer.id);
      if (result.success) {
        toast.success("Client supprimé avec succès");
        router.push("/dashboard/contacts/customers");
      } else {
        toast.error(result.message || "Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsDeleting(false);
    }
  };

  const getTxnIcon = (type: string) => {
    switch (type) {
      case "credit_sale": return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case "payment": return <CreditCard className="h-4 w-4 text-green-500" />;
      case "advance": return <Banknote className="h-4 w-4 text-blue-500" />;
      case "adjustment": return <DollarSign className="h-4 w-4 text-orange-500" />;
      case "refund": return <ArrowUpRight className="h-4 w-4 text-purple-500" />;
      default: return <DollarSign className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTxnColor = (type: string) => {
    switch (type) {
      case "credit_sale": return "text-red-600";
      case "payment": return "text-green-600";
      case "advance": return "text-blue-600";
      case "adjustment": return "text-orange-600";
      case "refund": return "text-purple-600";
      default: return "text-gray-600";
    }
  };

  const getTxnSign = (type: string) => {
    return type === "credit_sale" || type === "refund" ? "+" : "-";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Client non trouvé</h3>
        <Link href="/dashboard/contacts/customers">
          <Button variant="outline">Retour aux clients</Button>
        </Link>
      </div>
    );
  }

  const balance = parseFloat(customer.current_balance);
  const creditLimit = parseFloat(customer.credit_limit);
  const availableCredit = parseFloat(customer.available_credit || "0");
  const totalPurchases = parseFloat(customer.total_purchases || "0");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/contacts/customers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${customer.customer_type === "business" ? "bg-purple-100" : "bg-blue-100"}`}>
              {customer.customer_type === "business" ? (
                <Building2 className="h-6 w-6 text-purple-600" />
              ) : (
                <User className="h-6 w-6 text-blue-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
                <Badge variant={customer.is_active ? "default" : "secondary"}
                  className={customer.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                  {customer.is_active ? "Actif" : "Inactif"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <span>{customer.code}</span>
                <span>·</span>
                <span>{customer.customer_type === "business" ? "Entreprise" : "Particulier"}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => { setCreditLimitValue(customer.credit_limit || "0"); setShowCreditLimitDialog(true); }}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configurer la limite de crédit
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowDeleteDialog(true);
            }}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${balance > 0 ? "bg-red-100" : balance < 0 ? "bg-blue-100" : "bg-green-100"}`}>
                <Wallet className={`h-5 w-5 ${balance > 0 ? "text-red-600" : balance < 0 ? "text-blue-600" : "text-green-600"}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">
                  {balance > 0 ? "Dette du client" : balance < 0 ? "Avance du client" : "Situation"}
                </p>
                <p className={`text-lg font-bold ${balance > 0 ? "text-red-600" : balance < 0 ? "text-blue-600" : "text-green-600"}`}>
                  {balance > 0 ? formatPrice(balance) : balance < 0 ? formatPrice(Math.abs(balance)) : "Aucune dette"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <CreditCard className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Limite de crédit autorisée</p>
                <p className="text-lg font-bold">
                  {creditLimit > 0 ? formatPrice(creditLimit) : "Non définie"}
                </p>
                {creditLimit > 0 && (
                  <p className="text-xs text-gray-400">
                    Encore {formatPrice(Math.max(0, availableCredit))} disponible
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total des achats</p>
                <p className="text-lg font-bold">{formatPrice(totalPurchases)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Ventes récentes</p>
                <p className="text-lg font-bold">{customer.recent_sales?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loyalty Points Card - Always show for debugging, with conditional styling */}
      <Card className={`border-2 ${loyaltyProgram?.is_active ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-400' : 'bg-gray-100 border-gray-300'}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${loyaltyProgram?.is_active ? 'bg-amber-100' : 'bg-gray-200'}`}>
                <Star className={`h-6 w-6 ${loyaltyProgram?.is_active ? 'text-amber-600 fill-amber-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${loyaltyProgram?.is_active ? 'text-amber-700' : 'text-gray-500'}`}>
                  Points de fidélité {!loyaltyProgram?.is_active && '(Programme inactif)'}
                </p>
                <p className={`text-4xl font-bold ${loyaltyProgram?.is_active ? 'text-amber-800' : 'text-gray-400'}`}>
                  {customerLoyalty?.current_points || 0} <span className="text-xl font-normal">pts</span>
                </p>
              </div>
            </div>
            <div className="text-right space-y-1">
              <p className={`text-sm ${loyaltyProgram?.is_active ? 'text-amber-700' : 'text-gray-500'}`}>
                Total gagné: <span className="font-semibold">{customerLoyalty?.total_points_earned || 0} pts</span>
              </p>
              <p className={`text-sm ${loyaltyProgram?.is_active ? 'text-amber-700' : 'text-gray-500'}`}>
                Total utilisé: <span className="font-semibold">{customerLoyalty?.total_points_redeemed || 0} pts</span>
              </p>
              {loyaltyProgram?.is_active && loyaltyProgram.min_points_to_redeem > 0 && (
                <p className="text-xs text-amber-600 mt-2">
                  Min. pour utiliser: {loyaltyProgram.min_points_to_redeem} pts
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Details + Transactions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations de contact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {customer.customer_type === "business" && customer.company_name && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Raison sociale</p>
                      <p className="font-medium">{customer.company_name}</p>
                    </div>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Téléphone</p>
                      <p className="font-medium">{customer.phone}</p>
                    </div>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium">{customer.email}</p>
                    </div>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Adresse</p>
                      <p className="font-medium">{customer.address}</p>
                    </div>
                  </div>
                )}
                {customer.customer_type === "business" && customer.tax_id && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">N° Impôt / RCCM</p>
                      <p className="font-medium">{customer.tax_id}</p>
                    </div>
                  </div>
                )}
              </div>

              {customer.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{customer.notes}</p>
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Situation financière</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">Limite de crédit autorisée</p>
                      <button
                        onClick={() => { setCreditLimitValue(customer.credit_limit || "0"); setShowCreditLimitDialog(true); }}
                        className="text-gray-400 hover:text-orange-500"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="font-semibold">{creditLimit > 0 ? formatPrice(creditLimit) : "Non définie"}</p>
                    {creditLimit > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Le client peut prendre à crédit jusqu&apos;à {formatPrice(creditLimit)} au total
                      </p>
                    )}
                  </div>
                  <div className={`p-3 rounded-lg ${balance > 0 ? "bg-red-50" : balance < 0 ? "bg-blue-50" : "bg-green-50"}`}>
                    <p className="text-xs text-gray-500">
                      {balance > 0 ? "Ce client vous doit" : balance < 0 ? "Ce client a une avance de" : "Situation"}
                    </p>
                    <p className={`font-semibold ${balance > 0 ? "text-red-600" : balance < 0 ? "text-blue-600" : "text-green-600"}`}>
                      {balance !== 0 ? formatPrice(Math.abs(balance)) : "Rien à signaler"}
                    </p>
                    {creditLimit > 0 && balance > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Peut encore prendre {formatPrice(Math.max(0, availableCredit))} à crédit
                      </p>
                    )}
                    {creditLimit > 0 && balance >= creditLimit && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Limite de crédit atteinte
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t text-xs text-gray-400 flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Créé le {formatDateTime(customer.created_at)}
                </span>
                {customer.created_by_name && (
                  <span>par {customer.created_by_name}</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5 text-orange-500" />
                  Historique des mouvements
                </CardTitle>
                <Select value={txnFilter} onValueChange={setTxnFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filtrer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les mouvements</SelectItem>
                    <SelectItem value="credit_sale">Achats à crédit</SelectItem>
                    <SelectItem value="payment">Paiements reçus</SelectItem>
                    <SelectItem value="advance">Avances données</SelectItem>
                    <SelectItem value="adjustment">Corrections</SelectItem>
                    <SelectItem value="refund">Remboursements</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingTxns ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Aucun mouvement</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Les paiements, avances et achats à crédit apparaîtront ici
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {transactions.map(txn => (
                    <div
                      key={txn.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="p-2 bg-gray-100 rounded-full">
                        {getTxnIcon(txn.transaction_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{txn.transaction_type_display}</p>
                          {txn.sale_reference && (
                            <Link
                              href={`/dashboard/sales/${txn.sale}`}
                              className="text-xs text-orange-600 hover:underline"
                            >
                              {txn.sale_reference}
                            </Link>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{formatDateTime(txn.created_at)}</span>
                          {txn.payment_method && (
                            <span>· {txn.payment_method === "cash" ? "Espèces" : txn.payment_method === "mobile_money" ? "Mobile Money" : txn.payment_method === "bank_transfer" ? "Virement" : txn.payment_method === "check" ? "Chèque" : txn.payment_method}</span>
                          )}
                          {txn.reference && <span>· Réf: {txn.reference}</span>}
                        </div>
                        {txn.notes && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{txn.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${getTxnColor(txn.transaction_type)}`}>
                          {getTxnSign(txn.transaction_type)}{formatPrice(txn.amount)}
                        </p>
                        <p className="text-xs text-gray-400">
                          Dette après : {formatPrice(txn.balance_after)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Pending Invoices + Recent Sales */}
        <div className="space-y-6">
          {/* Pending Invoices */}
          {pendingSales.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-orange-500" />
                  Factures en attente ({pendingSales.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {pendingSales.map(sale => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200"
                    >
                      <div>
                        <p className="text-sm font-medium">{sale.reference}</p>
                        <p className="text-xs text-gray-500">
                          Total: {formatPrice(sale.total)} · Reste: <span className="text-orange-600 font-semibold">{formatPrice(sale.amount_due)}</span>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => openInvoicePaymentDialog(sale)}
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        <CreditCard className="h-3.5 w-3.5 mr-1" />
                        Payer
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Sales */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-orange-500" />
                Dernières ventes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {!customer.recent_sales || customer.recent_sales.length === 0 ? (
                <div className="text-center py-6">
                  <ShoppingCart className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Aucune vente</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {customer.recent_sales.map(sale => (
                    <Link
                      key={sale.id}
                      href={`/dashboard/sales/${sale.id}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{sale.reference}</p>
                        <p className="text-xs text-gray-500">{formatDateTime(sale.date)}</p>
                      </div>
                      <span className="font-semibold text-sm text-orange-600">
                        {formatPrice(sale.total)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Credit Limit Dialog */}
      <Dialog open={showCreditLimitDialog} onOpenChange={setShowCreditLimitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-orange-500" />
              Configurer la limite de crédit
            </DialogTitle>
            <DialogDescription>
              Définissez le montant maximum que ce client peut prendre à crédit.
              Si la limite est à 0, le client peut prendre à crédit sans limite.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="credit-limit">Montant maximum autorisé à crédit</Label>
              <Input
                id="credit-limit"
                type="number"
                step="any"
                min="0"
                value={creditLimitValue}
                onChange={e => setCreditLimitValue(e.target.value)}
                placeholder="0 = pas de limite"
                autoFocus
              />
              <p className="text-xs text-gray-400">
                Mettez 0 pour ne pas limiter le crédit de ce client.
              </p>
            </div>
            {balance > 0 && (
              <div className="p-3 bg-yellow-50 rounded-lg text-sm">
                <p className="text-yellow-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Ce client a actuellement une dette de <span className="font-semibold">{formatPrice(balance)}</span>.
                </p>
                {parseFloat(creditLimitValue) > 0 && parseFloat(creditLimitValue) < balance && (
                  <p className="text-yellow-700 text-xs mt-1">
                    Attention : la nouvelle limite est inférieure à la dette actuelle.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreditLimitDialog(false)}>Annuler</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={handleUpdateCreditLimit}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer la limite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer le client</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer le client &quot;{customer.name}&quot; ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Payment Dialog - POS Style */}
      <Dialog open={showInvoicePaymentDialog} onOpenChange={setShowInvoicePaymentDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-orange-500" />
              Payer une facture
            </DialogTitle>
            <DialogDescription>
              Facture: <span className="font-semibold text-gray-900">{selectedSale?.reference}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Sale Summary */}
            <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Total facture</p>
                  <p className="text-lg font-bold text-gray-900">{formatPrice(selectedSale?.total || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Déjà payé</p>
                  <p className="text-lg font-bold text-green-600">{formatPrice(selectedSale?.amount_paid || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Reste à payer</p>
                  <p className="text-xl font-bold text-orange-600">{formatPrice(selectedSale?.amount_due || 0)}</p>
                </div>
              </div>
            </div>

            {/* Payment Methods - Visual Buttons */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mode de paiement</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {paymentMethods.map(method => {
                  const getIcon = (type: string) => {
                    switch (type) {
                      case "cash": return <Banknote className="h-5 w-5" />;
                      case "mobile_money": return <Smartphone className="h-5 w-5" />;
                      case "card": return <CreditCard className="h-5 w-5" />;
                      case "bank_transfer": return <Building2 className="h-5 w-5" />;
                      default: return <DollarSign className="h-5 w-5" />;
                    }
                  };
                  return (
                    <button
                      key={method.id}
                      type="button"
                      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 transition-all ${selectedPaymentMethod === method.id
                        ? "border-orange-500 bg-orange-50 text-orange-700 shadow-sm"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      onClick={() => setSelectedPaymentMethod(method.id)}
                    >
                      {getIcon(method.method_type)}
                      <span className="text-xs font-medium leading-tight text-center">{method.name}</span>
                      {selectedPaymentMethod === method.id && (
                        <div className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-orange-500 flex items-center justify-center">
                          <CheckCircle className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant reçu</Label>
              <div className="relative">
                <CircleDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="number"
                  value={invoicePaymentAmount}
                  onChange={(e) => setInvoicePaymentAmount(e.target.value)}
                  className="h-14 text-2xl text-center font-bold pl-10 pr-16"
                  placeholder={selectedSale?.amount_due || "0"}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">{defaultCurrency.symbol}</span>
              </div>

              {/* Remaining after payment */}
              {parseFloat(invoicePaymentAmount) > 0 && parseFloat(invoicePaymentAmount) < parseFloat(selectedSale?.amount_due || "0") && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex justify-between items-center">
                    <span className="text-amber-700 font-medium text-sm">Restera à payer</span>
                    <span className="text-lg font-bold text-amber-700">
                      {formatPrice(parseFloat(selectedSale?.amount_due || "0") - parseFloat(invoicePaymentAmount))}
                    </span>
                  </div>
                </div>
              )}

              {/* Full payment indicator */}
              {parseFloat(invoicePaymentAmount) >= parseFloat(selectedSale?.amount_due || "0") && (
                <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                  <div className="flex justify-between items-center">
                    <span className="text-green-700 font-medium text-sm">Facture soldée</span>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              )}
            </div>

          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowInvoicePaymentDialog(false)}
              className="sm:flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={handleInvoicePayment}
              disabled={isSubmitting || !selectedPaymentMethod || parseFloat(invoicePaymentAmount) <= 0}
              className="sm:flex-[2] bg-green-600 hover:bg-green-700 gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Printer className="h-5 w-5" />
              )}
              {isSubmitting ? "Traitement..." : "Confirmer et imprimer le reçu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
