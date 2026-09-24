import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Révélation au défilement, EN CSS PUR. Aucun JavaScript, aucune frontière
 * client : les sept sections qui l'emploient restent des composants serveur.
 *
 * ⚠ LA PREMIÈRE VERSION ÉTAIT DANGEREUSE, et c'est une capture pleine page qui
 * l'a montré. Elle posait `opacity: 0` puis attendait un `whileInView` de
 * framer-motion : tant que l'observateur n'avait pas parlé, TOUTE la page sous
 * le hero était invisible. Hydratation lente, JavaScript en échec, 2G
 * congolaise qui coupe au mauvais moment, et le marchand lit une page vide
 * sans qu'aucune erreur ne s'affiche. Un contenu ne doit jamais dépendre d'un
 * script pour EXISTER.
 *
 * Ici l'élément est visible par défaut. L'animation n'est ajoutée que si le
 * navigateur sait la piloter au défilement (`animation-timeline: view()`) :
 * Chrome et Safari l'animent, Firefox l'affiche simplement. Le pire cas est
 * « pas d'animation », jamais « pas de contenu ».
 *
 * Effet de bord heureux : le décalage entre éléments d'une grille vient de
 * leur POSITION et non d'un délai codé en dur. Une rangée entre ensemble, la
 * suivante un peu après, parce qu'elle est plus bas. C'est un décalage vrai.
 */
export function Reveal({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  return <Tag className={cn("reveal", className)}>{children}</Tag>;
}
