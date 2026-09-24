import { cn } from "@/lib/utils";

/**
 * Le ticket, au VRAI format du produit : 32 colonnes, casse haute, sans
 * accent.
 *
 * Ce ne sont pas des choix esthétiques. 32 colonnes est la valeur retenue pour
 * le 58 mm en police A dans `mobile/vf-marchand/src/printing/render-text.ts` ;
 * la désaccentuation vient de ce que l'API de l'imprimante intégrée ne porte
 * pas de page de code latine. Rendre le ticket autrement ferait dire à la page
 * quelque chose que le papier du marchand ne dit pas.
 *
 * La largeur est en `ch` : dans une chasse fixe, 32ch EST la largeur du
 * papier. Une valeur en pixels se décalerait au premier changement de corps.
 */

const COLONNES = 32;

/** Un couple libellé / montant, aligné sur les deux bords. C'est `paire()` du
 *  moteur d'impression : quand ça ne tient pas, c'est le LIBELLÉ qui cède,
 *  jamais le montant. Un montant tronqué est un faux montant. */
function paire(libelle: string, montant: string): string {
  const place = COLONNES - montant.length - 1;
  const gauche = libelle.length > place ? libelle.slice(0, place) : libelle;
  return gauche + " ".repeat(COLONNES - gauche.length - montant.length) + montant;
}

function centre(texte: string): string {
  const marge = Math.max(0, Math.floor((COLONNES - texte.length) / 2));
  return " ".repeat(marge) + texte;
}

const FILET = "-".repeat(COLONNES);

export type LigneTicket =
  | { type: "texte"; contenu: string }
  | { type: "bandeau"; contenu: string }
  | { type: "filet" }
  | { type: "fort"; contenu: string };

export const TICKET_DEMO: LigneTicket[] = [
  { type: "texte", contenu: centre("ALIMENTATION NGOMA") },
  { type: "filet" },
  { type: "bandeau", contenu: centre("RECU DE VENTE") },
  { type: "texte", contenu: "VT-20260920-K7QM-0004" },
  { type: "texte", contenu: "20/09/2026  14:07" },
  { type: "filet" },
  { type: "texte", contenu: "BOISSON 24 CL" },
  { type: "texte", contenu: paire("1 CASIER x 62 000", "62 000") },
  { type: "texte", contenu: "SAVON DE MENAGE" },
  { type: "texte", contenu: paire("12 PIECES x 1 500", "18 000") },
  { type: "filet" },
  { type: "fort", contenu: paire("TOTAL", "80 000 FC") },
  { type: "texte", contenu: paire("ESPECES", "100 000 FC") },
  { type: "texte", contenu: paire("RENDU", "20 000 FC") },
  { type: "filet" },
  { type: "texte", contenu: centre("MERCI ET A BIENTOT") },
];

export function LigneRendue({ ligne }: { ligne: LigneTicket }) {
  if (ligne.type === "filet") {
    return <span className="block whitespace-pre text-encre-ombre">{FILET}</span>;
  }
  if (ligne.type === "bandeau") {
    // Vidéo inversée : c'est ainsi que le produit distingue un reçu de vente
    // d'un reçu de règlement dans une liasse.
    return (
      <span className="my-1 block whitespace-pre bg-encre font-semibold text-paper">
        {ligne.contenu}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "block whitespace-pre",
        ligne.type === "fort" ? "font-semibold text-encre" : "text-encre"
      )}
    >
      {ligne.contenu}
    </span>
  );
}

export { COLONNES };
