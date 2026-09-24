import { RECONNAISSANCES } from "@/lib/marketing/content";
import { Reveal } from "./reveal";

/**
 * Trois situations PARALLÈLES, pas une séquence.
 *
 * D'où l'absence de numérotation « 01 / 02 / 03 » : un marqueur ordinal promet
 * un ordre que le lecteur devrait suivre, et il n'y en a pas. Le marqueur est
 * le GUILLEMET, parce que ce sont des phrases de commerçant, et c'est
 * exactement ce qui doit être reconnu avant d'être expliqué.
 */
export function Recognitions() {
  return (
    <section id="comptoir" className="scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="t-h2 max-w-[22ch] text-encre">{RECONNAISSANCES.titre}</h2>
        </Reveal>

        <ul className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-trait bg-trait md:grid-cols-3">
          {RECONNAISSANCES.items.map((item) => (
            <Reveal as="li" key={item.dit} className="bg-paper">
              <article className="flex h-full flex-col p-6 sm:p-7">
                {/* Le guillemet est le marqueur. Il est gros, en orange lisible
                    (--braise-texte, pas --braise : ce dernier tombe sous 3,5:1
                    sur papier et ne tient que pour un bouton). */}
                <span
                  className="-mb-4 select-none text-5xl leading-none text-braise-texte/35"
                  aria-hidden
                  style={{ fontFamily: "var(--font-display-stack)" }}
                >
                  &ldquo;
                </span>
                <p className="t-h3 text-encre">{item.dit}</p>
                <p className="t-body mt-3 flex-1 text-encre-faible">{item.fait}</p>

                <div className="mt-6 rounded-xl bg-paper-creux p-3">
                  <p className="t-data text-[0.8125rem] font-medium text-encre">
                    {item.donnee}
                  </p>
                  <p className="mt-1 text-[0.75rem] text-encre-ombre">{item.legende}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
