import Image from "next/image";

import { CAPTURE as C } from "@/lib/marketing/content";
import { Reveal } from "./reveal";

/**
 * La capture du produit, en bande pleine largeur sous le hero.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ELLE NE REMPLACE PAS LA DÉMO, ELLE LA COMPLÈTE.                         │
 * │                                                                          │
 * │ La démo animée du hero raconte la promesse du titre - le réseau tombe,   │
 * │ la vente sort quand même - et c'est ce qu'aucun concurrent ne peut       │
 * │ montrer. Mais on n'y voyait JAMAIS le produit : un commerçant qui hésite │
 * │ veut voir l'écran qu'il aura, et une animation stylisée ne le lui dit    │
 * │ pas. Les deux preuves se suivent : ce que ça FAIT, puis ce à quoi ça     │
 * │ RESSEMBLE.                                                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LES DIMENSIONS SONT CELLES DU FICHIER, 2914 × 1634. L'ancienne page
 * déclarait 1280 × 800, soit un rapport de 1,6 contre 1,783 : l'espace réservé
 * pendant le chargement était faux, et la page sautait quand l'image arrivait.
 */
export function ProductShot() {
  return (
    <section className="px-5 pb-20 sm:px-8 sm:pb-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-[46rem] text-center">
          <p className="t-eyebrow text-braise-texte">{C.eyebrow}</p>
          <h2 className="t-h2 mt-5 text-encre">{C.titre}</h2>
          <p className="t-body mx-auto mt-4 max-w-[52ch] text-encre-faible">
            {C.accroche}
          </p>
        </Reveal>

        <Reveal className="mt-12">
          {/* Le cadre de navigateur situe la capture : sans lui, une image de
              tableau de bord posée nue se lit comme une illustration. */}
          <div className="overflow-hidden rounded-2xl border border-trait bg-paper-creux p-2 shadow-[0_1px_2px_rgba(28,24,21,0.06),0_24px_60px_-28px_rgba(28,24,21,0.35)] sm:rounded-3xl sm:p-2.5">
            <div className="overflow-hidden rounded-xl bg-white sm:rounded-2xl">
              <div className="flex items-center gap-3 bg-ink px-3 py-2.5 sm:px-4">
                <div className="flex shrink-0 gap-1.5" aria-hidden>
                  <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="size-2.5 rounded-full bg-[#febc2e]" />
                  <span className="size-2.5 rounded-full bg-[#28c840]" />
                </div>
                {/* ⚠ Le VRAI domaine : voir la docstring de `CAPTURE`. */}
                <div className="min-w-0 flex-1 rounded bg-ink-relief px-3 py-1 text-center">
                  <span className="t-data block truncate text-[0.6875rem] text-[#8a7f75]">
                    {C.url}
                  </span>
                </div>
              </div>

              <Image
                /* ⚠ LE NOM PORTE LA VERSION, ET C'EST DÉLIBÉRÉ. L'optimiseur
                   d'images de Next met en cache ses variantes par URL : remplacer
                   le fichier SANS changer son nom laisse servir l'ancienne capture,
                   au navigateur comme au CDN, indéfiniment. Mesuré ici même - la
                   page a continué d'afficher sept onglets alors que le fichier en
                   portait huit. Toute recapture se renomme. */
                src="/apercu-back-office.png"
                alt={C.alt}
                width={2914}
                height={1634}
                sizes="(min-width: 1152px) 1088px, 100vw"
                className="block h-auto w-full"
                priority
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
