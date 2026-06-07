"use client";

import { useEffect } from "react";

export default function SaleDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[sale-detail]", error);
  }, [error]);

  // Heuristique : si le message contient "403"/"permission", on rend un message
  // d'accès refusé ; "404" → vente introuvable ; sinon erreur générique.
  const msg = error.message || "";
  const isForbidden = /403|permission|interdit/i.test(msg);
  const isNotFound = /404|introuvable|not.?found/i.test(msg);

  let title = "Erreur sur la vente";
  let body = msg || "Une erreur est survenue lors du chargement de cette vente.";

  if (isForbidden) {
    title = "Accès refusé";
    body = "Vous n'avez pas l'autorisation de consulter cette vente.";
  } else if (isNotFound) {
    title = "Vente introuvable";
    body = "Cette vente n'existe plus ou ne fait pas partie de votre organisation.";
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground/70">Code : {error.digest}</p>
      ) : null}
      <div className="flex gap-2">
        {!isForbidden && !isNotFound && (
          <button
            onClick={() => reset()}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Réessayer
          </button>
        )}
        <a
          href="/dashboard/sales"
          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Retour à la liste des ventes
        </a>
      </div>
    </div>
  );
}
