"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useOrganization } from "@/components/auth/organization-checker";
import {
  getPlans,
  initiateMokoSubscriptionPayment,
  checkMokoPaymentStatus,
  type MokoOperator,
  type Plan,
} from "@/actions/subscription.actions";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Smartphone, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 180000;

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
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [pollElapsed, setPollElapsed] = useState(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartRef = useRef<number>(0);

  const plan = plans.find((p) => p.id === planId);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (reference: string) => {
      if (!session?.accessToken || !organization?.id) return;

      setPaymentReference(reference);
      pollStartRef.current = Date.now();
      setPollElapsed(0);

      const poll = async () => {
        const elapsed = Date.now() - pollStartRef.current;
        setPollElapsed(elapsed);

        if (elapsed >= POLL_TIMEOUT_MS) {
          stopPolling();
          setProcessing(false);
          router.push(
            `/payment/pending?reference=${encodeURIComponent(reference)}`
          );
          return;
        }

        try {
          const result = await checkMokoPaymentStatus(
            session.accessToken!,
            organization.id,
            reference
          );

          if (result.success && result.data) {
            const { status, subscription_activated } = result.data;

            if (status === "completed") {
              stopPolling();
              setProcessing(false);
              const q = new URLSearchParams({
                reference,
                activated: subscription_activated ? "1" : "0",
              });
              router.push(`/payment/success?${q.toString()}`);
              return;
            }

            if (status === "failed") {
              stopPolling();
              setProcessing(false);
              router.push(
                `/payment/error?message=${encodeURIComponent(
                  result.data.message || "Le paiement a échoué"
                )}`
              );
              return;
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      };

      poll();
      pollIntervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    },
    [session?.accessToken, organization?.id, router, stopPolling]
  );

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

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
    return `/payment/checkout?${q.toString()}`;
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
    if (!customerNumber.trim()) {
      toast.error("Indiquez votre numéro Mobile Money");
      return;
    }

    setProcessing(true);
    setPaymentReference(null);
    setPollElapsed(0);

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
          `/payment/error?message=${encodeURIComponent(err)}`
        );
        return;
      }

      const d = result.data;

      if (d.subscription_activated) {
        setProcessing(false);
        const q = new URLSearchParams({
          reference: d.reference,
          activated: "1",
        });
        if (d.transaction_id) q.set("tx", d.transaction_id);
        router.push(`/payment/success?${q.toString()}`);
        return;
      }

      toast.success(d.message || "Confirmez le paiement sur votre téléphone");
      startPolling(d.reference);
    } catch {
      setProcessing(false);
      router.push(
        `/payment/error?message=${encodeURIComponent("Erreur inattendue")}`
      );
    }
  }

  if (sessionStatus === "loading" || sessionStatus === "unauthenticated") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!organization?.id) {
    return (
      <div className="min-h-[50vh] px-4 py-16 text-center">
        <p className="text-slate-600">Sélectionnez une organisation pour continuer.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard">Retour au tableau de bord</Link>
        </Button>
      </div>
    );
  }

  if (loadingPlans) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!planId || !plan) {
    return (
      <div className="min-h-[50vh] space-y-4 px-4 py-16 text-center">
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
        title: "Mensuel",
        line1: `${parseFloat(plan.price_monthly)} ${sym}`,
        line2: "par mois",
      },
      {
        key: "quarterly",
        title: "Trimestriel",
        line1: `${quarterly.toFixed(2)} ${sym}`,
        line2: "par trimestre",
      },
      {
        key: "yearly",
        title: "Annuel",
        line1: `${yearlyMonthlyEquiv > 0 ? Math.round(yearlyMonthlyEquiv * 100) / 100 : yearly} ${sym}`,
        line2: "par an",
        badge: yearlyVsMonthlyPct > 0 ? `-${yearlyVsMonthlyPct}%` : undefined,
      },
    ];

  return (
    <div className="max-w-md mx-auto px-4">
      {/* Lien retour */}
      <Button variant="ghost" size="sm" asChild className="-ml-3 mb-6 text-slate-500 hover:text-slate-700">
        <Link href="/dashboard/subscription">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Retour
        </Link>
      </Button>

      {/* En-tête */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Finaliser le paiement</h1>
        <p className="mt-2 text-slate-600">
          Plan <span className="font-semibold text-orange-600">{plan.name}</span>
        </p>
      </div>

      <form onSubmit={handlePay} className="space-y-6">
        {/* Fréquence de facturation */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700">Fréquence</label>
          <div className="grid grid-cols-3 gap-2">
            {billingOptions.map((opt) => {
              const selected = billingCycle === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setBillingCycle(opt.key)}
                  className={cn(
                    "relative rounded-xl border-2 p-3 text-center transition-all",
                    "hover:border-orange-200",
                    selected
                      ? "border-orange-500 bg-orange-50"
                      : "border-slate-200 bg-white"
                  )}
                >
                  {opt.badge && (
                    <span className="absolute -top-2 right-2 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {opt.badge}
                    </span>
                  )}
                  <div className="text-lg font-bold text-slate-900">{opt.line1}</div>
                  <div className="text-xs text-slate-500">{opt.line2}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Opérateur Mobile Money */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700">Opérateur</label>
          <div className="grid grid-cols-2 gap-2">
            {OPERATORS.map((op) => {
              const selected = method === op.id;
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setMethod(op.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-2 bg-white p-3 transition-all",
                    "hover:border-orange-200",
                    selected
                      ? "border-orange-500 bg-orange-50"
                      : "border-slate-200"
                  )}
                >
                  <div className="relative h-8 w-10 flex-shrink-0">
                    <Image
                      src={op.image}
                      alt=""
                      fill
                      className="object-contain"
                      sizes="40px"
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-700">{op.shortLabel}</span>
                  {selected && (
                    <Check className="ml-auto h-4 w-4 text-orange-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Numéro de téléphone */}
        <div className="space-y-2">
          <label htmlFor="phone" className="text-sm font-medium text-slate-700">
            Numéro Mobile Money
          </label>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            placeholder="ex. 0997057917"
            value={customerNumber}
            onChange={(e) => setCustomerNumber(e.target.value)}
            autoComplete="tel"
            className="h-12 rounded-xl border-slate-200 bg-white text-center text-lg tracking-wider"
            required
          />
        </div>

        {/* Récapitulatif */}
        <div className="rounded-xl bg-slate-100 p-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Total à payer</span>
            <span className="text-xl font-bold text-slate-900">
              {amount} {sym}
            </span>
          </div>
        </div>

        {/* Bouton de paiement */}
        <Button
          type="submit"
          size="lg"
          className="h-14 w-full rounded-xl bg-orange-600 text-lg font-semibold shadow-lg shadow-orange-500/25 hover:bg-orange-700"
          disabled={!method || processing}
        >
          {processing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Payer maintenant"
          )}
        </Button>

        <p className="text-center text-xs text-slate-400">
          Paiement sécurisé via Mobile Money
        </p>
      </form>

      {/* Dialog de confirmation */}
      <Dialog open={processing} onOpenChange={() => { }}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-sm"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="text-center">
            <DialogTitle className="flex items-center justify-center gap-2">
              <Smartphone className="h-5 w-5 text-orange-600" />
              Confirmation en cours
            </DialogTitle>
            <DialogDescription className="text-center">
              {paymentReference
                ? "Confirmez le paiement sur votre téléphone"
                : "Connexion au service de paiement..."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="relative">
              <Loader2 className="h-16 w-16 animate-spin text-orange-600" />
              {method && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-8 w-8 rounded-full bg-white shadow-sm flex items-center justify-center">
                    <Image
                      src={OPERATORS.find((o) => o.id === method)?.image || ""}
                      alt=""
                      width={24}
                      height={24}
                      className="object-contain"
                    />
                  </div>
                </div>
              )}
            </div>

            {paymentReference && (
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-slate-700">
                  Message USSD envoyé
                </p>
                <p className="text-xs text-slate-500">
                  Entrez votre code PIN pour confirmer
                </p>
              </div>
            )}

            <div className="w-full space-y-2">
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {Math.floor(pollElapsed / 1000)}s / {Math.floor(POLL_TIMEOUT_MS / 1000)}s
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-500"
                  style={{ width: `${Math.min((pollElapsed / POLL_TIMEOUT_MS) * 100, 100)}%` }}
                />
              </div>
            </div>

            <p className="text-center text-xs text-slate-400">
              Ne fermez pas cette fenêtre
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PaymentCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
