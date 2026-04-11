import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import { refreshWithMutex } from "./refresh-mutex";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
const isDev = process.env.NODE_ENV === "development";

// Durées de validité des tokens (en millisecondes)
// Doit correspondre à la configuration SIMPLE_JWT du backend Django
const ACCESS_TOKEN_LIFETIME = 30 * 60 * 1000; // 30 minutes (backend: 30 min)
const REFRESH_TOKEN_LIFETIME = 7 * 24 * 60 * 60 * 1000; // 7 jours (backend: 7 jours)
// Rafraîchir 2 minutes avant l'expiration pour éviter les problèmes de timing
const REFRESH_BUFFER = 2 * 60 * 1000; // 2 minutes

// Nombre de tentatives de retry sur erreur réseau
const MAX_REFRESH_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Rafraîchit le token d'accès en utilisant le refresh token.
 * Inclut une logique de retry pour les erreurs réseau temporaires.
 */
async function refreshAccessTokenInternal(token: JWT, retryCount = 0): Promise<JWT> {
  try {
    if (isDev) {
      console.log("[Auth] Tentative de rafraîchissement du token...");
      console.log("[Auth] Refresh token expires:", token.refreshTokenExpires ? new Date(token.refreshTokenExpires as number).toISOString() : "N/A");
    }

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
      console.error("[Auth] Échec du rafraîchissement:", response.status);
      if (isDev) {
        console.error("[Auth] Détails:", errorData);
      }

      // 401/403 = refresh token invalide, pas de retry
      if (response.status === 401 || response.status === 403) {
        return {
          ...token,
          accessToken: undefined,
          accessTokenExpires: 0,
          error: "RefreshAccessTokenError",
        };
      }

      // Autres erreurs (5xx, etc.) : retry si possible
      if (retryCount < MAX_REFRESH_RETRIES - 1) {
        console.log(`[Auth] Retry ${retryCount + 1}/${MAX_REFRESH_RETRIES} dans ${RETRY_DELAY_MS}ms...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (retryCount + 1)));
        return refreshAccessTokenInternal(token, retryCount + 1);
      }

      return {
        ...token,
        accessToken: undefined,
        accessTokenExpires: 0,
        error: "RefreshAccessTokenError",
      };
    }

    const refreshedTokens = await response.json();
    if (isDev) {
      console.log("[Auth] Token rafraîchi avec succès");
    }

    // Si le backend renvoie un nouveau refresh token (ROTATE_REFRESH_TOKENS=True),
    // on le stocke avec une nouvelle expiration. Sinon, on conserve l'ancien.
    const newRefreshToken = refreshedTokens.refresh || token.refreshToken;
    const newRefreshExpires = refreshedTokens.refresh
      ? Date.now() + REFRESH_TOKEN_LIFETIME
      : token.refreshTokenExpires;

    return {
      ...token,
      accessToken: refreshedTokens.access,
      accessTokenExpires: Date.now() + ACCESS_TOKEN_LIFETIME,
      refreshToken: newRefreshToken,
      refreshTokenExpires: newRefreshExpires,
      error: undefined,
    };
  } catch (error) {
    // Erreur réseau : retry si possible
    if (retryCount < MAX_REFRESH_RETRIES - 1) {
      console.log(`[Auth] Erreur réseau, retry ${retryCount + 1}/${MAX_REFRESH_RETRIES}...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (retryCount + 1)));
      return refreshAccessTokenInternal(token, retryCount + 1);
    }

    console.error("[Auth] Erreur lors du rafraîchissement après tous les retries:", error);
    return {
      ...token,
      accessToken: undefined,
      accessTokenExpires: 0,
      error: "RefreshAccessTokenError",
    };
  }
}

/**
 * Wrapper avec mutex pour éviter les race conditions lors du refresh.
 */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  return refreshWithMutex(token, refreshAccessTokenInternal);
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
              isStaff: data.user?.is_staff || false,
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
          isStaff: user.isStaff,
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

      // Vérifier si le refresh token est encore valide
      const refreshTokenExpires = token.refreshTokenExpires as number || 0;
      if (now >= refreshTokenExpires) {
        console.log("[Auth] Refresh token expiré, déconnexion nécessaire");
        return {
          ...token,
          accessToken: undefined,
          accessTokenExpires: 0,
          error: "RefreshAccessTokenError",
        };
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
      session.isStaff = token.isStaff as boolean | undefined;

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
