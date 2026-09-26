import { ImageResponse } from "next/og";

/**
 * La vignette de partage, 1200 x 630, dessinée par le code.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ `twitter:card` ANNONÇAIT `summary_large_image` SANS AUCUNE IMAGE.         │
 * │                                                                          │
 * │ Chaque lien partagé sur WhatsApp, Facebook ou LinkedIn sortait donc nu.   │
 * │ En RDC, WhatsApp EST le canal du commerce : c'est le défaut de            │
 * │ référencement au plus fort effet immédiat, et il ne coûte qu'un fichier.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ AUCUNE POLICE PERSONNALISÉE, et c'est un choix. Charger une face demande de
 * lire un `.ttf` au moment du rendu ; si la lecture échoue, la vignette échoue,
 * donc le partage redevient nu. La police par défaut de `next/og` couvre les
 * accents français et ne peut pas manquer. Une vignette sobre qui s'affiche vaut
 * mieux qu'une belle qui tombe.
 *
 * ⚠ Ni Tailwind ni les jetons CSS ici : `next/og` rend hors du navigateur, il
 * n'a pas de feuille de style. Les couleurs sont donc les valeurs littérales de
 * `globals.css`, recopiées, et c'est le seul endroit du dépôt où c'est permis.
 */

const PAPIER = "#fbfaf8";
const ENCRE = "#1c1815";
const ENCRE_FAIBLE = "#6e635a";
const BRAISE = "#ea580c";
const BRAISE_TEXTE = "#c2410c";

export const TAILLE_VIGNETTE = { width: 1200, height: 630 };
export const TYPE_VIGNETTE = "image/png";

/**
 * Retire le préfixe de marque d'un titre de page.
 *
 * La vignette porte déjà « VENTE FACILE » en sur-titre : laisser le titre de
 * l'accueil tel quel (« Vente Facile · La caisse qui... ») y écrirait la marque
 * deux fois, le défaut que le gabarit de titre a déjà coûté une fois.
 */
export function titrePourVignette(titre: string): string {
  return titre.replace(/^Vente Facile\s*·\s*/, "");
}

/**
 * Raccourcit une description pour la vignette, sur une frontière de mot.
 *
 * Les descriptions du registre visent le résultat de recherche, où Google en
 * affiche environ cent soixante signes. Sur une vignette, la même longueur
 * déborderait du cadre : ce qui dépasse n'est pas rogné par le rendu, il
 * repousse le pied hors de l'image.
 */
export function accrochePourVignette(texte: string, max = 118): string {
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, max);
  const espace = coupe.lastIndexOf(" ");
  const garde = espace > 0 ? coupe.slice(0, espace) : coupe;

  // ⚠ On retire la ponctuation de fin AVANT d'ajouter les points de suspension :
  // une coupe qui tombe après un point rendait « Mobile Money.... », quatre
  // points d'affilée sur la vignette que tout le monde voit en premier.
  return `${garde.replace(/[.,;:\s]+$/, "")}...`;
}

export function vignetteSociale({
  titre,
  accroche,
}: {
  titre: string;
  accroche: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: PAPIER,
        }}
      >
        {/* Le filet de marque : c'est ce qui rend la vignette reconnaissable
            dans un fil de conversation, avant même qu'on la lise. */}
        <div style={{ height: 14, width: "100%", backgroundColor: BRAISE }} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flexGrow: 1,
            padding: "0 88px",
          }}
        >
          <div
            style={{
              fontSize: 26,
              letterSpacing: 6,
              color: BRAISE_TEXTE,
              marginBottom: 34,
            }}
          >
            VENTE FACILE
          </div>

          <div
            style={{
              fontSize: 68,
              lineHeight: 1.12,
              fontWeight: 700,
              color: ENCRE,
              maxWidth: 980,
            }}
          >
            {titre}
          </div>

          <div
            style={{
              fontSize: 31,
              lineHeight: 1.4,
              color: ENCRE_FAIBLE,
              marginTop: 32,
              maxWidth: 940,
            }}
          >
            {accroche}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            padding: "0 88px 54px",
            fontSize: 25,
            color: ENCRE_FAIBLE,
          }}
        >
          vente-facile.net
        </div>
      </div>
    ),
    TAILLE_VIGNETTE,
  );
}
