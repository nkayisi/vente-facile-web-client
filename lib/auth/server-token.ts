import { auth } from "@/lib/auth";

/**
 * Récupère le token d'accès frais depuis la session serveur.
 * Utilisé par les server actions quand le token passé par le client est expiré (401).
 * 
 * Le JWT callback de next-auth rafraîchit automatiquement le token si nécessaire,
 * donc appeler auth() retourne toujours un token valide (ou une erreur si le refresh token est expiré).
 */
export async function getServerAccessToken(): Promise<string | null> {
  try {
    const session = await auth();
    if (session?.accessToken && session.error !== "RefreshAccessTokenError") {
      return session.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}
