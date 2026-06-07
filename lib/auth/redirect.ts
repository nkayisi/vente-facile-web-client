/**
 * Retourne le chemin de redirection par défaut selon le type d'utilisateur
 * @param isStaff - true si l'utilisateur est un admin de la plateforme
 * @returns "/admin" pour les admins, "/dashboard" pour les utilisateurs normaux
 */
export function getDefaultRedirectPath(isStaff?: boolean): string {
  return isStaff ? "/admin" : "/dashboard";
}
