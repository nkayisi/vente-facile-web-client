/**
 * Afficher un prix de catalogue dans une AUTRE devise, au taux en vigueur.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ T10 DU RETOUR DE TEST : « convertir les produits selon le taux ».       │
 * │                                                                          │
 * │ Un marchand dont le catalogue est tenu en dollars doit pouvoir annoncer  │
 * │ un prix en francs à son client, sans calculer de tête.                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ COPIE TENUE À LA MAIN du jumeau mobile,
 * `mobile/vf-marchand/src/features/pos/affichage-devise.ts`.
 *
 * Son domicile serait `@vente-facile/core`, où ce dépôt range ce que les deux
 * surfaces doivent appliquer à l'identique ; l'y mettre demande de publier un
 * tag du paquet et de bumper les deux consommateurs, ce qui n'est pas fait.
 * C'est la même réserve que `lib/stock/lignes-conditionnees.ts`, et elle a le
 * même coût : le back-office n'a AUCUN lanceur de tests, donc seule la lecture
 * garde cette copie honnête. Les cas de référence sont ceux du mobile, et ils
 * sont exécutables :
 *
 *   cd mobile/vf-marchand && pnpm jest affichage-devise
 *
 * ⚠ C'EST UN AFFICHAGE, PAS UNE DEVISE PAR PRODUIT. Le catalogue n'a aucune
 * colonne de devise, et toute l'arithmétique de marge repose sur la convention
 * « le coût est déjà en devise principale ». Rien n'est additionné ici : on
 * convertit UN prix pour le montrer, et la facture reste en principale.
 */
import type { MoneyHelpers } from "@vente-facile/core";

/** La clé du réglage, propre au NAVIGATEUR : c'est un confort de comptoir. */
export const CLE_DEVISE_AFFICHAGE = "vf.pos.devise_affichage";

export interface PrixAffiche {
  /** Le prix tel qu'il sera FACTURÉ, en devise principale. Toujours là. */
  facture: string;
  /** La conversion, quand une autre devise est choisie. `null` sinon. */
  converti: string | null;
  /** La parité employée : « 1 USD = 2 300 FC ». `null` sans conversion. */
  parite: string | null;
}

/** La principale EN TÊTE : c'est la devise de facturation, donc le défaut. */
export function devisesAffichables(money: MoneyHelpers): string[] {
  const autres = money.currencies
    .map((c) => c.currency_code)
    .filter((c) => c && c !== money.primaryCode);
  return [money.primaryCode, ...[...new Set(autres)].sort()];
}

/**
 * ⚠ UNE DEVISE INCONNUE NE CONVERTIT RIEN. `rateOf` rend 1 pour une devise
 * qu'elle ne connaît pas : convertir quand même afficherait le même nombre
 * sous un autre symbole, c'est-à-dire un prix faux présenté comme exact.
 */
export function prixAffiche(
  prix: number,
  deviseAffichage: string | null,
  money: MoneyHelpers
): PrixAffiche {
  const facture = money.money(prix, money.primaryCode);
  const cible = deviseAffichage?.trim();

  if (!cible || cible === money.primaryCode) {
    return { facture, converti: null, parite: null };
  }
  if (!money.currencies.some((c) => c.currency_code === cible)) {
    return { facture, converti: null, parite: null };
  }

  return {
    facture,
    converti: money.money(money.convMoney(prix, money.primaryCode, cible), cible),
    parite: money.rateLabel(money.primaryCode, cible),
  };
}

/** Un réglage qui désigne une devise retirée depuis retombe sur la principale. */
export function deviseAffichageValide(
  choisie: string | null | undefined,
  money: MoneyHelpers
): string {
  const c = choisie?.trim();
  return c && devisesAffichables(money).includes(c) ? c : money.primaryCode;
}
