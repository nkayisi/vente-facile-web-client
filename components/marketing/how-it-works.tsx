import { DEMARRAGE as D } from "@/lib/marketing/content";
import { Reveal } from "./reveal";

/**
 * Trois étapes, entre « ce que ça fait » et « combien ça coûte ».
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ RIEN NE DISAIT CE QUI SE PASSE APRÈS « OUVRIR UN COMPTE ».              │
 * │                                                                          │
 * │ La page décrivait le produit, ses limites et son prix, et laissait le    │
 * │ lecteur deviner le chemin. C'est la seule chose que l'ancienne version   │
 * │ portait et que la refonte n'a pas reprise.                               │
 * │                                                                          │
 * │ ⚠ TROIS ÉTAPES, LÀ OÙ L'ANCIENNE EN ANNONÇAIT QUATRE. La quatrième       │
 * │ était « Développez votre activité - analysez vos rapports et grandissez  │
 * │ grâce aux données », qui ne décrit aucun geste : c'est une promesse, pas │
 * │ une étape. Trois est aussi le nombre de vues de la présentation du       │
 * │ terminal, et les deux surfaces racontent la même entrée.                 │
 * │                                                                          │
 * │ ⚠ PAS UNE SECONDE BANDE SOMBRE. La page n'en porte qu'une,               │
 * │ `TerminalBand`, et deux bandes encre séparées par la seule grille des    │
 * │ modules casseraient le rythme. Le creux du papier suffit à détacher.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export function HowItWorks() {
  return (
    <section className="bg-paper-creux px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="t-eyebrow text-braise-texte">{D.eyebrow}</p>
          <h2 className="t-h2 mt-5 max-w-[16ch] text-encre">{D.titre}</h2>
          <p className="t-body mt-4 max-w-[52ch] text-encre-faible">{D.accroche}</p>
        </Reveal>

        <ol className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-trait bg-trait md:grid-cols-3">
          {D.etapes.map((e) => (
            <Reveal as="li" key={e.numero} className="bg-paper">
              <div className="flex h-full flex-col p-6 sm:p-7">
                {/* Le numéro est le marqueur : ici l'ORDRE compte, à l'inverse
                    des trois reconnaissances plus haut, qui sont parallèles et
                    n'en portent délibérément aucun. */}
                <span className="t-data text-[0.8125rem] font-medium text-braise-texte">
                  {e.numero}
                </span>
                <h3 className="t-h3 mt-3 text-encre">{e.titre}</h3>
                <p className="t-body mt-3 text-encre-faible">{e.corps}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
