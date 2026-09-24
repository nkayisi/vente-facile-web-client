import { CAPACITES as C } from "@/lib/marketing/content";
import { Reveal } from "./reveal";

/**
 * Une LISTE DENSE, et pas six cartes spacieuses avec une icône chacune.
 *
 * Ce que cette section doit communiquer est l'ÉTENDUE. Huit cartes aérées
 * disent « voici huit choses » ; une liste serrée dit « il y en a beaucoup, et
 * elles sont toutes là ». La densité est ici l'argument, pas un compromis.
 */
export function CapabilityGrid() {
  return (
    <section className="px-5 pb-20 sm:px-8 sm:pb-28">
      <div className="mx-auto max-w-6xl rounded-3xl border border-trait bg-white p-6 sm:p-10 lg:p-14">
        <Reveal>
          <p className="t-eyebrow text-braise-texte">{C.eyebrow}</p>
          <h2 className="t-h2 mt-5 max-w-[18ch] text-encre">{C.titre}</h2>
          <p className="t-body mt-4 max-w-[48ch] text-encre-faible">{C.accroche}</p>
        </Reveal>

        <dl className="mt-12 grid gap-x-12 gap-y-0 sm:grid-cols-2">
          {C.items.map((item) => (
            <Reveal
              key={item.label}
              className="border-t border-trait py-5"
            >
              <dt className="t-eyebrow text-[0.6875rem] text-encre">{item.label}</dt>
              <dd className="mt-2 text-[0.9375rem] leading-relaxed text-encre-faible">
                {item.ligne}
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
