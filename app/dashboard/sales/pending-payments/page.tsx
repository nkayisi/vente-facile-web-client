"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  DollarSign,
  Loader2,
  Search,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Calendar,
  User,
  ArrowLeft,
  Clock,
  Banknote,
  Smartphone,
  Building,
  Printer,
  CircleDollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice, formatNumber, formatDate, formatDateTime } from "@/lib/format";
import { StatValue } from "@/components/shared/StatValue";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import { getOrganizationCurrencies, OrganizationCurrency } from "@/actions/settings.actions";
import { useCurrency } from "@/components/providers/currency-provider";
import {
  assignPdfToPrintWindow,
  closePrintTabIfBlank,
  generatePaymentReceiptPdfUrl,
  openPrintTab,
  PaymentReceiptData,
} from "@/lib/receipt-printer";
import {
  getSales,
  addPaymentToSale,
  getPaymentMethods,
  Sale,
  PaymentMethod,
  AddPaymentData,
} from "@/actions/sales.actions";
import Link from "next/link";
import { DataPagination } from "@/components/shared/DataPagination";

export default function PendingPaymentsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [pendingSales, setPendingSales] = useState<Sale[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Payment dialog
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Multi-currency
  const { currency: defaultCurrency } = useCurrency();
  const [orgCurrencies, setOrgCurrencies] = useState<OrganizationCurrency[]>([]);
  const [paymentCurrency, setPaymentCurrency] = useState<string>("");

  const getPrimaryCurrency = () => orgCurrencies.find(c => c.is_primary);
  const getPaymentCurrencyObj = () => orgCurrencies.find(c => c.currency_code === paymentCurrency);
  const isPrimaryPayment = () => {
    const pc = getPaymentCurrencyObj();
    return !pc || pc.is_primary;
  };
  const getAmountInPrimary = () => {
    const amount = parseFloat(paymentAmount) || 0;
    if (isPrimaryPayment()) return amount;
    const pc = getPaymentCurrencyObj();
    if (!pc) return amount;
    const rate = parseFloat(pc.exchange_rate);
    if (rate <= 0) return amount;
    return Math.round(amount * rate * 100) / 100;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          // Récupérer les ventes partiellement payées ET en attente
          const [partiallyPaidResult, pendingResult, methodsResult, currenciesResult] = await Promise.all([
            getSales(session.accessToken, org.id, { status: "partially_paid" }),
            getSales(session.accessToken, org.id, { status: "pending" }),
            getPaymentMethods(session.accessToken, org.id, { is_active: true }),
            getOrganizationCurrencies(session.accessToken, org.id),
          ]);

          const salesResult = {
            success: partiallyPaidResult.success && pendingResult.success,
            data: [
              ...(Array.isArray(partiallyPaidResult.data) ? partiallyPaidResult.data : (partiallyPaidResult.data as any)?.results || []),
              ...(Array.isArray(pendingResult.data) ? pendingResult.data : (pendingResult.data as any)?.results || [])
            ]
          };

          if (salesResult.success && salesResult.data) {
            setPendingSales(Array.isArray(salesResult.data) ? salesResult.data : (salesResult.data as any).results || []);
          }
          if (methodsResult.success && methodsResult.data) {
            setPaymentMethods(Array.isArray(methodsResult.data) ? methodsResult.data : (methodsResult.data as any).results || []);
          }
          if (currenciesResult.success && currenciesResult.data) {
            setOrgCurrencies(currenciesResult.data);
            const primary = currenciesResult.data.find((c: OrganizationCurrency) => c.is_primary);
            if (primary) setPaymentCurrency(primary.currency_code);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.accessToken]);


  const openPaymentDialog = (sale: Sale) => {
    setSelectedSale(sale);
    setPaymentAmount(sale.amount_due);
    // Définir Espèces comme méthode par défaut
    const cashMethod = paymentMethods.find(m => m.method_type === "cash");
    setSelectedPaymentMethod(cashMethod?.id || "");
    setPaymentReference("");
    // Reset to primary currency
    const primary = getPrimaryCurrency();
    setPaymentCurrency(primary?.currency_code || "CDF");
    setShowPaymentDialog(true);
  };

  const handleAddPayment = async () => {
    if (!selectedSale || !session?.accessToken || !organization) return;

    if (!selectedPaymentMethod) {
      toast.error("Sélectionnez un mode de paiement");
      return;
    }

    const rawAmount = parseFloat(paymentAmount);
    if (rawAmount <= 0) {
      toast.error("Montant invalide");
      return;
    }

    const amountInPrimary = getAmountInPrimary();
    const amountDue = parseFloat(selectedSale.amount_due);
    if (amountInPrimary > amountDue * 1.001) { // small tolerance for rounding
      toast.error(`Le montant converti (${formatPrice(amountInPrimary)}) dépasse le restant dû (${formatPrice(amountDue)})`);
      return;
    }

    const printTab = openPrintTab();
    setIsProcessing(true);

    try {
      const pc = getPaymentCurrencyObj();
      const paymentData: AddPaymentData = {
        payment_method: selectedPaymentMethod,
        amount: rawAmount,
        reference: paymentReference || undefined,
        ...(pc && !pc.is_primary ? { currency: paymentCurrency, exchange_rate: parseFloat(pc.exchange_rate) } : {}),
      } as any;

      const result = await addPaymentToSale(
        session.accessToken,
        organization.id,
        selectedSale.id,
        paymentData
      );

      if (result.success) {
        const selectedMethod = paymentMethods.find(m => m.id === selectedPaymentMethod);
        const previouslyPaid = parseFloat(selectedSale.amount_paid);
        const remainingBalance = amountDue - amountInPrimary;

        const primaryCode = getPrimaryCurrency()?.currency_code || "CDF";
        const payLabel = !isPrimaryPayment()
          ? `${selectedMethod?.name || "Espèces"} (${formatPrice(rawAmount, getPaymentCurrencyObj()?.currency_symbol)})`
          : (selectedMethod?.name || "Espèces");

        const receiptData: PaymentReceiptData = {
          orgName: organization.name || "Vente Facile",
          receiptNumber: `PAY-${Date.now().toString(36).toUpperCase()}`,
          date: new Date().toLocaleString("fr-CD"),
          customerName: selectedSale.customer_name || "Client anonyme",
          customerPhone: selectedSale.customer_phone || undefined,
          paymentMethod: payLabel,
          paymentReference: paymentReference || undefined,
          amountPaid: amountInPrimary,
          currency: primaryCode,
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

        setShowPaymentDialog(false);

        // Refresh the list
        const [partiallyPaidResult, pendingResult] = await Promise.all([
          getSales(session.accessToken, organization.id, { status: "partially_paid" }),
          getSales(session.accessToken, organization.id, { status: "pending" }),
        ]);

        const allSales = [
          ...(Array.isArray(partiallyPaidResult.data) ? partiallyPaidResult.data : (partiallyPaidResult.data as any)?.results || []),
          ...(Array.isArray(pendingResult.data) ? pendingResult.data : (pendingResult.data as any)?.results || [])
        ];
        setPendingSales(allSales);
      } else {
        closePrintTabIfBlank(printTab);
        toast.error(result.message || "Erreur lors de l'ajout du paiement");
      }
    } catch (error) {
      closePrintTabIfBlank(printTab);
      console.error("Error adding payment:", error);
      toast.error("Erreur lors de l'ajout du paiement");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredSales = pendingSales.filter(
    (sale) =>
      sale.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.customer_name && sale.customer_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Pagination
  const totalPages = Math.ceil(filteredSales.length / pageSize);
  const paginatedSales = filteredSales.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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
        <div className="flex items-center gap-2">
          <Link href="/dashboard/sales">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Paiements en attente</h1>
            <p className="text-sm text-gray-500 mt-1">
              Ventes en attente de paiement et ventes partiellement payées
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={String(filteredSales.length)} />
                <p className="text-xs text-gray-500">Total ventes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={String(filteredSales.filter(s => s.status === 'pending').length)} />
                <p className="text-xs text-gray-500">En attente</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={formatPrice(
                  filteredSales.reduce((sum, sale) => sum + parseFloat(sale.amount_due), 0)
                )} />
                <p className="text-xs text-gray-500">Total à recevoir</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={formatPrice(
                  filteredSales.reduce((sum, sale) => sum + parseFloat(sale.amount_paid), 0)
                )} />
                <p className="text-xs text-gray-500">Déjà payé</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales List */}
      <Card>
        <CardHeader>
          <CardTitle>Ventes en attente de paiement</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSales.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune vente en attente
              </h3>
              <p className="text-sm text-gray-500">
                Toutes les ventes sont entièrement payées
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{sale.reference}</h3>
                      {sale.status === 'partially_paid' ? (
                        <Badge className="bg-orange-100 text-orange-700">
                          Partiellement payé
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-700">
                          En attente
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="h-4 w-4" />
                        <span>{sale.customer_name || "Client anonyme"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(sale.sale_date)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Total: </span>
                        <span className="font-semibold">{formatPrice(sale.total)}</span>
                      </div>
                      {parseFloat(sale.amount_paid) > 0 && (
                        <div>
                          <span className="text-gray-500">Payé: </span>
                          <span className="font-semibold text-green-600">
                            {formatPrice(sale.amount_paid)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Reste à payer</p>
                      <p className="text-xl font-bold text-orange-600">
                        {formatPrice(sale.amount_due)}
                      </p>
                    </div>
                    <Button
                      onClick={() => openPaymentDialog(sale)}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Payer
                    </Button>
                  </div>
                </div>
              ))}
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <DataPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    hasNext={currentPage < totalPages}
                    hasPrevious={currentPage > 1}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog - POS Style */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-orange-500" />
              Enregistrer un paiement
            </DialogTitle>
            <DialogDescription>
              Facture: <span className="font-semibold text-gray-900">{selectedSale?.reference}</span>
              {selectedSale?.customer_name && (
                <> · Client: <span className="font-medium">{selectedSale.customer_name}</span></>
              )}
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
                      case "bank_transfer": return <Building className="h-5 w-5" />;
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
                  step="any"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="h-14 text-2xl text-center font-bold pl-10 pr-16"
                  placeholder={selectedSale?.amount_due || "0"}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
                  {getPaymentCurrencyObj()?.currency_symbol || defaultCurrency.symbol}
                </span>
              </div>

              {/* Conversion display when paying in different currency */}
              {!isPrimaryPayment() && (parseFloat(paymentAmount) || 0) > 0 && (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-blue-700 font-medium">
                      Équivalent en {getPrimaryCurrency()?.currency_code}
                    </span>
                    <span className="text-lg font-bold text-blue-800">
                      {formatPrice(getAmountInPrimary())}
                    </span>
                  </div>
                  <p className="text-xs text-blue-500 mt-1">
                    Taux: 1 {getPaymentCurrencyObj()?.currency_code} = {formatNumber(parseFloat(getPaymentCurrencyObj()?.exchange_rate || "1"))} {getPrimaryCurrency()?.currency_symbol}
                  </p>
                </div>
              )}

              {/* Remaining after payment */}
              {getAmountInPrimary() > 0 && getAmountInPrimary() < parseFloat(selectedSale?.amount_due || "0") && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex justify-between items-center">
                    <span className="text-amber-700 font-medium text-sm">Restera à payer</span>
                    <span className="text-lg font-bold text-amber-700">
                      {formatPrice(parseFloat(selectedSale?.amount_due || "0") - getAmountInPrimary())}
                    </span>
                  </div>
                </div>
              )}

              {/* Full payment indicator */}
              {getAmountInPrimary() >= parseFloat(selectedSale?.amount_due || "0") && (parseFloat(paymentAmount) || 0) > 0 && (
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
              onClick={() => setShowPaymentDialog(false)}
              className="sm:flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={handleAddPayment}
              disabled={isProcessing || !selectedPaymentMethod || parseFloat(paymentAmount) <= 0}
              className="sm:flex-[2] bg-green-600 hover:bg-green-700 gap-2"
            >
              {isProcessing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Printer className="h-5 w-5" />
              )}
              {isProcessing ? "Traitement..." : "Confirmer et imprimer le reçu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
