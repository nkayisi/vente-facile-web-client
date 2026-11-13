/**
 * Les petites écritures de l'administration : un montant AVEC sa devise, un
 * pourcentage, une date relative.
 *
 * ⚠ `formatPrice` attend un SYMBOLE, pas un code : lui passer « USD » écrirait
 * « 10 USD » là où le reste du produit écrit « 10 $ ».
 */
import { formatNumber, formatPrice, getCurrencySymbol } from "@vente-facile/core";

export function montant(valeur: string | number | null | undefined, code: string | null | undefined): string {
  const n = typeof valeur === "string" ? parseFloat(valeur) : valeur ?? 0;
  const symbole = code ? getCurrencySymbol(code) || code : "";
  return formatPrice(Number.isFinite(n) ? n : 0, symbole);
}

/** « 12,5 % », ou un tiret quand la valeur est inconnue - jamais « 0 % » à la place. */
export function pourcentage(valeur: string | number | null | undefined): string {
  if (valeur === null || valeur === undefined || valeur === "") return "-";
  const n = typeof valeur === "string" ? parseFloat(valeur) : valeur;
  if (!Number.isFinite(n)) return "-";
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

export function nombre(valeur: number | null | undefined): string {
  return formatNumber(valeur ?? 0);
}

/**
 * Un nombre et son nom, accordé. En français, zéro et un sont au singulier.
 * ⚠ Jamais « établissement(s) » : la parenthèse dit qu'on n'a pas su accorder.
 */
export function compte(n: number | null | undefined, singulier: string, pluriel: string): string {
  const v = n ?? 0;
  return `${nombre(v)} ${Math.abs(v) > 1 ? pluriel : singulier}`;
}

export function dateCourte(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateHeure(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** « il y a 3 h », pour une attente ou un dernier passage. */
export function depuis(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 48) return `${heures} h`;
  return `${Math.floor(heures / 24)} j`;
}

/**
 * La couleur du « reste » d'un abonnement : échu en rouge, cinq jours ou moins
 * en ambre. ⚠ L'échu se teste EN PREMIER : tester « ≤ 5 » d'abord rangeait un
 * abonnement échu parmi les avertissements, et le rouge ne s'affichait jamais.
 */
export function tonEcheance(joursRestants: number): string {
  if (joursRestants <= 0) return "text-destructive";
  if (joursRestants <= 5) return "text-warning";
  return "";
}

/**
 * Pourquoi on ne peut PAS prendre la main sur un compte, ou `null` si on le
 * peut. Un compte fermé n'a rien à montrer ; un administrateur ne se fait pas
 * prendre la main (le serveur le refuse aussi).
 */
export function raisonSansPriseEnMain(
  compteActif: boolean,
  administrateur: boolean,
  inactif = "Compte inactif",
): string | null {
  if (!compteActif) return inactif;
  if (administrateur) return "Administrateur de la plateforme : on ne prend pas sa main";
  return null;
}
