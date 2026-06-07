"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-2xl font-semibold">Une erreur est survenue</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "Quelque chose s'est mal passé."}
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground/70">Code : {error.digest}</p>
      ) : null}
      <button
        onClick={() => reset()}
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Réessayer
      </button>
    </div>
  );
}
