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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowDownLeft,
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
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getCustomer,
  deleteCustomer,
  updateCustomer,
  getCustomerTransactions,
  recordCustomerPayment,
  recordCustomerAdvance,
  adjustCustomerBalance,
  Customer,
  CustomerTransaction,
} from "@/actions/contacts.actions";

export default function CustomerDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Transactions
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [isLoadingTxns, setIsLoadingTxns] = useState(false);
  const [txnFilter, setTxnFilter] = useState<string>("all");

  // Payment / Advance / Adjustment / Credit limit dialogs
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showCreditLimitDialog, setShowCreditLimitDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txnForm, setTxnForm] = useState({
    amount: "",
    payment_method: "cash",
    reference: "",
    notes: "",
  });
  const [creditLimitValue, setCreditLimitValue] = useState("");

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
  }, [session, customerId]);

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
  }, [session, organization, customerId]);

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
  }, [session, organization, customerId, txnFilter]);

  useEffect(() => {
    if (organization && customer) {
      loadTransactions();
    }
  }, [organization, customer, txnFilter]);

  const resetTxnForm = () => {
    setTxnForm({ amount: "", payment_method: "cash", reference: "", notes: "" });
  };

  const handleRecordPayment = async () => {
    if (!session?.accessToken || !organization || !customer) return;
    const amount = parseFloat(txnForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Le montant doit être supérieur à 0");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await recordCustomerPayment(
        session.accessToken, organization.id, customer.id,
        { amount, payment_method: txnForm.payment_method, reference: txnForm.reference, notes: txnForm.notes }
      );
      if (result.success && result.data) {
        toast.success(`Paiement de ${formatPrice(amount)} enregistré`);
        setShowPaymentDialog(false);
        resetTxnForm();
        await refreshData();
        loadTransactions();
      } else {
        toast.error(result.message || "Erreur");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordAdvance = async () => {
    if (!session?.accessToken || !organization || !customer) return;
    const amount = parseFloat(txnForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Le montant doit être supérieur à 0");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await recordCustomerAdvance(
        session.accessToken, organization.id, customer.id,
        { amount, payment_method: txnForm.payment_method, reference: txnForm.reference, notes: txnForm.notes }
      );
      if (result.success && result.data) {
        toast.success(`Avance de ${formatPrice(amount)} enregistrée`);
        setShowAdvanceDialog(false);
        resetTxnForm();
        await refreshData();
        loadTransactions();
      } else {
        toast.error(result.message || "Erreur");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustBalance = async () => {
    if (!session?.accessToken || !organization || !customer) return;
    const amount = parseFloat(txnForm.amount);
    if (!amount) {
      toast.error("Le montant est obligatoire");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await adjustCustomerBalance(
        session.accessToken, organization.id, customer.id,
        { amount, notes: txnForm.notes }
      );
      if (result.success && result.data) {
        toast.success("Correction appliquée avec succès");
        setShowAdjustDialog(false);
        resetTxnForm();
        await refreshData();
        loadTransactions();
      } else {
        toast.error(result.message || "Erreur");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
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
      case "payment": return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
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
    <div className="max-w-4xl mx-auto space-y-6">
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

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          className="bg-green-600 hover:bg-green-700"
          onClick={() => { resetTxnForm(); setShowPaymentDialog(true); }}
        >
          <ArrowDownLeft className="h-4 w-4 mr-2" />
          Le client a payé
        </Button>
        <Button
          variant="outline"
          className="border-blue-200 text-blue-700 hover:bg-blue-50"
          onClick={() => { resetTxnForm(); setShowAdvanceDialog(true); }}
        >
          <Banknote className="h-4 w-4 mr-2" />
          Le client donne une avance
        </Button>
        <Button
          variant="outline"
          onClick={() => { resetTxnForm(); setShowAdjustDialog(true); }}
        >
          <DollarSign className="h-4 w-4 mr-2" />
          Corriger le montant
        </Button>
        <Button
          variant="outline"
          onClick={() => { setCreditLimitValue(customer.credit_limit || "0"); setShowCreditLimitDialog(true); }}
        >
          <Settings className="h-4 w-4 mr-2" />
          Configurer la limite de crédit
        </Button>
      </div>

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

        {/* Right: Recent Sales */}
        <div className="space-y-6">
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

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownLeft className="h-5 w-5 text-green-500" />
              Le client a payé
            </DialogTitle>
            <DialogDescription>
              {balance > 0
                ? <>Le client doit actuellement <span className="text-red-600 font-semibold">{formatPrice(balance)}</span>. Combien a-t-il payé ?</>
                : "Enregistrez le montant que le client a payé."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Montant *</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={txnForm.amount}
                onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Mode de paiement</Label>
              <Select value={txnForm.payment_method} onValueChange={v => setTxnForm({ ...txnForm, payment_method: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="bank_transfer">Virement bancaire</SelectItem>
                  <SelectItem value="check">Chèque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-ref">Référence</Label>
              <Input
                id="payment-ref"
                value={txnForm.reference}
                onChange={e => setTxnForm({ ...txnForm, reference: e.target.value })}
                placeholder="N° reçu, transaction, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes</Label>
              <Textarea
                id="payment-notes"
                value={txnForm.notes}
                onChange={e => setTxnForm({ ...txnForm, notes: e.target.value })}
                placeholder="Notes optionnelles..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Annuler</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleRecordPayment}
              disabled={isSubmitting || !txnForm.amount || parseFloat(txnForm.amount) <= 0}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advance Dialog */}
      <Dialog open={showAdvanceDialog} onOpenChange={setShowAdvanceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-blue-500" />
              Le client donne une avance
            </DialogTitle>
            <DialogDescription>
              Le client paie d&apos;avance un montant qui sera déduit de ses prochains achats.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="advance-amount">Montant *</Label>
              <Input
                id="advance-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={txnForm.amount}
                onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Mode de paiement</Label>
              <Select value={txnForm.payment_method} onValueChange={v => setTxnForm({ ...txnForm, payment_method: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="bank_transfer">Virement bancaire</SelectItem>
                  <SelectItem value="check">Chèque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="advance-ref">Référence</Label>
              <Input
                id="advance-ref"
                value={txnForm.reference}
                onChange={e => setTxnForm({ ...txnForm, reference: e.target.value })}
                placeholder="N° reçu, transaction, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="advance-notes">Notes</Label>
              <Textarea
                id="advance-notes"
                value={txnForm.notes}
                onChange={e => setTxnForm({ ...txnForm, notes: e.target.value })}
                placeholder="Notes optionnelles..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdvanceDialog(false)}>Annuler</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleRecordAdvance}
              disabled={isSubmitting || !txnForm.amount || parseFloat(txnForm.amount) <= 0}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmer l&apos;avance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Balance Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-500" />
              Corriger le montant de la dette
            </DialogTitle>
            <DialogDescription>
              Utilisez cette option pour corriger une erreur sur la dette du client.
              {balance > 0 && <> Dette actuelle : <span className="font-semibold text-red-600">{formatPrice(balance)}</span>.</>}
              {balance < 0 && <> Avance actuelle : <span className="font-semibold text-blue-600">{formatPrice(Math.abs(balance))}</span>.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adjust-amount">Montant de la correction *</Label>
              <Input
                id="adjust-amount"
                type="number"
                step="0.01"
                value={txnForm.amount}
                onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })}
                placeholder="Ex: 5000 (augmente la dette) ou -5000 (réduit la dette)"
                autoFocus
              />
              <p className="text-xs text-gray-400">
                Montant positif = le client doit plus. Montant négatif = le client doit moins.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-notes">Raison de la correction *</Label>
              <Textarea
                id="adjust-notes"
                value={txnForm.notes}
                onChange={e => setTxnForm({ ...txnForm, notes: e.target.value })}
                placeholder="Expliquez pourquoi vous corrigez ce montant..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>Annuler</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={handleAdjustBalance}
              disabled={isSubmitting || !txnForm.amount}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Appliquer la correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                step="0.01"
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
    </div>
  );
}
