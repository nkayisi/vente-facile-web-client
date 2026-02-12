import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * API route qui force le rafraîchissement de la session.
 * Appeler GET /api/auth/refresh déclenche le jwt callback côté serveur,
 * ce qui rafraîchit le token d'accès si nécessaire.
 * Contrairement à getSession() côté client, ceci n'utilise pas le cache.
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session || session.error === "RefreshAccessTokenError") {
      return NextResponse.json(
        { error: "Session expirée" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      accessToken: session.accessToken,
    });
  } catch (error) {
    console.error("[Auth Refresh Route] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors du rafraîchissement" },
      { status: 500 }
    );
  }
}
