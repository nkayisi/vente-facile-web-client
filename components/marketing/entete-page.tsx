import { FilAriane } from "./fil-ariane";

/**
 * L'en-tête d'une sous-page publique : fil d'Ariane, sur-titre, H1, accroche.
 *
 * ⚠ PEU D'ESPACE EN BAS : la section qui suit apporte déjà son propre `py`.
 * Cumulés, les deux laissaient deux cents points de vide sous l'accroche, qui se
 * lisent comme un bloc manquant plutôt que comme de l'air.
 *
 * ⚠ `pt-28 sm:pt-36` reprend exactement le hero de l'accueil. L'en-tête du site
 * est en `fixed` : une valeur plus courte ferait passer le fil d'Ariane DESSOUS
 * la barre, où il devient illisible sans qu'on sache pourquoi.
 */
export function EntetePage({
  chemin,
  eyebrow,
  titre,
  accroche,
}: {
  chemin: string;
  eyebrow: string;
  titre: string;
  accroche: string;
}) {
  return (
    <section className="px-5 pb-4 pt-28 sm:px-8 sm:pb-6 sm:pt-36">
      <div className="mx-auto max-w-6xl">
        <FilAriane chemin={chemin} />
        <p className="t-eyebrow mt-8 text-braise-texte">{eyebrow}</p>
        <h1 className="t-display mt-5 max-w-[20ch] text-encre">{titre}</h1>
        <p className="t-lead mt-6 max-w-[54ch] text-encre-faible">{accroche}</p>
      </div>
    </section>
  );
}
