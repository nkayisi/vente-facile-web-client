"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

// Erreur volontaire côté navigateur, levée au clic. Doit être capturée par
// Sentry (client) et apparaître dans le dashboard.
class SentryExampleFrontendError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleFrontendError";
  }
}

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export default function SentryExamplePage() {
  const [hasSentError, setHasSentError] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Vérifie que le SDK peut joindre Sentry (détecte bloqueurs de pub / réseau).
    async function checkConnectivity() {
      try {
        const result = await Sentry.diagnoseSdkConnectivity();
        setIsConnected(result !== "sentry-unreachable");
      } catch {
        setIsConnected(false);
      }
    }
    if (dsn) checkConnectivity();
  }, []);

  const handleThrowError = async () => {
    await Sentry.startSpan(
      { name: "Example Frontend Span", op: "test" },
      async () => {
        const res = await fetch("/api/sentry-example-api");
        if (!res.ok) {
          setHasSentError(true);
        }
        // Erreur front levée APRÈS l'appel API (qui lève côté serveur) :
        // on teste ainsi la capture client ET serveur en un clic.
        throw new SentryExampleFrontendError(
          "Erreur de test levée côté frontend depuis /sentry-example-page."
        );
      }
    );
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        background: "#f9fafb",
        color: "#111827",
      }}
    >
      <div style={{ maxWidth: "32rem", width: "100%", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          Test d&apos;intégration Sentry
        </h1>
        <p style={{ color: "#6b7280", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
          Clique sur le bouton pour lever une erreur de test côté client ET
          serveur. Si Sentry est correctement configuré, elles apparaîtront dans
          ton dashboard Sentry en quelques secondes.
        </p>

        {!dsn && (
          <div
            style={{
              background: "#fef3c7",
              border: "1px solid #fde68a",
              color: "#92400e",
              borderRadius: 8,
              padding: "0.75rem 1rem",
              marginBottom: "1.25rem",
              fontSize: "0.85rem",
              textAlign: "left",
            }}
          >
            ⚠️ <strong>NEXT_PUBLIC_SENTRY_DSN n&apos;est pas défini.</strong> Le
            bouton lèvera bien des erreurs, mais elles ne seront PAS envoyées à
            Sentry (SDK désactivé). Définis le DSN puis redémarre pour un test
            valable en production.
          </div>
        )}

        {dsn && !isConnected && (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              borderRadius: 8,
              padding: "0.75rem 1rem",
              marginBottom: "1.25rem",
              fontSize: "0.85rem",
              textAlign: "left",
            }}
          >
            ⚠️ Sentry semble injoignable (bloqueur de pub, réseau, ou DSN
            invalide). Les événements risquent de ne pas remonter.
          </div>
        )}

        <button
          type="button"
          onClick={handleThrowError}
          style={{
            height: 48,
            padding: "0 1.5rem",
            borderRadius: 8,
            border: "none",
            background: "#ea580c",
            color: "#fff",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Lever une erreur de test
        </button>

        {hasSentError && (
          <p style={{ color: "#16a34a", marginTop: "1.25rem", fontSize: "0.85rem" }}>
            ✓ Erreurs levées. Vérifie ton dashboard Sentry (onglet Issues).
          </p>
        )}
      </div>
    </main>
  );
}
