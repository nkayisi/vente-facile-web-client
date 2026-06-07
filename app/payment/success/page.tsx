"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function SuccessContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") || "—";
  const activated = searchParams.get("activated") === "1";
  const tx = searchParams.get("tx");

  return (
    <div className="max-w-md mx-auto px-4">
      {/* Icône */}
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
      </div>

      {/* Titre */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          {activated ? "Abonnement activé !" : "Paiement initié"}
        </h1>
        <p className="mt-2 text-slate-600">
          {activated
            ? "Votre abonnement est maintenant actif"
            : "Votre demande de paiement a été envoyée"}
        </p>
      </div>

      {/* Détails */}
      <div className="bg-white rounded-2xl border border-green-200 p-6 space-y-3 mb-8">
        <div className="flex items-center justify-between py-2 border-b border-slate-100">
          <span className="text-slate-500">Référence</span>
          <span className="font-mono text-sm text-slate-900">{reference}</span>
        </div>
        {tx && (
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">Transaction</span>
            <span className="font-mono text-sm text-slate-900">{tx}</span>
          </div>
        )}
        <div className="flex items-center justify-between py-2">
          <span className="text-slate-500">Statut</span>
          <span className="flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-green-600 font-medium">
              {activated ? "Activé" : "En cours"}
            </span>
          </span>
        </div>
      </div>

      {/* Message */}
      {activated ? (
        <div className="bg-green-50 rounded-xl p-4 mb-8 text-center">
          <p className="text-sm text-green-800">
            Vous pouvez maintenant utiliser toutes les fonctionnalités de votre plan.
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 rounded-xl p-4 mb-8 text-center">
          <p className="text-sm text-amber-800">
            L&apos;activation sera finalisée dès confirmation par l&apos;opérateur.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <Button asChild className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700">
          <Link href="/dashboard">
            Accéder au tableau de bord
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full h-12 rounded-xl">
          <Link href="/dashboard/subscription">
            Voir mon abonnement
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
