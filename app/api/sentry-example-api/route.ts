import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Erreur volontaire côté serveur, levée par la page de test /sentry-example-page.
// Elle doit être capturée automatiquement par Sentry via `onRequestError`
// (voir instrumentation.ts) et apparaître dans le dashboard Sentry.
class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleAPIError";
  }
}

export function GET() {
  throw new SentryExampleAPIError(
    "Erreur de test levée côté backend (route appelée par /sentry-example-page)."
  );
  return NextResponse.json({ data: "Testing Sentry Error..." });
}
