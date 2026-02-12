import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

// Durées de validité des tokens (en millisecondes)
// Doit correspondre à la configuration SIMPLE_JWT du backend Django
const ACCESS_TOKEN_LIFETIME = 30 * 60 * 1000; // 30 minutes (backend: 30 min)
const REFRESH_TOKEN_LIFETIME = 7 * 24 * 60 * 60 * 1000; // 7 jours (backend: 7 jours)
// Rafraîchir 2 minutes avant l'expiration pour éviter les problèmes de timing
const REFRESH_BUFFER = 2 * 60 * 1000; // 2 minutes

/**
 * Rafraîchit le token d'accès en utilisant le refresh token
 */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    console.log("[Auth] Tentative de rafraîchissement du token...");

    const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh: token.refreshToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[Auth] Échec du rafraîchissement:", response.status, errorData);

      // Le refresh token est invalide ou expiré
      return {
        ...token,
        accessToken: undefined,
        accessTokenExpires: 0,
        error: "RefreshAccessTokenError",
      };
    }

    const refreshedTokens = await response.json();
    console.log("[Auth] Token rafraîchi avec succès");

    return {
      ...token,
      accessToken: refreshedTokens.access,
      accessTokenExpires: Date.now() + ACCESS_TOKEN_LIFETIME,
      // Le backend Django avec ROTATE_REFRESH_TOKENS=True renvoie toujours un nouveau refresh token
      refreshToken: refreshedTokens.refresh,
      refreshTokenExpires: Date.now() + REFRESH_TOKEN_LIFETIME,
      // Effacer toute erreur précédente
      error: undefined,
    };
  } catch (error) {
    console.error("[Auth] Erreur lors du rafraîchissement:", error);
    return {
      ...token,
      accessToken: undefined,
      accessTokenExpires: 0,
      error: "RefreshAccessTokenError",
    };
  }
}

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("[Auth] Identifiants manquants");
          return null;
        }

        try {
          console.log("[Auth] Tentative de connexion pour:", credentials.email);

          const response = await fetch(`${API_BASE_URL}/auth/token/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!response.ok) {
            console.log("[Auth] Échec de connexion:", response.status);
            return null;
          }

          const data = await response.json();

          if (data.access && data.refresh) {
            console.log("[Auth] Connexion réussie");

            const now = Date.now();
            return {
              id: data.user?.id || "user",
              email: credentials.email as string,
              name: data.user?.first_name || credentials.email,
              accessToken: data.access,
              refreshToken: data.refresh,
              accessTokenExpires: now + ACCESS_TOKEN_LIFETIME,
              refreshTokenExpires: now + REFRESH_TOKEN_LIFETIME,
            };
          }

          return null;
        } catch (error) {
          console.error("[Auth] Erreur de connexion:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Connexion initiale : stocker les tokens
      if (user) {
        console.log("[Auth] Nouvelle session créée");
        return {
          ...token,
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          accessTokenExpires: user.accessTokenExpires,
          refreshTokenExpires: user.refreshTokenExpires,
          email: user.email,
          error: undefined,
        };
      }

      // Si le token a une erreur de rafraîchissement, le propager
      if (token.error === "RefreshAccessTokenError") {
        console.log("[Auth] Session expirée, déconnexion nécessaire");
        return token;
      }

      // Vérifier si le token d'accès est encore valide
      const now = Date.now();
      const accessTokenExpires = token.accessTokenExpires as number || 0;

      // Rafraîchir 2 minutes avant l'expiration pour éviter les problèmes de timing
      const shouldRefresh = now >= accessTokenExpires - REFRESH_BUFFER;

      if (!shouldRefresh) {
        // Token encore valide
        return token;
      }

      console.log("[Auth] Token expiré ou proche de l'expiration, rafraîchissement...");

      // Rafraîchir le token
      return refreshAccessToken(token);
    },

    async session({ session, token }) {
      // Propager les informations du token vers la session
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      session.error = token.error as string | undefined;

      if (session.user && token.email) {
        session.user.email = token.email as string;
      }

      return session;
    },

    async authorized({ auth, request }) {
      // Toujours retourner true ici — le middleware custom gère
      // les sessions expirées avec un nettoyage propre des cookies.
      // Retourner false ici causerait une boucle de redirection infinie
      // car next-auth redirige avant que les cookies soient effacés.
      return true;
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  session: {
    strategy: "jwt",
    // La session next-auth expire après 7 jours (correspond au REFRESH_TOKEN_LIFETIME du backend)
    maxAge: 7 * 24 * 60 * 60, // 7 jours
    // updateAge: 0 = toujours réécrire le cookie de session quand le JWT callback s'exécute.
    // C'est essentiel pour que le nouveau accessToken soit immédiatement persisté dans le cookie
    // après un rafraîchissement, et disponible pour les requêtes suivantes.
    updateAge: 0,
  },
  trustHost: true,
};
