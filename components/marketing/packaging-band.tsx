import { ArrowDown } from "lucide-react";

import { CONDITIONNEMENT as C, unitesDuRayon } from "@/lib/marketing/content";
import { Reveal } from "./reveal";

/** Bande encre n° 1. Le rythme papier / encre reprend celui d'un rouleau. */
export function PackagingBand() {
  /* Le total en unités est CALCULÉ et non recopié, par la MÊME fonction que le
     titre de la section (`unitesDuRayon`, dans content.ts). Une seconde
     arithmétique est très exactement ce qui a produit le « Jamais 43 » que
     cette carte démentait à trois centimètres de là. */
  const avant = unitesDuRayon(C.avant);
  const apres = unitesDuRayon(C.apres);

  return (
    <section className="bg-ink px-5 py-20 text-paper sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
        <Reveal>
          <p className="t-eyebrow text-braise-ink">{C.eyebrow}</p>
          <h2 className="t-h2 mt-5 text-paper">{C.titre}</h2>
          {C.corps.map((p) => (
            <p key={p} className="t-body mt-5 max-w-[42ch] text-[#b8ada3]">
              {p}
            </p>
          ))}
        </Reveal>

        <Reveal>
          <div className="rounded-2xl border border-trait-ink bg-ink-relief p-5 sm:p-7">
            <p className="t-eyebrow text-[#8a7f75]">{C.article}</p>

            <Rayon
              casiers={C.avant.casiers}
              isolees={C.avant.isolees}
              unites={avant}
            />

            {/* L'action, entre les deux états. Ce n'est pas un bouton : rien
                n'est cliquable ici, et une forme de bouton promettrait un
                appui qui ne répondrait pas. */}
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-trait-ink" aria-hidden />
              <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-[#b8ada3]">
                <ArrowDown className="size-3.5 text-braise-ink" aria-hidden />
                {C.action}
              </span>
              <span className="h-px flex-1 bg-trait-ink" aria-hidden />
            </div>

            <Rayon
              casiers={C.apres.casiers}
              isolees={C.apres.isolees}
              unites={apres}
              actif
            />

            {/* L'invariant. C'est LUI le message : ouvrir un casier déplace des
                unités entre deux compteurs, il n'en crée ni n'en détruit. */}
            <p className="mt-6 flex items-baseline justify-between border-t border-trait-ink pt-4 text-[0.75rem] text-[#8a7f75]">
              <span>{C.invariant}</span>
              <span className="t-data text-[0.8125rem] text-paper">
                {avant} {C.uniteDetail}
              </span>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Rayon({
  casiers,
  isolees,
  unites,
  actif = false,
}: {
  casiers: number;
  isolees: number;
  unites: number;
  actif?: boolean;
}) {
  return (
    <div>
      <p
        className={`t-data text-[1.375rem] leading-tight sm:text-[1.625rem] ${
          actif ? "text-braise-ink" : "text-paper"
        }`}
      >
        {casiers} {C.uniteGros} <span className="text-[#8a7f75]">+</span> {isolees}{" "}
        {C.uniteDetail}
      </p>
      {/* Le total en unités existe, et il est DESSOUS, plus petit : il sert au
          réassort, pas à la vente. */}
      <p className="t-data mt-1 text-[0.75rem] text-[#8a7f75]">
        soit {unites} {C.uniteDetail}
      </p>
    </div>
  );
}
