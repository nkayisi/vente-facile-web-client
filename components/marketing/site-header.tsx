"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { NAV } from "@/lib/marketing/content";
import { cn } from "@/lib/utils";

type Props = {
  /**
   * Résolu CÔTÉ SERVEUR par la page, via `auth()`.
   * L'ancienne version appelait `useSession()` ici : l'en-tête affichait
   * « Connexion » puis basculait sur « Mon compte » après hydratation, un
   * clignotement sur le premier élément que le visiteur regarde.
   */
  isAuthenticated: boolean;
  isStaff: boolean;
};

export function SiteHeader({ isAuthenticated, isStaff }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [defile, setDefile] = useState(false);
  const reduit = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setDefile(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Un menu plein écran qui laisse la page défiler dessous donne deux zones de
  // défilement qui se disputent le doigt.
  useEffect(() => {
    if (!ouvert) return;
    const precedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEchap = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    window.addEventListener("keydown", onEchap);
    return () => {
      document.body.style.overflow = precedent;
      window.removeEventListener("keydown", onEchap);
    };
  }, [ouvert]);

  const compteHref = isStaff ? "/admin" : "/dashboard";

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* Matière translucide : le contenu passe DESSOUS, la barre ne consomme
          pas une bande opaque. Le fondu remplace le filet de 1 px. */}
      <div
        className={cn(
          "absolute inset-0 transition-[background-color,backdrop-filter] duration-300",
          defile
            // ⚠ 92 % et non 80 %. MESURÉ : à 80 %, quand la barre flotte
            // au-dessus d'une bande encre, le texte blanc de la section se lit
            // À TRAVERS elle (delta de 46/255 derrière la navigation). À 92 %
            // le fantôme tombe à 8/255, donc sous le seuil de perception,
            // pendant que le flou et le léger assombrissement au-dessus de
            // l'encre gardent la lecture d'une matière translucide.
            ? "bg-paper/92 backdrop-blur-xl backdrop-saturate-150"
            : "bg-transparent"
        )}
        aria-hidden
      />
      {defile && (
        <div
          className="pointer-events-none absolute inset-x-0 top-full h-6 bg-gradient-to-b from-paper/85 to-transparent"
          aria-hidden
        />
      )}

      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-braise focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            className="size-8 object-contain"
            priority
          />
          <span
            className="text-[0.9375rem] font-semibold tracking-tight text-encre"
            style={{ fontFamily: "var(--font-display-stack)" }}
          >
            Vente Facile
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-encre-faible transition-colors duration-150 hover:text-encre focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-braise"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-1.5 md:flex">
          {isAuthenticated ? (
            <Link href={compteHref} className={cn(BTN_PLEIN)}>
              {isStaff ? "Administration" : "Mon compte"}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-encre-faible transition-colors duration-150 hover:text-encre focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-braise"
              >
                Connexion
              </Link>
              <Link href="/auth/register" className={cn(BTN_PLEIN)}>
                Ouvrir un compte
              </Link>
            </>
          )}
        </div>

        {/* 44 px de cible, pas 32 : c'est la main d'un commerçant debout. */}
        <button
          type="button"
          onClick={() => setOuvert((v) => !v)}
          aria-expanded={ouvert}
          aria-controls="menu-mobile"
          aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
          className="-mr-2 flex size-11 items-center justify-center rounded-lg text-encre transition-[background-color,scale] duration-150 hover:bg-paper-creux active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-braise md:hidden"
        >
          {ouvert ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <AnimatePresence>
        {ouvert && (
          <motion.div
            id="menu-mobile"
            initial={reduit ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            // La sortie est plus courte que l'entrée : un menu qui traîne en
            // se fermant donne l'impression que l'appui n'a pas été pris.
            exit={reduit ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="relative mx-4 mt-1 rounded-2xl border border-trait bg-paper p-2 shadow-[0_1px_2px_rgba(28,24,21,0.04),0_12px_32px_-8px_rgba(28,24,21,0.16)] md:hidden"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOuvert(false)}
                className="flex min-h-11 items-center rounded-xl px-4 text-[0.9375rem] text-encre transition-colors duration-150 hover:bg-paper-creux focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-braise"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 space-y-2 border-t border-trait pt-2">
              {isAuthenticated ? (
                <Link
                  href={compteHref}
                  onClick={() => setOuvert(false)}
                  className={cn(BTN_PLEIN, "w-full")}
                >
                  {isStaff ? "Administration" : "Mon compte"}
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    onClick={() => setOuvert(false)}
                    className="flex min-h-11 items-center justify-center rounded-xl border border-trait text-[0.9375rem] font-medium text-encre transition-colors duration-150 hover:bg-paper-creux focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-braise"
                  >
                    Connexion
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={() => setOuvert(false)}
                    className={cn(BTN_PLEIN, "w-full")}
                  >
                    Ouvrir un compte
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* `transition-[…]` nommée, jamais `transition-all` : sur un bouton qui porte
   aussi une ombre et une bordure, `all` anime des propriétés non composables
   et fait sauter la première image. */
const BTN_PLEIN =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-braise px-4 text-sm font-medium text-white shadow-[0_1px_2px_rgba(28,24,21,0.08),0_2px_8px_-2px_rgba(234,88,12,0.4)] transition-[background-color,scale,box-shadow] duration-150 hover:bg-[#d24e09] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-braise focus-visible:ring-offset-2 focus-visible:ring-offset-paper";
