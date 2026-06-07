"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useOrganization } from "@/components/auth/organization-checker";
import { checkMokoPaymentStatus } from "@/actions/subscription.actions";
import { Clock, Loader2, RefreshCw, ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function PendingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") || "";

  const { data: session } = useSession();
  const { organization } = useOrganization();

  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [status, setStatus] = useState<"pending" | "completed" | "failed" | null>(null);

  const checkStatus = useCallback(async () => {
    if (!session?.accessToken || !organization?.id || !reference) return;

    setChecking(true);
    try {
      const result = await checkMokoPaymentStatus(
        session.accessToken,
        organization.id,
        reference
      );

      setLastCheck(new Date());

      if (result.success && result.data) {
        setStatus(result.data.status as "pending" | "completed" | "failed");

        if (result.data.status === "completed") {
          const q = new URLSearchParams({
            reference,
            activated: result.data.subscription_activated ? "1" : "0",
          });
          router.push(`/payment/success?${q.toString()}`);
          return;
        }

        if (result.data.status === "failed") {
          router.push(
            `/payment/error?message=${encodeURIComponent(
              result.data.message || "Le paiement a échoué"
            )}`
          );
          return;
        }
      }
    } catch (err) {
      console.error("Check status error:", err);
    } finally {
      setChecking(false);
    }
  }, [session?.accessToken, organization?.id, reference, router]);

  useEffect(() => {
    if (reference && session?.accessToken && organization?.id) {
      checkStatus();
    }
  }, [reference, session?.accessToken, organization?.id, checkStatus]);

  if (!reference) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-slate-600">Aucune référence de paiement fournie.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/subscription">Retour aux abonnements</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4">
      {/* Icône */}
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
          <Clock className="h-10 w-10 text-amber-600" />
        </div>
      </div>

      {/* Titre */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Paiement en attente</h1>
        <p className="mt-2 text-slate-600">
          Votre paiement est en cours de traitement
        </p>
      </div>

      {/* Informations */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 mb-6">
        <div className="flex items-center justify-between py-2 border-b border-slate-100">
          <span className="text-slate-500">Référence</span>
          <span className="font-mono text-sm text-slate-900">{reference}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-slate-100">
          <span className="text-slate-500">Statut</span>
          <span className="flex items-center gap-1.5">
            {status === "pending" && (
              <>
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-amber-600 font-medium">En attente</span>
              </>
            )}
            {status === "completed" && (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-green-600 font-medium">Réussi</span>
              </>
            )}
            {status === "failed" && (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-600 font-medium">Échoué</span>
              </>
            )}
            {!status && <span className="text-slate-400">—</span>}
          </span>
        </div>
        {lastCheck && (
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-slate-400">Dernière vérification</span>
            <span className="text-slate-500">
              {lastCheck.toLocaleTimeString("fr-FR")}
            </span>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-amber-50 rounded-xl p-4 mb-8">
        <p className="text-sm font-medium text-amber-800 mb-2">Que faire ?</p>
        <ul className="text-sm text-amber-700 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
            Vérifiez le message USSD sur votre téléphone
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
            Confirmez avec votre code PIN
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
            Assurez-vous d&apos;avoir un solde suffisant
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <Button
          onClick={checkStatus}
          disabled={checking}
          className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-700"
        >
          {checking ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Vérifier le statut
        </Button>
        <Button asChild variant="outline" className="w-full h-12 rounded-xl">
          <Link href="/dashboard/subscription">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux abonnements
          </Link>
        </Button>
      </div>

      <p className="text-center text-xs text-slate-400 mt-6">
        Si le paiement a été confirmé mais que le statut ne change pas,
        veuillez patienter quelques minutes.
      </p>
    </div>
  );
}

export default function PaymentPendingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
        </div>
      }
    >
      <PendingContent />
    </Suspense>
  );
}
