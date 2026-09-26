import { pagePubliqueDe } from "@/lib/seo/pages-publiques";
import {
  accrochePourVignette,
  TAILLE_VIGNETTE,
  TYPE_VIGNETTE,
  titrePourVignette,
  vignetteSociale,
} from "@/lib/seo/vignette";

const page = pagePubliqueDe("/caisse-hors-ligne");

export const size = TAILLE_VIGNETTE;
export const contentType = TYPE_VIGNETTE;
export const alt = page.titre;

export default function Image() {
  return vignetteSociale({
    titre: titrePourVignette(page.titre),
    accroche: accrochePourVignette(page.description),
  });
}
