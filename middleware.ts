import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Routes publiques (accessibles sans authentification)
const PUBLIC_ROUTES = ["/", "/auth/login", "/auth/register", "/auth/forgot-password"];

// Routes d'authentification (rediriger vers dashboard si déjà connecté)
const AUTH_ROUTES = ["/auth/login", "/auth/register"];

// Routes protégées (nécessitent une authentification)
const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/admin",
  "/products",
  "/sales",
  "/customers",
  "/settings",
  "/stock",
  "/reports",
];

export default auth((req) => {
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

  // 2. Utilisateur connecté essaie d'accéder aux pages d'auth
  if (isLoggedIn && hasValidToken && isAuthRoute) {
    console.log("[Middleware] Utilisateur connecté, redirection vers dashboard");
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
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
});

// Configuration du matcher pour spécifier les routes à protéger
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$).*)",
  ],
};
