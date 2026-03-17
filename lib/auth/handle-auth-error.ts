import { signOut } from "next-auth/react";

/**
 * Gère les erreurs d'authentification et déconnecte automatiquement l'utilisateur
 * si l'erreur indique que l'utilisateur n'existe pas.
 */
export async function handleAuthError(errorCode?: string, errorMessage?: string): Promise<boolean> {
  if (errorCode === 'user_not_found') {
    console.warn("User not found, signing out...");
    await signOut({ callbackUrl: '/auth/login' });
    return true; // Indique qu'une déconnexion a été effectuée
  }
  
  return false; // Pas de déconnexion
}
