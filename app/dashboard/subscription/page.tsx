"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useOrganization } from "@/components/auth/organization-checker";
import { useSubscription } from "@/components/auth/subscription-guard";
import {
  getPlans,
  getSubscriptionPayments,
  getSubscriptionInvoices,
  Plan,
  SubscriptionPayment,
  SubscriptionInvoice,
} from "@/actions/subscription.actions";
import { formatPrice } from "@/lib/format";
import { toast } from "sonner";
import {
  Crown,
  CreditCard,
  Check,
  Shield,
  Users,
  Building2,
  Package,
  HardDrive,
  Loader2,
  Star,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const router = useRouter();
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { subscriptionStatus } = useSubscription();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
          setPlans(plansRes.data.filter((p) => p.code.toLowerCase() !== "trial"));
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

  function handleSelectPlan(plan: Plan, mode: "new" | "extend" = "new") {
    const q = new URLSearchParams({ planId: plan.id, cycle: "monthly", mode });
    router.push(`/payment/checkout?${q.toString()}`);
  }

  const subscription = subscriptionStatus?.subscription;
  const quotas = subscriptionStatus?.quotas;

  function getPlanAction(plan: Plan): {
    disabled: boolean;
    label: string;
    title?: string;
    isCurrent: boolean;
    mode: "new" | "extend";
  } {
    const isCurrent = subscription?.plan === plan.id;
    const floor = quotas?.subscription_floor_tier ?? 0;
    if (plan.tier < floor) {
      return {
        disabled: true,
        label: "Offre indisponible",
        title:
          "Vous ne pouvez pas souscrire à une offre de palier inférieur à celui déjà utilisé sur ce compte.",
        isCurrent,
        mode: "new",
      };
    }
    if (isCurrent) {
      if (quotas?.period_not_ended) {
        return {
          disabled: false,
          label: "Prolonger",
          title:
            "Prolonger la période de ce plan en payant une période supplémentaire.",
          isCurrent: true,
          mode: "extend",
        };
      }
      return {
        disabled: false,
        label: "Renouveler",
        title: "Souscrire à nouveau à ce plan",
        isCurrent: true,
        mode: "new",
      };
    }
    if (quotas?.period_not_ended && quotas.plan_tier != null && plan.tier <= quotas.plan_tier) {
      return {
        disabled: true,
        label: "Indisponible",
        title:
          "Pendant la période en cours, seul un plan à palier strictement supérieur (upgrade) est disponible.",
        isCurrent: false,
        mode: "new",
      };
    }
    return { disabled: false, label: "Choisir ce plan", isCurrent: false, mode: "new" };
  }

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
              const planAction = getPlanAction(plan);
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
                          {monthlyPrice > 0 ? plan.price_monthly : "Gratuit"}
                        </span>
                        {monthlyPrice > 0 && (
                          <span className="text-gray-500 text-sm">
                            {plan.currency.symbol}/mois
                          </span>
                        )}
                      </div>
                      {yearlyPrice > 0 && (
                        <p className="text-sm text-green-600 mt-1">
                          {plan.price_yearly} {plan.currency.symbol}/an
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

                    <Button
                      type="button"
                      disabled={planAction.disabled}
                      title={planAction.title}
                      className={`w-full ${planAction.disabled ? "" : "bg-orange-600 hover:bg-orange-700"}`}
                      variant={planAction.disabled ? "outline" : "default"}
                      onClick={() => {
                        if (!planAction.disabled) handleSelectPlan(plan, planAction.mode);
                      }}
                    >
                      {planAction.isCurrent && planAction.disabled ? (
                        <Check className="h-4 w-4 mr-2" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-2" />
                      )}
                      {planAction.label}
                    </Button>
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
    </div>
  );
}
