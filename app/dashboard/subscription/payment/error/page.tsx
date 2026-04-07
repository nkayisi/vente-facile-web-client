"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function ErrorInner() {
  const searchParams = useSearchParams();
  const message =
    searchParams.get("message") ||
    "Le paiement n'a pas pu être effectué. Vérifiez votre solde et votre numéro, puis réessayez.";

  return (
    <div className="max-w-lg mx-auto py-16 px-4">
      <Card className="border-red-200 bg-red-50/40">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-2">
            <AlertCircle className="h-10 w-10 text-red-600" />
          </div>
          <CardTitle className="text-xl text-red-900">Paiement refusé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-gray-700">
          <p className="whitespace-pre-wrap">{message}</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/subscription">Retour aux plans</Link>
            </Button>
            <Button asChild className="bg-orange-600 hover:bg-orange-700">
              <Link href="/dashboard">Tableau de bord</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
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
      <ErrorInner />
    </Suspense>
  );
}
