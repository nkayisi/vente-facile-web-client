"use client";

/**
 * Filet de sécurité RACINE. Next.js monte ce composant à la place du root
 * layout quand une erreur non rattrapée survient dans le layout racine, un
 * provider global, ou pendant le rendu serveur/hydratation.
 *
 * Sans ce fichier, une telle erreur produit une PAGE BLANCHE totale en
 * production (les `error.tsx` enfants ne peuvent pas la capturer). C'est la
 * dernière ligne de défense contre le symptôme « page blanche pour certains
 * utilisateurs ».
 *
 * Contrainte Next.js : global-error.tsx DOIT rendre ses propres <html> et
 * <body>, car il remplace entièrement le layout racine.
 */

import { useEffect } from "react";
import { reportClientError } from "@/lib/observability/report-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, { boundary: "global-error", digest: error.digest });
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#f9fafb",
          color: "#111827",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 1rem",
              borderRadius: "9999px",
              background: "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
            aria-hidden
          >
            ⚠️
          </div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            Une erreur inattendue est survenue
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: "0 0 1.5rem" }}>
            L&apos;application a rencontré un problème et n&apos;a pas pu afficher
            cette page. Vous pouvez réessayer ; si le problème persiste,
            contactez le support.
          </p>
          {error.digest ? (
            <p
              style={{
                fontSize: "0.75rem",
                color: "#9ca3af",
                margin: "0 0 1.5rem",
                fontFamily: "monospace",
              }}
            >
              Code : {error.digest}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              onClick={() => reset()}
              style={{
                height: 44,
                padding: "0 1.25rem",
                borderRadius: 8,
                border: "none",
                background: "#ea580c",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Réessayer
            </button>
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              style={{
                height: 44,
                padding: "0 1.25rem",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#374151",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retour à l&apos;accueil
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
