"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function SuccessInner() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") || "—";
  const activated = searchParams.get("activated") === "1";
  const tx = searchParams.get("tx");

  return (
    <div className="max-w-lg mx-auto py-16 px-4">
      <Card className="border-green-200 bg-green-50/40">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-2">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <CardTitle className="text-xl text-green-900">
            {activated ? "Abonnement activé" : "Paiement initié"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-gray-700">
          {activated ? (
            <p>
              Votre abonnement est actif. Vous pouvez utiliser toutes les fonctionnalités prévues par
              votre plan.
            </p>
          ) : (
            <p>
              Votre demande de paiement a été envoyée. L&apos;activation de l&apos;abonnement sera
              finalisée dès confirmation par l&apos;opérateur (vous pouvez aussi recevoir une
              notification ultérieure).
            </p>
          )}
          <div className="rounded-lg bg-white border p-3 text-left font-mono text-xs space-y-1">
            <p>
              <span className="text-gray-500">Référence :</span> {reference}
            </p>
            {tx ? (
              <p>
                <span className="text-gray-500">Transaction :</span> {tx}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button asChild className="bg-orange-600 hover:bg-orange-700">
              <Link href="/dashboard">Tableau de bord</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/subscription">Mon abonnement</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
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
      <SuccessInner />
    </Suspense>
  );
}
