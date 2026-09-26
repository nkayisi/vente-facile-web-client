/**
 * Un bloc JSON-LD, rendu côté serveur.
 *
 * ⚠ LE CHEVRON OUVRANT EST ÉCHAPPÉ EN SA SÉQUENCE UNICODE, et ce n'est pas une
 * précaution de style. `JSON.stringify` laisse passer les chevrons tels quels :
 * une chaîne de contenu qui porterait une balise fermante de script fermerait la
 * vraie, et le reste du JSON serait interprété comme du HTML. Le contenu vient
 * aujourd'hui de nos propres constantes typées, mais le jour où un texte viendra
 * du backend, la protection sera déjà là.
 */
function serialiser(donnees: unknown): string {
  return JSON.stringify(donnees).replace(/</g, "\\u003c");
}

export function DonneesStructurees({ donnees }: { donnees: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialiser(donnees) }}
    />
  );
}
