"use client";

import { cn } from "@/lib/utils";

interface StatValueProps {
  value: string;
  className?: string;
  color?: string;
}

/**
 * Échelle de repli d'une valeur de statistique, du plus grand au plus petit.
 *
 * Un montant s'écrit toujours en ENTIER : « 2 330 813,36 FC », jamais
 * « 2,33 M FC ». Les commerçants qui utilisent la plateforme ne pratiquent pas
 * forcément l'écriture abrégée, et un chiffre qu'on ne sait pas lire ne
 * renseigne pas. Quand la place manque, c'est donc la taille du texte qui cède.
 *
 * Les seuils sont calés sur la largeur réelle des cartes du tableau de bord
 * (environ 150 px utiles à six colonnes) et sur la chasse d'un chiffre en
 * `tabular-nums`, voisine de 0,6 em : un montant de quatorze caractères occupe
 * à peu près 8,4 em, soit 151 px à 18 px de corps.
 */
const SIZE_STEPS: { maxLength: number; className: string }[] = [
  // Les valeurs courtes (« 6 », « 888 ») gardent leur corps à toute largeur.
  { maxLength: 10, className: "text-2xl" },
  { maxLength: 13, className: "text-xl" },
  // À partir d'ici la valeur est longue : elle démarre un cran plus bas sur
  // écran étroit, où la carte n'a plus la largeur de l'accueillir. Un palier
  // fondé sur la seule longueur ne sait rien du conteneur ; ce repli
  // responsive est ce qui évite le rognage dans les cas les plus serrés.
  { maxLength: 16, className: "text-base md:text-lg" },
  { maxLength: 20, className: "text-sm md:text-base" },
  { maxLength: 26, className: "text-xs md:text-sm" },
  { maxLength: Infinity, className: "text-xs" },
];

export function statValueSize(value: string): string {
  return (
    SIZE_STEPS.find(step => value.length <= step.maxLength)?.className ?? "text-xs"
  );
}

/**
 * Valeur d'une carte de statistique, affichée en entier.
 *
 * `truncate` reste posé en tout dernier recours, pour un libellé exotique que
 * même le plus petit palier ne ferait pas tenir ; sur un montant, l'échelle
 * ci-dessus s'en charge avant. Le `title` porte la valeur complète dans tous
 * les cas, de sorte qu'un survol la restitue si elle venait à être coupée.
 */
export function StatValue({ value, className, color }: StatValueProps) {
  return (
    <div
      className={cn(
        // `text-base` figurait ici après la classe de taille : twMerge gardant
        // la dernière classe d'un même groupe, toute la réduction progressive
        // était annulée et chaque montant s'affichait en petit.
        "font-bold truncate tabular-nums",
        statValueSize(value),
        color,
        className
      )}
      title={value}
    >
      {value}
    </div>
  );
}
