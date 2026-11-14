import { auth } from "@/lib/auth";
import { getDefaultRedirectPath } from "@/lib/auth/redirect";
import { CHEMINS_PUBLICS } from "@/lib/seo/pages-publiques";
import { NextResponse } from "next/server";

/**
 * Routes publiques (accessibles sans authentification).
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LA LISTE EST DÉRIVÉE DU REGISTRE, ELLE N'EST PLUS ÉCRITE À LA MAIN.      │
 * │                                                                          │
 * │ `isPublicRoute` compare en ÉGALITÉ EXACTE, et la règle 1 ci-dessous      │
 * │ renvoie vers /auth/login TOUTE route qui n'est pas dans cette liste. Une │
 * │ page publique oubliée ici éjecterait donc vers la connexion tout         │
 * │ visiteur porteur d'un cookie de session périmé. Le défaut ne se voit     │
 * │ qu'avec un tel cookie : jamais pendant le développement, seulement chez  │
 * │ un vrai visiteur revenu des semaines plus tard.                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
const PUBLIC_ROUTES = [
  ...CHEMINS_PUBLICS,
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
];

// Routes d'authentification (rediriger vers dashboard si déjà connecté)
const AUTH_ROUTES = ["/auth/login", "/auth/register"];

/**
 * Routes protégées (nécessitent une authentification).
 *
 * ⚠ Six préfixes MORTS ont été retirés (`/products`, `/sales`, `/customers`,
 * `/settings`, `/stock`, `/reports`) : aucun ne correspond à une route de
 * premier niveau, ces pages vivant toutes sous `/dashboard/`. Ils ne
 * protégeaient rien et laissaient croire le contraire.
 */
const PROTECTED_ROUTE_PREFIXES = ["/dashboard", "/admin", "/payment"];

/**
 * Le changement d'un mot de passe posé par l'administration.
 *
 * ⚠ CE N'EST QU'UN AIGUILLAGE. Le serveur refuse déjà toute route hors du
 * changement lui-même (`password_change_required`) ; sans ce détour, le
 * titulaire arriverait sur un tableau de bord dont chaque bloc afficherait ce
 * refus, sans rien pour le conduire où il doit aller.
 */
const CHANGEMENT_MOT_DE_PASSE = "/auth/nouveau-mot-de-passe";

export default auth((req) => {
  try {
    const { nextUrl } = req;
    const session = req.auth;
    const isLoggedIn = !!session?.user;
    const hasSessionError = session?.error === "RefreshAccessTokenError";
    const hasValidToken = !!session?.accessToken;

    const isPublicRoute = PUBLIC_ROUTES.includes(nextUrl.pathname);
    const isAuthRoute = AUTH_ROUTES.includes(nextUrl.pathname);
    const isProtectedRoute = PROTECTED_ROUTE_PREFIXES.some(prefix =>
      nextUrl.pathname.startsWith(prefix)
    );

  // 1. Session expirée (refresh token invalide) - déconnecter l'utilisateur
  // Ne rediriger que depuis les routes protégées pour éviter une boucle infinie
  if ((hasSessionError || (isLoggedIn && !hasValidToken)) && !isAuthRoute && !isPublicRoute) {
    console.log("[Middleware] Session expirée, redirection vers login");

    const loginUrl = new URL("/auth/login", nextUrl);
    loginUrl.searchParams.set("error", "SessionExpired");
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);

    const response = NextResponse.redirect(loginUrl);

    // Effacer les cookies de session next-auth
    response.cookies.delete("authjs.session-token");
    response.cookies.delete("authjs.callback-url");
    response.cookies.delete("authjs.csrf-token");
    // Pour les cookies sécurisés en production
    response.cookies.delete("__Secure-authjs.session-token");
    response.cookies.delete("__Secure-authjs.callback-url");
    response.cookies.delete("__Secure-authjs.csrf-token");

    return response;
  }

  // 2 bis. Mot de passe posé par l'administration : on le change avant tout.
  const surLeChangement = nextUrl.pathname === CHANGEMENT_MOT_DE_PASSE;
  if (isLoggedIn && hasValidToken && session?.mustChangePassword) {
    if (!surLeChangement && (isProtectedRoute || isAuthRoute)) {
      return NextResponse.redirect(new URL(CHANGEMENT_MOT_DE_PASSE, nextUrl));
    }
  } else if (surLeChangement) {
    // Rien à changer : la page n'a plus d'objet, ni pour un visiteur anonyme.
    const cible = isLoggedIn && hasValidToken ? getDefaultRedirectPath(session?.isStaff) : "/auth/login";
    return NextResponse.redirect(new URL(cible, nextUrl));
  }

  // 2. Utilisateur connecté essaie d'accéder aux pages d'auth
  if (isLoggedIn && hasValidToken && isAuthRoute) {
    const redirectPath = getDefaultRedirectPath(session?.isStaff);
    console.log(`[Middleware] Utilisateur connecté, redirection vers ${redirectPath}`);
    return NextResponse.redirect(new URL(redirectPath, nextUrl));
  }

  // 3. Utilisateur non connecté essaie d'accéder à une route protégée
  if (!isLoggedIn && isProtectedRoute) {
    console.log("[Middleware] Accès non autorisé, redirection vers login");
    const callbackUrl = nextUrl.pathname + nextUrl.search;
    const loginUrl = new URL("/auth/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(loginUrl);
  }

    return NextResponse.next();
  } catch (error) {
    // Fail-open : une erreur inattendue dans le middleware ne doit pas produire
    // un 500 (page cassée/blanche). On laisse passer la requête ; les gardes
    // côté client (OrganizationChecker, SessionMonitor) prennent le relais.
    console.error("[Middleware] Erreur inattendue, passage en fail-open:", error);
    return NextResponse.next();
  }
});

// Configuration du matcher pour spécifier les routes à protéger
export const config = {
  matcher: [
    /*
     * Tout, sauf :
     * - api, _next/static, _next/image
     * - les fichiers de convention des métadonnées : opengraph-image,
     *   apple-icon, icon
     * - toute URL portant une extension d'actif
     *
     * ⚠ `.txt`, `.xml` et `.webmanifest` sont NOUVEAUX dans cette liste.
     * Sans eux, chaque lecture de /robots.txt ou /sitemap.xml par un robot
     * faisait décoder un jeton next-auth pour rien. `.ico` remplace au passage
     * la mention nominative de favicon.ico.
     */
    "/((?!api|_next/static|_next/image|opengraph-image|apple-icon|icon|.*\\.(?:png|jpg|jpeg|gif|svg|ico|txt|xml|webmanifest)$).*)",
  ],
};
