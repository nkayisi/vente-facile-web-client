"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useOrganization } from "@/components/auth/organization-checker";
import { useSubscription } from "@/components/auth/subscription-guard";
import {
  getPlans,
  getSubscriptionPayments,
  getSubscriptionInvoices,
  activateSubscription,
  Plan,
  SubscriptionPayment,
  SubscriptionInvoice,
  ActivateSubscriptionData,
} from "@/actions/subscription.actions";
import { formatPrice } from "@/lib/format";
import { toast } from "sonner";
import {
  Crown,
  CreditCard,
  Clock,
  Check,
  Shield,
  Users,
  Building2,
  Package,
  HardDrive,
  Receipt,
  Loader2,
  ChevronRight,
  Star,
  Zap,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const STATUS_COLORS: Record<string, string> = {
  trial: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  past_due: "bg-orange-100 text-orange-700",
  expired: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-700",
  suspended: "bg-red-100 text-red-700",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-gray-100 text-gray-700",
};

export default function SubscriptionPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { subscriptionStatus, refreshSubscription } = useSubscription();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog state
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [paymentMethod, setPaymentMethod] = useState<string>("mobile_money");
  const [paymentReference, setPaymentReference] = useState("");
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!session?.accessToken || !organization?.id) return;
      setIsLoading(true);
      try {
        const [plansRes, paymentsRes, invoicesRes] = await Promise.all([
          getPlans(session.accessToken),
          getSubscriptionPayments(session.accessToken, organization.id),
          getSubscriptionInvoices(session.accessToken, organization.id),
        ]);

        if (plansRes.success && plansRes.data) {
          setPlans(plansRes.data.filter((p) => p.code !== "trial"));
        }
        if (paymentsRes.success && paymentsRes.data) setPayments(paymentsRes.data);
        if (invoicesRes.success && invoicesRes.data) setInvoices(invoicesRes.data);
      } catch {
        toast.error("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [session?.accessToken, organization]);

  function handleSelectPlan(plan: Plan) {
    setSelectedPlan(plan);
    setBillingCycle("monthly");
    setPaymentReference("");
    setShowActivateDialog(true);
  }

  async function handleActivate() {
    if (!session?.accessToken || !organization?.id || !selectedPlan) return;

    setIsActivating(true);
    try {
      const price =
        billingCycle === "yearly"
          ? parseFloat(selectedPlan.price_yearly)
          : parseFloat(selectedPlan.price_monthly);

      const data: ActivateSubscriptionData = {
        plan_id: selectedPlan.id,
        billing_cycle: billingCycle,
        payment_method: paymentMethod as ActivateSubscriptionData["payment_method"],
        amount: price,
        reference: paymentReference,
      };

      const result = await activateSubscription(
        session.accessToken,
        organization.id,
        data
      );

      if (result.success) {
        toast.success("Abonnement activé avec succès !");
        setShowActivateDialog(false);
        await refreshSubscription();
        // Reload payments & invoices
        const [paymentsRes, invoicesRes] = await Promise.all([
          getSubscriptionPayments(session.accessToken, organization.id),
          getSubscriptionInvoices(session.accessToken, organization.id),
        ]);
        if (paymentsRes.success && paymentsRes.data) setPayments(paymentsRes.data);
        if (invoicesRes.success && invoicesRes.data) setInvoices(invoicesRes.data);
      } else {
        toast.error(result.error || "Erreur lors de l'activation");
      }
    } catch {
      toast.error("Erreur lors de l'activation");
    } finally {
      setIsActivating(false);
    }
  }

  const subscription = subscriptionStatus?.subscription;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Abonnement</h1>
        <p className="text-gray-500 mt-1">
          Gérez votre abonnement et consultez vos factures
        </p>
      </div>

      {/* Current subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-orange-600" />
            Abonnement actuel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-gray-500">Plan</p>
                <p className="text-lg font-semibold">{subscription.plan_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Statut</p>
                <Badge className={STATUS_COLORS[subscription.status] || "bg-gray-100"}>
                  {subscription.status_display}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Cycle</p>
                <p className="font-medium">{subscription.billing_cycle_display}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Jours restants</p>
                <p className={`text-lg font-bold ${subscription.days_remaining <= 5 ? "text-red-600" : "text-green-600"
                  }`}>
                  {subscription.days_remaining} jour(s)
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Début période</p>
                <p className="font-medium">
                  {new Date(subscription.current_period_start).toLocaleDateString("fr-CD")}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Fin période</p>
                <p className="font-medium">
                  {new Date(subscription.current_period_end).toLocaleDateString("fr-CD")}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Prix</p>
                <p className="font-medium">
                  {parseFloat(subscription.price) > 0
                    ? `${formatPrice(subscription.price)} ${subscription.currency}`
                    : "Gratuit"}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <Shield className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Aucun abonnement actif</p>
              <p className="text-sm text-gray-400 mt-1">
                Choisissez un plan ci-dessous pour commencer
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plans disponibles</TabsTrigger>
          <TabsTrigger value="payments">Paiements</TabsTrigger>
          <TabsTrigger value="invoices">Factures</TabsTrigger>
        </TabsList>

        {/* Plans */}
        <TabsContent value="plans" className="mt-4">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = subscription?.plan === plan.id;
              const monthlyPrice = parseFloat(plan.price_monthly);
              const yearlyPrice = parseFloat(plan.price_yearly);

              return (
                <Card
                  key={plan.id}
                  className={`relative overflow-hidden ${plan.is_featured ? "border-orange-300 shadow-lg" : ""
                    } ${isCurrent ? "border-green-400 bg-green-50/30" : ""}`}
                >
                  {plan.is_featured && (
                    <div className="absolute top-0 right-0 bg-orange-500 text-white text-xs px-3 py-1 rounded-bl-lg font-medium">
                      <Star className="inline h-3 w-3 mr-1" />
                      Populaire
                    </div>
                  )}
                  <CardContent className="pt-6">
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="text-sm text-gray-500 mt-1 min-h-[40px]">
                      {plan.description}
                    </p>

                    <div className="mt-4 mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">
                          {monthlyPrice > 0 ? formatPrice(plan.price_monthly) : "Gratuit"}
                        </span>
                        {monthlyPrice > 0 && (
                          <span className="text-gray-500 text-sm">
                            {plan.currency}/mois
                          </span>
                        )}
                      </div>
                      {yearlyPrice > 0 && (
                        <p className="text-sm text-green-600 mt-1">
                          {formatPrice(plan.price_yearly)} {plan.currency}/an
                          {monthlyPrice > 0 && (
                            <span className="text-gray-400 ml-1">
                              (
                              {Math.round(
                                (1 - yearlyPrice / (monthlyPrice * 12)) * 100
                              )}
                              % d&apos;économie)
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span>{plan.max_users} utilisateur(s)</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span>{plan.max_branches} succursale(s)</span>
                      </div>
                      {plan.max_products && (
                        <div className="flex items-center gap-2 text-sm">
                          <Package className="h-4 w-4 text-gray-400" />
                          <span>{plan.max_products} produits</span>
                        </div>
                      )}
                      {plan.max_monthly_transactions && (
                        <div className="flex items-center gap-2 text-sm">
                          <Zap className="h-4 w-4 text-gray-400" />
                          <span>{plan.max_monthly_transactions} transactions/mois</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <HardDrive className="h-4 w-4 text-gray-400" />
                        <span>{plan.storage_limit_mb} Mo stockage</span>
                      </div>
                    </div>

                    {isCurrent ? (
                      <Button disabled className="w-full" variant="outline">
                        <Check className="h-4 w-4 mr-2" />
                        Plan actuel
                      </Button>
                    ) : (
                      <Button
                        className="w-full bg-orange-600 hover:bg-orange-700"
                        onClick={() => handleSelectPlan(plan)}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Choisir ce plan
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {plans.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                Aucun plan disponible pour le moment.
              </div>
            )}
          </div>
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique des paiements</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Méthode</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        Aucun paiement
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="text-sm">
                          {new Date(payment.created_at).toLocaleDateString("fr-CD")}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatPrice(payment.amount)} {payment.currency}
                        </TableCell>
                        <TableCell>{payment.payment_method_display}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {payment.reference || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={PAYMENT_STATUS_COLORS[payment.status] || ""}>
                            {payment.status_display}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices */}
        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Factures</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Facture</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date émission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        Aucune facture
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono text-sm">
                          {invoice.invoice_number}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(invoice.period_start).toLocaleDateString("fr-CD")} -{" "}
                          {new Date(invoice.period_end).toLocaleDateString("fr-CD")}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatPrice(invoice.total)} {invoice.currency}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              invoice.status === "paid"
                                ? "bg-green-100 text-green-700"
                                : invoice.status === "pending"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-gray-100 text-gray-700"
                            }
                          >
                            {invoice.status_display}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(invoice.issue_date).toLocaleDateString("fr-CD")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Activate Dialog - Flux de paiement complet */}
      <Dialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Souscrire à un abonnement</DialogTitle>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-6">
              {/* Plan sélectionné */}
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-xl text-orange-900">{selectedPlan.name}</p>
                    <p className="text-sm text-orange-700 mt-1">{selectedPlan.description}</p>
                  </div>
                  <Crown className="h-8 w-8 text-orange-500" />
                </div>
              </div>

              {/* Cycle de facturation */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Cycle de facturation</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("monthly")}
                    className={`p-4 rounded-lg border-2 transition-all ${billingCycle === "monthly"
                      ? "border-orange-500 bg-orange-50"
                      : "border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    <div className="text-left">
                      <p className="font-semibold">Mensuel</p>
                      <p className="text-2xl font-bold text-orange-600 mt-1">
                        {formatPrice(selectedPlan.price_monthly)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{selectedPlan.currency}/mois</p>
                    </div>
                  </button>
                  {parseFloat(selectedPlan.price_yearly) > 0 && (
                    <button
                      type="button"
                      onClick={() => setBillingCycle("yearly")}
                      className={`p-4 rounded-lg border-2 transition-all relative ${billingCycle === "yearly"
                        ? "border-orange-500 bg-orange-50"
                        : "border-gray-200 hover:border-gray-300"
                        }`}
                    >
                      <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                        Économie
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">Annuel</p>
                        <p className="text-2xl font-bold text-orange-600 mt-1">
                          {formatPrice(selectedPlan.price_yearly)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{selectedPlan.currency}/an</p>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Moyen de paiement */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Moyen de paiement</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("mobile_money")}
                    className={`p-4 rounded-lg border-2 transition-all ${paymentMethod === "mobile_money"
                      ? "border-orange-500 bg-orange-50"
                      : "border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-2">📱</div>
                      <p className="font-semibold text-sm">Mobile Money</p>
                      <p className="text-xs text-gray-500 mt-1">Airtel, Vodacom, Orange</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`p-4 rounded-lg border-2 transition-all ${paymentMethod === "card"
                      ? "border-orange-500 bg-orange-50"
                      : "border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-2">💳</div>
                      <p className="font-semibold text-sm">Carte bancaire</p>
                      <p className="text-xs text-gray-500 mt-1">Visa, Mastercard</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("bank_transfer")}
                    className={`p-4 rounded-lg border-2 transition-all ${paymentMethod === "bank_transfer"
                      ? "border-orange-500 bg-orange-50"
                      : "border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-2">🏦</div>
                      <p className="font-semibold text-sm">Virement</p>
                      <p className="text-xs text-gray-500 mt-1">Virement bancaire</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("manual")}
                    className={`p-4 rounded-lg border-2 transition-all ${paymentMethod === "manual"
                      ? "border-orange-500 bg-orange-50"
                      : "border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-2">📝</div>
                      <p className="font-semibold text-sm">Manuel</p>
                      <p className="text-xs text-gray-500 mt-1">Autre moyen</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Formulaire Mobile Money */}
              {paymentMethod === "mobile_money" && (
                <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900">Informations Mobile Money</h3>
                  <div>
                    <Label>Opérateur</Label>
                    <Select defaultValue="airtel">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="airtel">Airtel Money</SelectItem>
                        <SelectItem value="vodacom">M-Pesa (Vodacom)</SelectItem>
                        <SelectItem value="orange">Orange Money</SelectItem>
                        <SelectItem value="africell">Africell Money</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Numéro de téléphone</Label>
                    <Input
                      type="tel"
                      placeholder="+243 XXX XXX XXX"
                      className="text-lg"
                    />
                  </div>
                  <div className="bg-blue-100 rounded-lg p-3 text-sm text-blue-800">
                    <p className="font-semibold mb-1">💡 Comment ça marche ?</p>
                    <p>Vous recevrez une notification sur votre téléphone pour confirmer le paiement.</p>
                  </div>
                </div>
              )}

              {/* Formulaire Carte bancaire */}
              {paymentMethod === "card" && (
                <div className="space-y-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-900">Informations de carte</h3>
                  <div>
                    <Label>Numéro de carte</Label>
                    <Input
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      className="text-lg font-mono"
                      maxLength={19}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Date d&apos;expiration</Label>
                      <Input
                        type="text"
                        placeholder="MM/AA"
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <Label>CVV</Label>
                      <Input
                        type="text"
                        placeholder="123"
                        maxLength={3}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Nom sur la carte</Label>
                    <Input
                      type="text"
                      placeholder="JEAN DUPONT"
                      className="uppercase"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Lock className="h-3 w-3" />
                    <span>Paiement sécurisé SSL 256-bit</span>
                  </div>
                </div>
              )}

              {/* Référence (pour virement et manuel) */}
              {(paymentMethod === "bank_transfer" || paymentMethod === "manual") && (
                <div>
                  <Label>Référence de paiement (optionnel)</Label>
                  <Input
                    placeholder="Ex: TXN-123456"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                  />
                </div>
              )}

              {/* Récapitulatif */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold mb-3">Récapitulatif</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Plan</span>
                    <span className="font-medium">{selectedPlan.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cycle</span>
                    <span className="font-medium">
                      {billingCycle === "monthly" ? "Mensuel" : "Annuel"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Moyen de paiement</span>
                    <span className="font-medium">
                      {paymentMethod === "mobile_money"
                        ? "Mobile Money"
                        : paymentMethod === "card"
                          ? "Carte bancaire"
                          : paymentMethod === "bank_transfer"
                            ? "Virement"
                            : "Manuel"}
                    </span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Total à payer</span>
                      <span className="text-2xl font-bold text-orange-600">
                        {formatPrice(
                          billingCycle === "yearly"
                            ? selectedPlan.price_yearly
                            : selectedPlan.price_monthly
                        )}{" "}
                        {selectedPlan.currency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowActivateDialog(false)}
              disabled={isActivating}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 flex-1"
              onClick={handleActivate}
              disabled={isActivating}
            >
              {isActivating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Payer maintenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
