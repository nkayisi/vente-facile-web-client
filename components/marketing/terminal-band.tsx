import { Printer, Smartphone, WifiOff } from "lucide-react";

import { TERMINAL as T } from "@/lib/marketing/content";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

/**
 * Bande encre n° 2.
 *
 * Le visuel n'est pas un rendu de terminal en trois dimensions : ce sont les
 * CINQ VERDICTS de synchronisation. C'est vrai, c'est précis, et personne
 * d'autre sur ce marché n'a de quoi l'afficher. Un dessin de matériel dirait
 * « on a une application mobile » ; cette liste dit « on a réfléchi à ce qui
 * arrive quand ça rate », ce qui est la vraie question d'un commerçant qui a
 * déjà perdu une journée de ventes.
 */
export function TerminalBand() {
  return (
    <section className="bg-ink px-5 py-20 text-paper sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-2 lg:items-start lg:gap-20">
        <Reveal>
          <p className="t-eyebrow text-braise-ink">{T.eyebrow}</p>
          <h2 className="t-h2 mt-5 text-paper">{T.titre}</h2>
          {T.corps.map((p) => (
            <p key={p} className="t-body mt-5 max-w-[42ch] text-[#b8ada3]">
              {p}
            </p>
          ))}

          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3">
            {[
              { Icone: Smartphone, texte: "Terminal Android" },
              { Icone: WifiOff, texte: "Hors ligne d'abord" },
              { Icone: Printer, texte: "58 mm, Bluetooth ou PDF" },
            ].map(({ Icone, texte }) => (
              <li
                key={texte}
                className="inline-flex items-center gap-2 text-[0.8125rem] text-[#b8ada3]"
              >
                <Icone className="size-4 text-braise-ink" aria-hidden />
                {texte}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal>
          <div className="rounded-2xl border border-trait-ink bg-ink-relief p-5 sm:p-7">
            <p className="t-eyebrow text-[#8a7f75]">{T.verdictsTitre}</p>

            <ul className="mt-5">
              {T.verdicts.map((v) => (
                <li
                  key={v.code}
                  className="flex items-baseline gap-4 border-t border-trait-ink py-3.5 first:border-t-0 first:pt-0"
                >
                  <span
                    className={cn(
                      "t-data w-[6.5rem] shrink-0 text-[0.8125rem]",
                      v.ton === "ok" && "text-vert-ink",
                      v.ton === "refus" && "text-refus-ink",
                      v.ton === "attente" && "text-ambre-ink"
                    )}
                  >
                    {v.code}
                  </span>
                  <span className="text-[0.8125rem] leading-relaxed text-[#b8ada3]">
                    {v.sens}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-6 border-t border-trait-ink pt-4 text-[0.75rem] leading-relaxed text-[#8a7f75]">
              {T.verdictsNote}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
