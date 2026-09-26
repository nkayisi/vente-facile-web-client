import { TARIFS as T } from "@/lib/marketing/content";

/**
 * Repli de <Suspense>. Les hauteurs sont celles des vraies cartes : un
 * squelette plus court que son contenu décale la page à l'arrivée des
 * données, ce qui est exactement ce que le squelette existe pour éviter.
 */
/**
 * ⚠ PAS d'`id="tarifs"` sur la section : `Pricing` le porte. Les deux
 * cohabitent dans la charge utile servie le temps du flux, et deux éléments de
 * même identifiant sont du HTML invalide. Le `<h2>`, lui, RESTE : il évite le
 * décalage de mise en page quand le vrai contenu arrive.
 */
export function PricingSkeleton() {
  return (
    <section className="scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="t-eyebrow text-braise-texte">{T.eyebrow}</p>
        <h2 className="t-h2 mt-5 text-encre">{T.titre}</h2>
        <p className="t-body mt-4 max-w-[46ch] text-encre-faible">{T.accroche}</p>

        <div className="mt-10 h-12 w-[13.5rem] animate-pulse rounded-xl bg-paper-creux" />

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[27rem] animate-pulse rounded-2xl border border-trait bg-paper-creux"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
