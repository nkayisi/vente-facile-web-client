import {
  BarChart3,
  Check,
  ClipboardList,
  FileText,
  Package,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { CAPACITES as C } from "@/lib/marketing/content";
import { Reveal } from "./reveal";

/**
 * Huit modules, en cartes.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CETTE SECTION A ÉTÉ UNE LISTE DENSE, ET L'ARGUMENT A CHANGÉ.            │
 * │                                                                          │
 * │ Elle rendait huit lignes d'une phrase chacune, et sa docstring défendait │
 * │ la densité : « huit cartes aérées disent voici huit choses ; une liste   │
 * │ serrée dit il y en a beaucoup ». L'argument était juste pour ce qu'elle  │
 * │ visait - l'ÉTENDUE - et insuffisant pour ce qu'on lui demande           │
 * │ maintenant : dire CE QUE CHAQUE MODULE FAIT. Une ligne par module        │
 * │ oblige le lecteur à deviner, et c'est précisément ce que l'ancienne      │
 * │ page d'accueil faisait mieux.                                            │
 * │                                                                          │
 * │ La densité n'est pas abandonnée, elle est déplacée : trois puces         │
 * │ COURTES par carte, jamais trois phrases. Huit paragraphes noieraient     │
 * │ l'étendue qu'on vient montrer.                                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
const GLYPHES: Record<string, LucideIcon> = {
  panier: ShoppingCart,
  colis: Package,
  "presse-papier": ClipboardList,
  clients: Users,
  caisse: Wallet,
  document: FileText,
  graphique: BarChart3,
  bouclier: ShieldCheck,
};

export function CapabilityGrid() {
  return (
    <section className="px-5 pb-20 sm:px-8 sm:pb-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="t-eyebrow text-braise-texte">{C.eyebrow}</p>
          <h2 className="t-h2 mt-5 max-w-[18ch] text-encre">{C.titre}</h2>
          <p className="t-body mt-4 max-w-[48ch] text-encre-faible">{C.accroche}</p>
        </Reveal>

        {/* ⚠ `grid-cols-1` EXPLICITE. Une grille sans colonne déclarée
            dimensionne sa piste sur `max-content`, si bien qu'une carte plus
            large que la fenêtre pousse un défilement horizontal du document
            entier - le défaut mesuré sur neuf grilles du back-office. */}
        <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {C.items.map((item) => {
            const Glyphe = GLYPHES[item.icone];
            return (
              <Reveal
                as="li"
                key={item.label}
                className="flex h-full flex-col rounded-2xl border border-trait bg-white p-5"
              >
                <span
                  className="flex size-10 items-center justify-center rounded-xl bg-braise-voile text-braise-texte"
                  aria-hidden
                >
                  <Glyphe className="size-5" strokeWidth={1.75} />
                </span>

                <h3 className="t-eyebrow mt-4 text-[0.6875rem] text-encre">
                  {item.label}
                </h3>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-encre-faible">
                  {item.ligne}
                </p>

                <ul className="mt-4 space-y-2 border-t border-trait pt-4">
                  {item.details.map((d) => (
                    <li key={d} className="flex gap-2 text-[0.8125rem] leading-snug text-encre-faible">
                      <Check
                        className="mt-0.5 size-3.5 shrink-0 text-braise-texte"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      {d}
                    </li>
                  ))}
                </ul>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
