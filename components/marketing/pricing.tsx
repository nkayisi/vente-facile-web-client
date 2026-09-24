"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { PublicPlan } from "@/actions/subscription.actions";
import { TARIFS as T } from "@/lib/marketing/content";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

/**
 * Conservée telle quelle depuis l'ancienne page : elle était correcte, et la
 * réécrire n'aurait produit que le risque de la casser.
 */
function buildFeatureList(plan: PublicPlan): string[] {
  const features: string[] = [];

  if (plan.max_branches === 1) features.push("1 point de vente");
  else if (plan.max_branches > 100) features.push("Points de vente illimités");
  else features.push(`Jusqu'à ${plan.max_branches} points de vente`);

  if (plan.max_products === null || plan.max_products === 0)
    features.push("Produits illimités");
  else features.push(`Jusqu'à ${plan.max_products.toLocaleString("fr-FR")} produits`);

  if (plan.max_users === 1) features.push("1 utilisateur");
  else if (plan.max_users > 100) features.push("Utilisateurs illimités");
  else features.push(`${plan.max_users} utilisateurs`);

  if (plan.max_monthly_transactions) {
    features.push(
      `${plan.max_monthly_transactions.toLocaleString("fr-FR")} transactions/mois`
    );
  } else {
    features.push("Transactions illimitées");
  }

  if (plan.storage_limit_mb >= 1024) {
    features.push(`${Math.round(plan.storage_limit_mb / 1024)} Go de stockage`);
  } else {
    features.push(`${plan.storage_limit_mb} Mo de stockage`);
  }

  features.push(...plan.plan_features.filter((f) => f.is_enabled).map((f) => f.name));
  return features;
}

export function Pricing({
  plans,
  isAuthenticated,
}: {
  plans: PublicPlan[];
  isAuthenticated: boolean;
}) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  return (
    <section id="tarifs" className="scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-[46ch]">
          <p className="t-eyebrow text-braise-texte">{T.eyebrow}</p>
          <h2 className="t-h2 mt-5 text-encre">{T.titre}</h2>
          <p className="t-body mt-4 text-encre-faible">{T.accroche}</p>
        </Reveal>

        {plans.length === 0 ? (
          // Un état vide qui DIT quelque chose et laisse une issue. Un cadre
          // vide se lirait « rien à vendre ».
          <Reveal className="mt-12 rounded-2xl border border-trait bg-white p-8 text-center">
            <p className="t-body mx-auto max-w-[46ch] text-encre-faible">
              {T.indisponible}
            </p>
            <Link href="/auth/register" className={cn(BTN, "mt-6 inline-flex")}>
              {T.ctaEssai}
            </Link>
          </Reveal>
        ) : (
          <>
            <Reveal className="mt-10">
              <Bascule cycle={cycle} onChange={setCycle} />
            </Reveal>

            <div
              className={cn(
                "mt-10 grid gap-5",
                plans.length === 1 && "max-w-md",
                plans.length === 2 && "max-w-3xl sm:grid-cols-2",
                plans.length >= 3 && "md:grid-cols-3"
              )}
            >
              {plans.map((plan) => (
                <Reveal key={plan.id}>
                  <CartePlan
                    plan={plan}
                    cycle={cycle}
                    isAuthenticated={isAuthenticated}
                  />
                </Reveal>
              ))}
            </div>

            <Reveal>
              <p className="t-data mt-8 text-center text-[0.75rem] text-encre-ombre">
                {T.note}
              </p>
            </Reveal>
          </>
        )}
      </div>
    </section>
  );
}

function Bascule({
  cycle,
  onChange,
}: {
  cycle: "monthly" | "yearly";
  onChange: (c: "monthly" | "yearly") => void;
}) {
  return (
    // Un groupe de deux boutons RÉELS, pas un interrupteur flanqué de deux
    // étiquettes : l'ancienne version ne laissait cliquer que l'interrupteur
    // lui-même, donc une cible de 56 px pour deux choix.
    <div
      role="radiogroup"
      aria-label="Période de facturation"
      className="inline-flex rounded-xl border border-trait bg-white p-1"
    >
      {(
        [
          ["monthly", T.mensuel],
          ["yearly", T.annuel],
        ] as const
      ).map(([valeur, libelle]) => (
        <button
          key={valeur}
          type="button"
          role="radio"
          aria-checked={cycle === valeur}
          onClick={() => onChange(valeur)}
          className={cn(
            "min-h-10 rounded-lg px-5 text-[0.875rem] font-medium transition-[background-color,color,scale] duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-braise",
            cycle === valeur
              ? "bg-encre text-paper"
              : "text-encre-faible hover:text-encre"
          )}
        >
          {libelle}
        </button>
      ))}
    </div>
  );
}

function CartePlan({
  plan,
  cycle,
  isAuthenticated,
}: {
  plan: PublicPlan;
  cycle: "monthly" | "yearly";
  isAuthenticated: boolean;
}) {
  const mensuel = parseFloat(plan.price_monthly);
  const annuel = parseFloat(plan.price_yearly);
  /* Un prix à zéro veut dire DEUX choses différentes, et les confondre était
     le défaut de l'ancienne page : elle écrivait « Sur mesure » sur le plan
     nommé « Essai Gratuit ». Un plan à zéro qui porte une durée d'essai est
     l'offre gratuite ; un plan à zéro SANS durée d'essai est celui dont le
     prix se négocie. */
  const gratuit = mensuel === 0 && plan.trial_days > 0;
  const surMesure = mensuel === 0 && plan.trial_days === 0;
  const affiche = cycle === "yearly" ? Math.round(annuel / 12) : mensuel;
  const checkout = `/payment/checkout?planId=${plan.id}&cycle=${cycle}`;
  const href = surMesure || gratuit
    ? "/auth/register"
    : isAuthenticated
      ? checkout
      : `/auth/login?callbackUrl=${encodeURIComponent(checkout)}`;

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border bg-white p-6 sm:p-7",
        plan.is_featured
          ? "border-braise shadow-[0_1px_2px_rgba(28,24,21,0.04),0_16px_40px_-16px_rgba(234,88,12,0.35)]"
          : "border-trait"
      )}
    >
      {plan.is_featured && (
        <span className="t-eyebrow absolute -top-2.5 left-6 rounded-full bg-braise px-2.5 py-1 text-[0.625rem] text-white">
          {T.populaire}
        </span>
      )}

      <h3 className="t-h3 text-encre">{plan.name}</h3>
      {plan.description && (
        <p className="mt-1.5 text-[0.875rem] leading-relaxed text-encre-faible">
          {plan.description}
        </p>
      )}

      <div className="mt-6 flex min-h-[3.25rem] flex-col justify-end">
        {gratuit ? (
          <p className="t-h3 text-encre">{T.gratuit}</p>
        ) : surMesure ? (
          <p className="t-h3 text-encre">{T.surMesure}</p>
        ) : (
          <>
            <p className="flex items-baseline gap-1.5">
              <span className="t-data text-[2rem] font-semibold leading-none text-encre">
                {affiche.toLocaleString("fr-FR")}
              </span>
              <span className="t-data text-[0.8125rem] text-encre-faible">
                {plan.currency.symbol} / mois
              </span>
            </p>
            {cycle === "yearly" && (
              <p className="t-data mt-1.5 text-[0.75rem] text-encre-ombre">
                {annuel.toLocaleString("fr-FR")} {plan.currency.symbol} par an
              </p>
            )}
          </>
        )}
      </div>

      <ul className="mt-6 flex-1 space-y-2.5 border-t border-trait pt-6">
        {buildFeatureList(plan).map((f) => (
          <li key={f} className="flex gap-2.5 text-[0.875rem] leading-relaxed text-encre-faible">
            <Check className="mt-0.5 size-4 shrink-0 text-vert" aria-hidden />
            {f}
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className={cn(
          "mt-7",
          plan.is_featured
            ? BTN
            : "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-trait bg-white px-5 text-[0.875rem] font-medium text-encre transition-[background-color,scale] duration-150 hover:bg-paper-creux active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-braise focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        )}
      >
        {surMesure || gratuit ? T.ctaEssai : T.ctaPlan}
      </Link>

      {plan.trial_days > 0 && !gratuit && (
        <p className="t-data mt-3 text-center text-[0.6875rem] text-encre-ombre">
          {plan.trial_days} jours d&apos;essai
        </p>
      )}
    </div>
  );
}

const BTN =
  "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-braise px-5 text-[0.875rem] font-medium text-white shadow-[0_1px_2px_rgba(28,24,21,0.08),0_6px_18px_-6px_rgba(234,88,12,0.5)] transition-[background-color,scale] duration-150 hover:bg-[#d24e09] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-braise focus-visible:ring-offset-2 focus-visible:ring-offset-paper";
