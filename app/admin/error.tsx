"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] ", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-2xl font-semibold">Erreur dans l&apos;administration</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "Une erreur est survenue lors du chargement de cette page."}
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground/70">Code : {error.digest}</p>
      ) : null}
      <div className="flex gap-2">
        <button
          onClick={() => reset()}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Réessayer
        </button>
        <a
          href="/admin"
          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Retour à l&apos;admin
        </a>
      </div>
    </div>
  );
}
