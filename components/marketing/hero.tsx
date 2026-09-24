import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { HERO } from "@/lib/marketing/content";
import { CounterDemo } from "./counter-demo";

/**
 * Composition ASYMÉTRIQUE, et c'est le premier choix de la page.
 * Le hero centré avec une capture dans un cadre de navigateur est la
 * disposition la plus vue de l'internet, et c'était celle d'avant.
 *
 * L'entrée est une SEULE séquence orchestrée, en CSS pur : décalages de 70 ms,
 * aucune frontière client, rien à hydrater avant le premier rendu utile.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-16 pt-28 sm:px-8 sm:pb-24 sm:pt-36">
      {/* Halo unique, très bas en opacité. La page n'en portera pas d'autre :
          on dépense sa hardiesse à un seul endroit, la démo. */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.55] blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, #ffe6d2 0%, rgba(255,230,210,0.35) 55%, transparent 100%)",
        }}
        aria-hidden
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-10">
        <div>
          <p
            className="entree t-eyebrow text-braise-texte"
            style={{ animationDelay: "0ms" }}
          >
            {HERO.eyebrow}
          </p>

          <h1
            className="entree t-display mt-5 text-encre"
            style={{ animationDelay: "70ms" }}
          >
            {HERO.titre[0]}
            <br />
            {HERO.titre[1]}
          </h1>

          <p
            className="entree t-lead mt-6 max-w-[34rem] text-encre-faible"
            style={{ animationDelay: "140ms" }}
          >
            {HERO.accroche}
          </p>

          <div
            className="entree mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: "210ms" }}
          >
            <Link
              href="/auth/register"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-braise px-6 text-[0.9375rem] font-medium text-white shadow-[0_1px_2px_rgba(28,24,21,0.1),0_8px_24px_-8px_rgba(234,88,12,0.55)] transition-[background-color,scale,box-shadow] duration-150 hover:bg-[#d24e09] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-braise focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              {HERO.ctaPrincipal}
              <ArrowRight
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <Link
              href="#comptoir"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-trait bg-white px-6 text-[0.9375rem] font-medium text-encre transition-[background-color,scale] duration-150 hover:bg-paper-creux active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-braise focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              {HERO.ctaSecondaire}
            </Link>
          </div>

          <ul
            className="entree mt-7 flex flex-wrap items-center gap-x-5 gap-y-1.5"
            style={{ animationDelay: "280ms" }}
          >
            {HERO.preuve.map((p) => (
              <li
                key={p}
                className="t-data flex items-center gap-2 text-[0.75rem] text-encre-ombre"
              >
                <span className="size-1 rounded-full bg-encre-ombre" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="entree" style={{ animationDelay: "180ms" }}>
          <CounterDemo />
        </div>
      </div>
    </section>
  );
}
