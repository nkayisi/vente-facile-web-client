import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { refreshWithMutex } from "./refresh-mutex";
import { enTetesDeBordure } from "@/lib/api/bordure";
import { PREFIXE_VERROU } from "./codes-connexion";

function resolveApiBaseUrl(): string {
  // next-auth s'execute cote serveur : prefere l'URL interne Docker
  // (conteneur→conteneur) si definie, sinon l'URL publique (dev hors Docker).
  const url = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;
  if (url && url.length > 0) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_API_URL is required in production (frontend/lib/auth/config.ts)",
    );
  }
  return "http://127.0.0.1:8005/api/v1";
}

const API_BASE_URL = resolveApiBaseUrl();
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

/**
 * Un jeton porte-t-il la revendication `imp` ? Lu sans vérifier la signature :
 * c'est le serveur qui la vérifie à chaque requête. Ce contrôle n'empêche qu'une
 * chose, qu'un jeton ordinaire soit rangé comme une prise en main.
 */
function estJetonDePriseEnMain(jeton: unknown): jeton is string {
  if (typeof jeton !== "string") return false;
  const corps = jeton.split(".")[1];
  if (!corps) return false;
  try {
    // `atob` et non `Buffer` : ce module est aussi chargé par le middleware, qui
    // peut tourner hors de Node. Les revendications lues ici sont en ASCII.
    const json = JSON.parse(atob(corps.replace(/-/g, "+").replace(/_/g, "/")));
    return json?.imp === true;
  } catch {
    return false;
  }
}

/**
 * Ramène la session à l'administrateur, depuis les jetons mis de côté.
 *
 * ⚠ Par un RAFRAÎCHISSEMENT, pas en reposant l'ancien jeton d'accès : il a pu
 * échoir pendant la prise en main. Un échec ici déconnecte (`RefreshAccessTokenError`),
 * ce qui est le bon côté de l'erreur : mieux vaut se reconnecter que rester dans
 * la peau d'un marchand.
 */
async function restaurerAdministrateur(token: JWT): Promise<JWT> {
  const stash = token.adminStash;
  const base: JWT = {
    ...token,
    impersonation: undefined,
    adminStash: undefined,
    name: stash ? stash.name : token.name,
    email: stash ? stash.email : token.email,
    isStaff: true,
    refreshToken: stash?.refreshToken,
    refreshTokenExpires: stash?.refreshTokenExpires,
    accessToken: stash?.accessToken,
    accessTokenExpires: 0,
  };
  if (!stash?.refreshToken) {
    return { ...base, accessToken: undefined, error: "RefreshAccessTokenError" };
  }
  return refreshAccessToken(base);
}

/**
 * Pourquoi la connexion a échoué, et surtout : la faute est-elle celle du
 * marchand ?
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ `authorize` RENDAIT `null` POUR TOUT, DONC LA PAGE DISAIT TOUJOURS       │
 * │ « Email ou mot de passe incorrect ».                                     │
 * │                                                                          │
 * │ Un backend arrêté, un 500, une route absente derrière le proxy : les     │
 * │ trois se présentaient au marchand comme un mot de passe erroné. Il       │
 * │ retapait son mot de passe, le changeait, appelait le support - et le     │
 * │ serveur, lui, était simplement à terre. Mesuré pendant la panne du       │
 * │ 9 novembre 2026 : la migration de la cagnotte échouait, `entrypoint.sh`  │
 * │ est en `set -e`, donc Gunicorn ne démarrait pas, et l'écran de connexion │
 * │ accusait les identifiants de chaque marchand.                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LE `code` VOYAGE DANS L'URL, donc il ne nomme JAMAIS la cause précise :
 *   `@auth/core` le dit dans sa propre docstring, et on ne veut pas publier
 *   « base de données injoignable » dans une barre d'adresse. Trois valeurs
 *   suffisent, parce que trois GESTES suffisent : corriger sa saisie, attendre,
 *   ou prévenir l'exploitant.
 *
 * ⚠ LE CAS DES IDENTIFIANTS GARDE SON `return null`, donc son `code` par
 *   défaut (`credentials`) : rien ne change pour le chemin de loin le plus
 *   fréquent, et c'est ce qui rend ce lot sûr à déployer pendant une panne.
 */
class ServiceIndisponible extends CredentialsSignin {
  code = "service_indisponible";
}

class TropDeTentatives extends CredentialsSignin {
  code = "trop_de_tentatives";
}

/**
 * Le verrou de connexion (cinq échecs, quinze minutes) : le `code` porte les
 * minutes à attendre, lu par la page de connexion (`lib/auth/codes-connexion.ts`).
 */
class ConnexionVerrouillee extends CredentialsSignin {
  constructor(minutes: number) {
    super();
    this.code = `${PREFIXE_VERROU}${minutes}`;
  }
}

/** Le verrou se distingue de la limite de débit par le `code` du corps. */
async function refusDeTrop(response: Response): Promise<CredentialsSignin> {
  const corps = (await response.json().catch(() => null)) as { code?: string; retry_after?: number } | null;
  if (corps?.code === "login_locked" && typeof corps.retry_after === "number") {
    return new ConnexionVerrouillee(Math.max(1, Math.ceil(corps.retry_after / 60)));
  }
  return new TropDeTentatives();
}

/**
 * Un statut qui ne peut PAS vouloir dire « mot de passe erroné ».
 *
 * ⚠ LE 404 EN FAIT PARTIE, et c'est contre-intuitif. Un proxy inverse qui n'a
 *   plus de route vers l'API répond 404 sur TOUS les chemins - c'est ce que
 *   `backend.vente-facile.net` a rendu pendant la panne, sur `/` comme sur
 *   `/auth/token/`. Un 404 sur l'endpoint de jeton est une faute de
 *   déploiement, jamais une faute de saisie.
 */
function estUnePanne(statut: number): boolean {
  return statut >= 500 || statut === 404;
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
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          console.log("[Auth] Identifiants manquants");
          return null;
        }

        try {
          // ⚠ Jamais l'adresse e-mail dans le journal : chaque tentative de
          //   chaque marchand y finissait, en production.
          const response = await fetch(`${API_BASE_URL}/auth/token/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // L'adresse du navigateur : sans elle, le verrouillage et les
              // limites de débit compteraient toutes les connexions ensemble.
              ...(await enTetesDeBordure(request?.headers)),
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!response.ok) {
            console.log("[Auth] Échec de connexion:", response.status);
            // ⚠ 429 : le backend throttle les tentatives anonymes en
            //   production. Dire « mot de passe incorrect » à quelqu'un qui est
            //   limité le fait réessayer, donc rester limité.
            if (response.status === 429) throw await refusDeTrop(response);
            if (estUnePanne(response.status)) throw new ServiceIndisponible();
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
          // ⚠ ON NE RAVALE PAS NOS PROPRES VERDICTS. Sans ce relais, le `throw`
          //   posé juste au-dessus retomberait ici et redeviendrait un `null`,
          //   c'est-à-dire le défaut qu'on referme.
          if (error instanceof CredentialsSignin) throw error;
          // Tout ce qui reste est un échec de TRANSPORT : `fetch` ne lève que
          // pour ça (DNS, connexion refusée, délai dépassé). Le serveur est
          // injoignable, le mot de passe n'a jamais été examiné.
          throw new ServiceIndisponible();
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
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

      // ── Prise en main : ENTRÉE ────────────────────────────────────────────
      // Le jeton vient du serveur (`/platform-admin/users/{id}/impersonate/`).
      // ⚠ Refusée si la session n'est pas celle d'un administrateur, ou si une
      // prise en main est déjà en cours : on ne met pas de côté un jeton de
      // marchand, on ne s'en remettrait jamais.
      const demande = session as
        | { impersonation?: { access?: string; expires_at?: string; session_id?: string;
            target_user?: { email?: string; full_name?: string };
            organization?: { id?: string; name?: string } };
            endImpersonation?: boolean }
        | undefined;
      if (trigger === "update" && demande?.impersonation) {
        const imp = demande.impersonation;
        if (token.impersonation || !token.isStaff || !token.refreshToken || !estJetonDePriseEnMain(imp.access)) {
          return token;
        }
        const echeance = Date.parse(imp.expires_at ?? "") || Date.now() + 20 * 60 * 1000;
        return {
          ...token,
          adminStash: {
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            accessTokenExpires: token.accessTokenExpires,
            refreshTokenExpires: token.refreshTokenExpires,
            name: token.name,
            email: token.email,
          },
          // ⚠ Le NOM suit la prise en main : l'en-tête du tableau de bord lit
          // `session.user.name`, et voir l'application « comme Caissier One »
          // sous le nom de l'administrateur fait douter de ce qu'on regarde.
          name: imp.target_user?.full_name || imp.target_user?.email || token.name,
          email: imp.target_user?.email || token.email,
          accessToken: imp.access,
          // ⚠ AUCUN jeton de rafraîchissement : la prise en main ne se prolonge pas.
          refreshToken: undefined,
          accessTokenExpires: echeance,
          refreshTokenExpires: echeance,
          isStaff: false,
          impersonation: {
            sessionId: imp.session_id ?? "",
            expiresAt: echeance,
            targetEmail: imp.target_user?.email ?? "",
            targetName: imp.target_user?.full_name ?? "",
            organizationId: imp.organization?.id ?? "",
            organizationName: imp.organization?.name ?? "",
          },
          error: undefined,
        };
      }

      // ── Prise en main : SORTIE ────────────────────────────────────────────
      // Demandée, ou imposée par l'échéance : un jeton de prise en main ne se
      // rafraîchit pas, et tenter de le faire déconnecterait l'administrateur.
      if (token.impersonation) {
        const echu = Date.now() >= (token.accessTokenExpires as number || 0) - REFRESH_BUFFER;
        if ((trigger === "update" && demande?.endImpersonation) || echu) {
          return restaurerAdministrateur(token);
        }
        return token;
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
      // Exposé au client pour que SessionMonitor programme son refresh
      // proactif sur la vraie échéance (sinon il retombe sur une estimation
      // et le refresh proactif ne tombe jamais au bon moment). Ce n'est
      // qu'un horodatage, aucun secret.
      session.accessTokenExpires = token.accessTokenExpires as number | undefined;
      session.error = token.error as string | undefined;
      session.isStaff = token.isStaff as boolean | undefined;
      // ⚠ L'information seulement, jamais `adminStash` : les jetons de
      // l'administrateur restent dans le cookie chiffré.
      session.impersonation = token.impersonation;

      if (session.user && token.email) {
        session.user.email = token.email as string;
      }

      return session;
    },

    async authorized({ auth, request }) {
      // Toujours retourner true ici - le middleware custom gère
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
  // Verrouillage explicite du cookie de session : sameSite=lax suffit pour
  // tolérer les redirections OAuth/checkout entrantes (Moko revient sur le
  // domaine via GET), mais bloque la fuite via formulaire cross-site
  // (POST CSRF). secure=true en prod uniquement (les cookies HTTPS-only
  // bloqueraient un dev local sur http://localhost).
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  trustHost: true,
};
