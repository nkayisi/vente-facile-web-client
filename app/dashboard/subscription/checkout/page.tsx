"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useOrganization } from "@/components/auth/organization-checker";
import {
  getPlans,
  initiateMokoSubscriptionPayment,
  type MokoOperator,
  type Plan,
} from "@/actions/subscription.actions";
import { formatPrice } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Lock, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { cn } from "@/lib/utils";

const OPERATORS: {
  id: MokoOperator;
  label: string;
  shortLabel: string;
  image: string;
}[] = [
  { id: "airtel", label: "Airtel Money", shortLabel: "Airtel", image: "/payment/airtel%20money.png" },
  { id: "orange", label: "Orange Money", shortLabel: "Orange", image: "/payment/orange%20money.jpg" },
  { id: "mpesa", label: "M-Pesa", shortLabel: "M-Pesa", image: "/payment/Mpesa-1.png" },
  { id: "africell", label: "Afrimoney", shortLabel: "Afrimoney", image: "/payment/afrimoney.png" },
];

type BillingKey = "monthly" | "yearly" | "quarterly";

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("planId");
  const cycleParam = searchParams.get("cycle");
  const initialCycle: BillingKey =
    cycleParam === "yearly" || cycleParam === "quarterly" ? cycleParam : "monthly";
  const [billingCycle, setBillingCycle] = useState<BillingKey>(initialCycle);

  const { data: session, status: sessionStatus } = useSession();
  const { organization } = useOrganization();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [method, setMethod] = useState<MokoOperator | null>(null);
  const [customerNumber, setCustomerNumber] = useState("");
  const [processing, setProcessing] = useState(false);

  const plan = plans.find((p) => p.id === planId);

  useEffect(() => {
    async function load() {
      if (!session?.accessToken) return;
      setLoadingPlans(true);
      const res = await getPlans(session.accessToken);
      if (res.success && res.data) {
        setPlans(res.data.filter((p) => p.code !== "trial"));
      } else {
        toast.error(res.error || "Impossible de charger les plans");
      }
      setLoadingPlans(false);
    }
    if (sessionStatus === "authenticated" && session?.accessToken) load();
  }, [session?.accessToken, sessionStatus]);

  const loginRedirectUrl = useMemo(() => {
    const q = new URLSearchParams();
    if (planId) q.set("planId", planId);
    q.set("cycle", billingCycle);
    return `/dashboard/subscription/checkout?${q.toString()}`;
  }, [planId, billingCycle]);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.replace(`/auth/login?callbackUrl=${encodeURIComponent(loginRedirectUrl)}`);
    }
  }, [sessionStatus, router, loginRedirectUrl]);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !organization?.id || !plan || !method) {
      toast.error("Informations incomplètes");
      return;
    }
    if (!(session?.user as { email?: string })?.email?.trim()) {
      toast.error("Ajoutez un e-mail à votre compte pour payer.");
      return;
    }
    if (!customerNumber.trim()) {
      toast.error("Indiquez votre numéro Mobile Money");
      return;
    }

    setProcessing(true);
    try {
      const result = await initiateMokoSubscriptionPayment(
        session.accessToken,
        organization.id,
        {
          plan_id: plan.id,
          billing_cycle: billingCycle,
          method,
          customer_number: customerNumber.trim(),
        }
      );

      if (!result.success || !result.data) {
        setProcessing(false);
        const err = result.error || "Paiement refusé";
        router.push(
          `/dashboard/subscription/payment/error?message=${encodeURIComponent(err)}`
        );
        return;
      }

      const d = result.data;
      const q = new URLSearchParams({
        reference: d.reference,
        activated: d.subscription_activated ? "1" : "0",
      });
      if (d.transaction_id) q.set("tx", d.transaction_id);
      router.push(`/dashboard/subscription/payment/success?${q.toString()}`);
    } catch {
      setProcessing(false);
      router.push(
        `/dashboard/subscription/payment/error?message=${encodeURIComponent("Erreur inattendue")}`
      );
    }
  }

  if (sessionStatus === "loading" || sessionStatus === "unauthenticated") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!organization?.id) {
    return (
      <div className="min-h-[50vh] bg-slate-50 px-4 py-16 text-center">
        <p className="text-slate-600">Sélectionnez une organisation pour continuer.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard">Retour au tableau de bord</Link>
        </Button>
      </div>
    );
  }

  if (loadingPlans) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!planId || !plan) {
    return (
      <div className="min-h-[50vh] space-y-4 bg-slate-50 px-4 py-16 text-center">
        <p className="text-slate-600">Plan introuvable ou non sélectionné.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/subscription">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux abonnements
          </Link>
        </Button>
      </div>
    );
  }

  const sym = plan.currency.symbol;
  const monthly = parseFloat(plan.price_monthly);
  const yearly = parseFloat(plan.price_yearly);
  const quarterly = monthly * 3;
  const amount =
    billingCycle === "yearly" ? yearly : billingCycle === "quarterly" ? quarterly : monthly;

  const yearlyVsMonthlyPct =
    monthly > 0 && yearly < monthly * 12
      ? Math.round((1 - yearly / (monthly * 12)) * 100)
      : 0;
  const yearlyMonthlyEquiv = yearly > 0 ? yearly / 12 : 0;

  const billingOptions: {
    key: BillingKey;
    title: string;
    line1: string;
    line2?: string;
    badge?: string;
  }[] = [
    {
      key: "monthly",
      title: "Payer mensuellement",
      line1: `${formatPrice(plan.price_monthly)} ${sym}`,
      line2: "par mois",
    },
    {
      key: "quarterly",
      title: "Payer trimestriellement",
      line1: `${formatPrice(String(quarterly))} ${sym}`,
      line2: "par trimestre",
    },
    {
      key: "yearly",
      title: "Payer annuellement",
      line1: `${formatPrice(String(yearlyMonthlyEquiv > 0 ? Math.round(yearlyMonthlyEquiv * 100) / 100 : yearly))} ${sym}`,
      line2:
        yearlyMonthlyEquiv > 0
          ? "par mois (facturé à l'année)"
          : "par an",
      badge: yearlyVsMonthlyPct > 0 ? `Économisez ${yearlyVsMonthlyPct}%` : undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-6">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-6 text-slate-600">
          <Link href="/dashboard/subscription">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Link>
        </Button>

        <header className="mb-10">
          <p className="text-sm font-medium text-orange-600">Paiement sécurisé - Mobile Money</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Finaliser votre abonnement
          </h1>
          <p className="mt-2 text-slate-600">
            Plan <span className="font-semibold text-slate-900">{plan.name}</span>
            {" · "}
            Total dû :{" "}
            <span className="font-semibold text-orange-700">
              {formatPrice(String(amount))} {sym}
            </span>
          </p>
        </header>

        <form onSubmit={handlePay} className="space-y-10">
          {/* Fréquence de facturation — cartes larges */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Fréquence de facturation
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {billingOptions.map((opt) => {
                const selected = billingCycle === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setBillingCycle(opt.key)}
                    className={cn(
                      "relative flex flex-col rounded-2xl border-2 bg-white p-2.5 px-3.5 text-left shadow-sm transition-all",
                      "hover:border-orange-200 hover:shadow-md",
                      selected
                        ? "border-orange-500 ring-2 ring-orange-500/20"
                        : "border-slate-200"
                    )}
                  >
                    {selected && (
                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm">
                        <Check className="h-3.5 w-3.5 stroke-3" />
                      </span>
                    )}
                    {opt.badge ? (
                      <span className="mb-2 inline-flex w-fit rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        {opt.badge}
                      </span>
                    ) : (
                      <span className="mb-2 h-5" aria-hidden />
                    )}
                    <span className="text-sm font-medium text-slate-900">{opt.title}</span>
                    <span className="mt-1 text-2xl font-bold text-slate-900">{opt.line1}</span>
                    {opt.line2 && (
                      <span className="text-sm text-slate-500">{opt.line2}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Moyen de paiement — rangée horizontale */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Moyen de paiement
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {OPERATORS.map((op) => {
                const selected = method === op.id;
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setMethod(op.id)}
                    className={cn(
                      "flex min-h-[72px] min-w-[100px] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 bg-white px-4 py-3 shadow-sm transition-all sm:min-w-[120px] sm:flex-initial",
                      "hover:border-orange-200",
                      selected
                        ? "border-orange-500 ring-2 ring-orange-500/20"
                        : "border-slate-200"
                    )}
                  >
                    <div className="relative h-9 w-20">
                      <Image
                        src={op.image}
                        alt=""
                        fill
                        className="object-contain"
                        sizes="80px"
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-700">{op.shortLabel}</span>
                  </button>
                );
              })}
            </div>
            {!method && (
              <p className="text-xs text-amber-700">Sélectionnez un opérateur pour continuer.</p>
            )}
          </section>

          {/* Informations — bloc carte */}
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Informations de paiement
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                  <Smartphone className="h-4 w-4 text-orange-600" />
                  Mobile Money (MOKO)
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  Paiement chiffré
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-700">
                Numéro Mobile Money
              </Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="ex. 0997057917"
                value={customerNumber}
                onChange={(e) => setCustomerNumber(e.target.value)}
                autoComplete="tel"
                className="h-11 rounded-xl border-slate-200 bg-slate-50/50"
                required
              />
              <p className="text-xs text-slate-500">
                E-mail du compte (requis par l&apos;opérateur) :{" "}
                <span className="font-medium text-slate-700">
                  {(session?.user as { email?: string } | undefined)?.email || "—"}
                </span>
              </p>
            </div>
          </section>

          <Button
            type="submit"
            size="lg"
            className="h-12 w-full rounded-xl bg-orange-600 text-base font-semibold shadow-md hover:bg-orange-700"
            disabled={!method || processing}
          >
            Payer {formatPrice(String(amount))} {sym}
          </Button>
        </form>
      </div>

      <Dialog open={processing} onOpenChange={() => {}}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Traitement du paiement</DialogTitle>
            <DialogDescription>
              Veuillez patienter jusqu&apos;à la réponse du fournisseur de paiement.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-12 w-12 animate-spin text-orange-600" />
            <p className="text-center text-sm text-muted-foreground">
              Ne fermez pas cette fenêtre.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SubscriptionCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center bg-slate-50">
          <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
