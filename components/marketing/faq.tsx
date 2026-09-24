"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { QUESTIONS as Q } from "@/lib/marketing/content";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

export function Faq() {
  const [ouvert, setOuvert] = useState<number | null>(0);

  return (
    <section id="questions" className="scroll-mt-20 px-5 pb-20 sm:px-8 sm:pb-28">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <p className="t-eyebrow text-braise-texte">{Q.eyebrow}</p>
          <h2 className="t-h2 mt-5 text-encre">{Q.titre}</h2>
        </Reveal>

        <div className="mt-12 border-t border-trait">
          {Q.items.map((item, i) => {
            const actif = ouvert === i;
            return (
              <Reveal
                key={item.q}
                className="border-b border-trait"
              >
                <h3>
                  <button
                    type="button"
                    id={`question-${i}`}
                    onClick={() => setOuvert(actif ? null : i)}
                    aria-expanded={actif}
                    aria-controls={`reponse-${i}`}
                    className="group flex w-full items-start justify-between gap-6 py-5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-braise"
                  >
                    <span className="text-[1.0625rem] font-medium leading-snug text-encre">
                      {item.q}
                    </span>
                    {/* Une croix qui tourne plutôt qu'un chevron : elle dit
                        « ouvrir / fermer », là où un chevron dit « aller ». */}
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center">
                      <Plus
                        className={cn(
                          "size-4 text-encre-ombre transition-[rotate,color] duration-300 ease-[cubic-bezier(0.2,0,0,1)] group-hover:text-encre",
                          actif && "rotate-45"
                        )}
                        aria-hidden
                      />
                    </span>
                  </button>
                </h3>

                {/* `grid-template-rows: 0fr → 1fr` : la hauteur se résout sans
                    qu'on ait à la mesurer, et la SORTIE est animée elle aussi.
                    L'ancienne version montait la réponse dans un rendu
                    conditionnel nu : elle disparaissait d'un coup.

                    ⚠ MAIS UNE RÉPONSE À `0fr` RESTE DANS L'ARBRE
                    D'ACCESSIBILITÉ. Elle sort de l'écran, pas de la lecture : un
                    lecteur d'écran enchaînait les six réponses alors que les six
                    boutons annonçaient `aria-expanded="false"`.
                    `inert` la retire de cet arbre ET du parcours de focus, sans
                    toucher à l'animation ; `hidden` la couperait net, et c'est
                    justement ce que ce `0fr → 1fr` existe pour éviter.
                    `aria-hidden` serait redondant avec lui.

                    `aria-labelledby` NOMME le repère : un `role="region"` sans
                    nom accessible est un repère de navigation que personne ne
                    peut identifier, et il y en avait six. */}
                <div
                  id={`reponse-${i}`}
                  role="region"
                  aria-labelledby={`question-${i}`}
                  inert={!actif}
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                    actif ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="t-body max-w-[62ch] pb-6 pr-10 text-encre-faible">
                      {item.r}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
