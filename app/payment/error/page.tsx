"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { XCircle, Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

function ErrorContent() {
  const searchParams = useSearchParams();
  const message =
    searchParams.get("message") ||
    "Le paiement n'a pas pu être effectué. Vérifiez votre solde et votre numéro, puis réessayez.";

  return (
    <div className="max-w-md mx-auto px-4">
      {/* Icône */}
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
          <XCircle className="h-10 w-10 text-red-600" />
        </div>
      </div>

      {/* Titre */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Paiement échoué</h1>
        <p className="mt-2 text-slate-600">
          Une erreur est survenue lors du paiement
        </p>
      </div>

      {/* Message d'erreur */}
      <div className="bg-red-50 rounded-xl p-4 mb-8">
        <p className="text-sm text-red-800 text-center whitespace-pre-wrap">
          {message}
        </p>
      </div>

      {/* Conseils */}
      <div className="bg-slate-50 rounded-xl p-4 mb-8">
        <p className="text-sm font-medium text-slate-700 mb-2">Vérifiez que :</p>
        <ul className="text-sm text-slate-600 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
            Votre numéro de téléphone est correct
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
            Vous avez un solde suffisant
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
            Vous avez confirmé le paiement sur votre téléphone
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <Button asChild className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700">
          <Link href="/dashboard/subscription">
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full h-12 rounded-xl">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au tableau de bord
          </Link>
        </Button>
      </div>

      <p className="text-center text-xs text-slate-400 mt-6">
        Besoin d&apos;aide ?{" "}
        <a href="mailto:support@ventefacile.cd" className="text-orange-600 hover:underline">
          Contactez le support
        </a>
      </p>
    </div>
  );
}

export default function PaymentErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
