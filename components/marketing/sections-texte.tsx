import { Reveal } from "./reveal";

/**
 * Une suite de sections de texte : titre, puis paragraphes.
 *
 * Partagée par les mentions légales et la politique de confidentialité. Deux
 * pages du même registre rendues par deux mises en page différentes donneraient
 * l'impression que l'une des deux a été bâclée.
 *
 * ⚠ Colonne étroite (`max-w-[68ch]`) et non pleine largeur : ces pages se LISENT
 * de bout en bout, à la différence d'une page produit qu'on balaie. Au-delà de
 * soixante-dix caractères, l'oeil perd le début de la ligne suivante.
 */
export function SectionsTexte({
  sections,
}: {
  sections: readonly { readonly titre: string; readonly corps: readonly string[] }[];
}) {
  return (
    <div className="space-y-12">
      {sections.map((section) => (
        <Reveal as="section" key={section.titre}>
          <h2 className="t-h3 text-encre">{section.titre}</h2>
          <div className="mt-4 space-y-4">
            {section.corps.map((paragraphe) => (
              <p key={paragraphe} className="t-body text-encre-faible">
                {paragraphe}
              </p>
            ))}
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/**
 * L'enveloppe d'un document légal : colonne de lecture, et la date de mise à
 * jour en tête.
 *
 * ⚠ La date est en TÊTE, pas en pied. C'est la première chose qu'on vérifie sur
 * un document de ce genre, et la chercher en bas d'une page longue est un
 * défaut d'usage, pas un détail.
 */
export function DocumentLegal({
  majLe,
  children,
}: {
  majLe: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-5 pb-20 pt-6 sm:px-8 sm:pb-28 sm:pt-8">
      {/* ⚠ UN SEUL BORD GAUCHE. Le conteneur reprend `max-w-6xl`, celui de
          l'en-tête de page, et c'est la colonne de LECTURE qui est bornée à
          l'intérieur. Centrer directement une colonne étroite faisait démarrer
          le texte deux cent trente points à droite du titre : l'oeil lit alors
          un bord en escalier, sans savoir le nommer. */}
      <div className="mx-auto max-w-6xl">
        <div className="max-w-[68ch]">
        <p className="t-data text-[0.8125rem] text-encre-ombre">
          Dernière mise à jour : {majLe}
        </p>
          <div className="mt-10">{children}</div>
        </div>
      </div>
    </section>
  );
}
