"use client";

import { useState, useEffect, useMemo } from "react";
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
import { formatPoints, formatPrice, formatDate, formatDateTime } from "@/lib/format";
import { StatValue } from "@/components/shared/StatValue";
import { MultiCurrencyTotal } from "@/components/shared/MultiCurrencyTotal";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import { getOrganizationCurrencies, OrganizationCurrency } from "@/actions/settings.actions";
import { useCurrency } from "@/components/providers/currency-provider";
import { createMoneyHelpers } from "@/lib/currency";
import { isOverdue } from "@/lib/due-date";
import { buildPaymentReceipt, type PaymentReceiptData } from "@/lib/receipt";
import { useReceiptChrome } from "@/hooks/use-receipt-chrome";
import { useReceiptPrinter } from "@/hooks/use-receipt-printer";
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
import {
  getCustomerLoyalty,
  getLoyaltyProgram,
  CustomerLoyalty,
  LoyaltyProgram,
} from "@/actions/settings.actions";
import { Star } from "lucide-react";

/**
 * Arrondi d'une saisie de points au centième.
 *
 * Les points sont fractionnaires : tronquer à l'entier interdisait au client
 * d'utiliser le solde qu'il vient de gagner (0,58 point devenait 0).
 */
function roundPoints(value: number): number {
  return Math.floor(value * 100) / 100;
}

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
  // Fidélité : chargée à l'ouverture du dialogue, pour proposer un règlement
  // en points sur la facture sélectionnée.
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null);
  const [saleCustomerLoyalty, setSaleCustomerLoyalty] = useState<CustomerLoyalty | null>(null);
  const [pointsUsed, setPointsUsed] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Multi-currency
  const { currency: defaultCurrency } = useCurrency();
  // Identité imprimée et largeur de papier : cette page n'en lisait aucune, ses
  // reçus sortaient sans adresse et toujours en 58 mm.
  const { chrome, paperWidth } = useReceiptChrome(session?.accessToken, organization);
  const printer = useReceiptPrinter();
  const [orgCurrencies, setOrgCurrencies] = useState<OrganizationCurrency[]>([]);
  const [paymentCurrency, setPaymentCurrency] = useState<string>("");

  const getPrimaryCurrency = () => orgCurrencies.find(c => c.is_primary);
  const getPaymentCurrencyObj = () => orgCurrencies.find(c => c.currency_code === paymentCurrency);
  const isPrimaryPayment = () => {
    const pc = getPaymentCurrencyObj();
    return !pc || pc.is_primary;
  };

  const money = useMemo(
    () => createMoneyHelpers(orgCurrencies, defaultCurrency),
    [orgCurrencies, defaultCurrency]
  );

  /**
   * Montant saisi, exprimé dans la devise de la FACTURE.
   *
   * C'est la seule comparaison valide : `amount_due` est libellé en
   * `sale.currency`. La page convertissait auparavant vers la devise
   * principale, si bien qu'un règlement de 50 USD sur une facture de 50 USD
   * était comparé à 140 000 (CDF) et refusé comme « dépassant le restant dû ».
   * La fiche client faisait, elle, la conversion correcte : les deux écrans
   * partagent désormais `createMoneyHelpers`.
   */
  const getAmountInSaleCurrency = () => {
    const amount = parseFloat(paymentAmount) || 0;
    if (!selectedSale || !paymentCurrency || paymentCurrency === selectedSale.currency) {
      return amount;
    }
    return money.convMoney(amount, paymentCurrency, selectedSale.currency);
  };

  // Fidélité : le barème est libellé en devise principale, on ne propose donc
  // le règlement en points que sur une facture dans cette même devise.
  const availablePoints = saleCustomerLoyalty?.current_points ?? 0;
  const pointValue = parseFloat(loyaltyProgram?.point_value ?? "0");
  const canUsePoints =
    !!loyaltyProgram?.is_active &&
    availablePoints > 0 &&
    pointValue > 0 &&
    !!selectedSale?.customer &&
    selectedSale?.currency === (getPrimaryCurrency()?.currency_code || defaultCurrency.code);
  const maxUsablePoints = canUsePoints
    ? Math.min(
        availablePoints,
        roundPoints(parseFloat(selectedSale?.amount_due || "0") / pointValue)
      )
    : 0;

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          // Récupérer les ventes partiellement payées ET en attente.
          // Chaque fetch est indépendant : si l'un échoue, on prévient
          // explicitement l'utilisateur et on affiche l'autre - pas de
          // données incomplètes en silence.
          const [partiallyPaidResult, pendingResult, methodsResult, currenciesResult] = await Promise.all([
            // `page_size` explicite : sans lui seules 20 factures par statut
            // remontaient, et les totaux « Total à recevoir » / « Déjà payé »
            // étaient faux au-delà, sans rien qui le signale.
            getSales(session.accessToken, org.id, { status: "partially_paid", page_size: 200 }),
            getSales(session.accessToken, org.id, { status: "pending", page_size: 200 }),
            getPaymentMethods(session.accessToken, org.id, { is_active: true }),
            getOrganizationCurrencies(session.accessToken, org.id),
          ]);

          if (!partiallyPaidResult.success) {
            toast.warning(
              "Ventes partiellement payées non chargées - la liste est incomplète."
            );
          }
          if (!pendingResult.success) {
            toast.warning(
              "Ventes en attente non chargées - la liste est incomplète."
            );
          }

          const merged = [
            ...(Array.isArray(partiallyPaidResult.data) ? partiallyPaidResult.data : (partiallyPaidResult.data as any)?.results || []),
            ...(Array.isArray(pendingResult.data) ? pendingResult.data : (pendingResult.data as any)?.results || []),
          ];
          setPendingSales(merged);
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
    setPointsUsed("");
    setSaleCustomerLoyalty(null);
    setShowPaymentDialog(true);

    // Points du client : uniquement si la facture est nominative.
    if (sale.customer && session?.accessToken && organization) {
      Promise.all([
        getCustomerLoyalty(session.accessToken, organization.id, sale.customer),
        getLoyaltyProgram(session.accessToken, organization.id),
      ]).then(([loyaltyRes, programRes]) => {
        if (loyaltyRes.success && loyaltyRes.data) setSaleCustomerLoyalty(loyaltyRes.data);
        if (programRes.success && programRes.data) setLoyaltyProgram(programRes.data);
      });
    }
  };

  const handleAddPayment = async () => {
    if (!selectedSale || !session?.accessToken || !organization) return;

    const points = parseFloat(pointsUsed) || 0;
    const rawAmount = parseFloat(paymentAmount) || 0;

    if (rawAmount <= 0 && points <= 0) {
      toast.error("Indiquez un montant ou un nombre de points à utiliser");
      return;
    }
    if (rawAmount > 0 && !selectedPaymentMethod) {
      toast.error("Sélectionnez un mode de paiement");
      return;
    }

    const amountInSale = rawAmount > 0 ? getAmountInSaleCurrency() : 0;
    const amountDue = parseFloat(selectedSale.amount_due);
    const coveredByPoints = points * pointValue;
    if (amountInSale + coveredByPoints > amountDue * 1.001) { // tolérance d'arrondi
      toast.error(
        `Le règlement (${money.money(amountInSale + coveredByPoints, selectedSale.currency)}) ` +
        `dépasse le restant dû (${money.money(amountDue, selectedSale.currency)})`
      );
      return;
    }

    const job = printer.begin();
    setIsProcessing(true);

    try {
      // On envoie la devise du règlement si elle diffère de celle de la vente ;
      // la conversion vers la devise de la vente est faite (autoritairement) par
      // le backend via CurrencyService - évite toute hypothèse « vente = devise
      // principale » côté client.
      const paymentData: AddPaymentData = {
        reference: paymentReference || undefined,
        ...(rawAmount > 0
          ? {
              payment_method: selectedPaymentMethod,
              amount: rawAmount,
              ...(paymentCurrency && paymentCurrency !== selectedSale.currency
                ? { currency: paymentCurrency }
                : {}),
            }
          : {}),
        ...(points > 0 ? { points_used: points } : {}),
      };

      const result = await addPaymentToSale(
        session.accessToken,
        organization.id,
        selectedSale.id,
        paymentData
      );

      if (result.success) {
        const selectedMethod = paymentMethods.find(m => m.id === selectedPaymentMethod);
        const previouslyPaid = parseFloat(selectedSale.amount_paid);
        const remainingBalance = amountDue - amountInSale - coveredByPoints;

        const payLabel = !isPrimaryPayment()
          ? `${selectedMethod?.name || "Espèces"} (${formatPrice(rawAmount, getPaymentCurrencyObj()?.currency_symbol)})`
          : (selectedMethod?.name || "Espèces");

        // Numéro alloué par le serveur, porté par le règlement qui vient
        // d'être créé : stable d'une réimpression à l'autre, contrairement au
        // `PAY-${Date.now()}` que cette page fabriquait.
        const settledPayment = result.data?.payments?.[result.data.payments.length - 1];

        const receiptData: PaymentReceiptData = {
          kind: "debt_payment",
          chrome: chrome ?? { org: { name: organization.name || "Vente Facile" } },
          number: settledPayment?.receipt_number || selectedSale.reference,
          date: new Date().toLocaleString("fr-CD"),
          customerName: selectedSale.customer_name || "Client anonyme",
          customerPhone: selectedSale.customer_phone || undefined,
          paymentMethod: payLabel,
          paymentReference: paymentReference || undefined,
          // Tout le reçu est libellé dans la devise de la facture : `total`,
          // `previouslyPaid` et `remainingBalance` en viennent déjà. Y mêler un
          // montant converti en devise principale sous le même libellé donnait
          // un reçu incohérent.
          amountPaid: amountInSale + coveredByPoints,
          currency: selectedSale.currency,
          invoice: {
            reference: selectedSale.reference,
            total: parseFloat(selectedSale.total),
            previouslyPaid,
            remaining: remainingBalance,
            currency: selectedSale.currency,
          },
          debt: {
            before: amountDue,
            after: remainingBalance,
            currency: selectedSale.currency,
          },
          // Un règlement peut être fait en points : le client doit lire ce qui
          // a été consommé et ce qui lui reste. Valeurs autoritatives de la
          // vente rafraîchie, jamais un recalcul de barème.
          loyalty: {
            show: !!result.data?.loyalty_program_active,
            used: result.data?.loyalty_points_used ?? 0,
            balance: result.data?.loyalty_points_balance ?? 0,
          },
        };

        job.present(buildPaymentReceipt(receiptData), {
          filename: `reglement-${selectedSale.reference}.pdf`,
          paperWidth,
          successMessage: "Paiement enregistré",
        });

        setShowPaymentDialog(false);

        // Refresh the list
        const [partiallyPaidResult, pendingResult] = await Promise.all([
          getSales(session.accessToken, organization.id, { status: "partially_paid", page_size: 200 }),
          getSales(session.accessToken, organization.id, { status: "pending", page_size: 200 }),
        ]);

        const allSales = [
          ...(Array.isArray(partiallyPaidResult.data) ? partiallyPaidResult.data : (partiallyPaidResult.data as any)?.results || []),
          ...(Array.isArray(pendingResult.data) ? pendingResult.data : (pendingResult.data as any)?.results || [])
        ];
        setPendingSales(allSales);
      } else {
        job.abort();
        toast.error(result.message || "Erreur lors de l'ajout du paiement");
      }
    } catch (error) {
      job.abort();
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
                <MultiCurrencyTotal
                  rows={filteredSales.map(s => ({ amount: s.amount_due, currency: s.currency }))}
                  money={money}
                />
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
                <MultiCurrencyTotal
                  rows={filteredSales.map(s => ({ amount: s.amount_paid, currency: s.currency }))}
                  money={money}
                />
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
                        {/* Chaque montant dans SA devise : `formatPrice` seul
                            appliquait le symbole de la devise principale et
                            affichait une facture de 50 $ en « 50 FC ». */}
                        <span className="text-gray-500">Total: </span>
                        <span className="font-semibold">{money.money(sale.total, sale.currency)}</span>
                      </div>
                      {parseFloat(sale.amount_paid) > 0 && (
                        <div>
                          <span className="text-gray-500">Payé: </span>
                          <span className="font-semibold text-green-600">
                            {money.money(sale.amount_paid, sale.currency)}
                          </span>
                        </div>
                      )}
                      {sale.due_date && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-gray-400" />
                          {isOverdue(sale.due_date) ? (
                            <Badge variant="destructive" className="font-normal">
                              En retard depuis le {formatDate(sale.due_date)}
                            </Badge>
                          ) : (
                            <span className="text-gray-600">
                              Échéance : {formatDate(sale.due_date)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Reste à payer</p>
                      <p className="text-xl font-bold text-orange-600">
                        {money.money(sale.amount_due, sale.currency)}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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

              {/* Équivalent dans la devise de la FACTURE : c'est elle qui porte
                  le reste à payer, la devise principale n'a rien à voir ici. */}
              {selectedSale && paymentCurrency !== selectedSale.currency && (parseFloat(paymentAmount) || 0) > 0 && (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-blue-700 font-medium">
                      Équivalent en {selectedSale.currency}
                    </span>
                    <span className="text-lg font-bold text-blue-800">
                      {money.money(getAmountInSaleCurrency(), selectedSale.currency)}
                    </span>
                  </div>
                  <p className="text-xs text-blue-500 mt-1">
                    {money.rateLabel(paymentCurrency, selectedSale.currency)}
                  </p>
                </div>
              )}

              {/* Remaining after payment */}
              {selectedSale && getAmountInSaleCurrency() > 0 && getAmountInSaleCurrency() < parseFloat(selectedSale.amount_due) && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex justify-between items-center">
                    <span className="text-amber-700 font-medium text-sm">Restera à payer</span>
                    <span className="text-lg font-bold text-amber-700">
                      {money.money(
                        parseFloat(selectedSale.amount_due) - getAmountInSaleCurrency(),
                        selectedSale.currency
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Full payment indicator */}
              {selectedSale && getAmountInSaleCurrency() >= parseFloat(selectedSale.amount_due) && (parseFloat(paymentAmount) || 0) > 0 && (
                <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                  <div className="flex justify-between items-center">
                    <span className="text-green-700 font-medium text-sm">Facture soldée</span>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              )}
            </div>

            {/* Règlement en points. Le total de la facture émise ne change pas :
                les points s'imputent comme un moyen de paiement. */}
            {canUsePoints && (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700">
                    <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                    Payer avec les points
                  </Label>
                  <span className="text-xs font-medium text-amber-700">
                    {formatPoints(availablePoints)} pts disponibles
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={maxUsablePoints}
                    step="0.01"
                    value={pointsUsed}
                    onChange={(e) => setPointsUsed(e.target.value)}
                    placeholder="0"
                    className="h-11"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 border-amber-300 text-amber-700"
                    onClick={() => setPointsUsed(String(maxUsablePoints))}
                  >
                    Maximum
                  </Button>
                </div>

                {(parseFloat(pointsUsed) || 0) > 0 && (
                  <p className="text-sm text-amber-800">
                    {formatPoints(parseFloat(pointsUsed) || 0)} points = {formatPrice((parseFloat(pointsUsed) || 0) * pointValue)} déduits
                  </p>
                )}
                {loyaltyProgram && loyaltyProgram.min_points_to_redeem > 0 && (
                  <p className="text-xs text-amber-600">
                    Minimum {loyaltyProgram.min_points_to_redeem} points par utilisation
                  </p>
                )}
              </div>
            )}

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
