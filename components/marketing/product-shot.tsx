import Image from "next/image";

import { CAPTURE as C } from "@/lib/marketing/content";
import { Reveal } from "./reveal";

/**
 * Les deux surfaces du produit, dans une seule section.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ELLE NE REMPLACE PAS LA DÉMO, ELLE LA COMPLÈTE.                         │
 * │                                                                          │
 * │ La démo animée du hero raconte la promesse du titre - le réseau tombe,   │
 * │ la vente sort quand même - et c'est ce qu'aucun concurrent ne peut       │
 * │ montrer. Mais on n'y voyait JAMAIS le produit : un commerçant qui hésite │
 * │ veut voir l'écran qu'il aura. Les deux preuves se suivent : ce que ça    │
 * │ FAIT, puis ce à quoi ça RESSEMBLE.                                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LES TROIS CAPTURES MONTRENT LE MÊME ÉTABLISSEMENT, LE MÊME JOUR, et c'est
 * l'argument de la section. Les chiffres coïncident d'une image à l'autre
 * (805 168,9 $, 566 unités, 22,2 % de marge) : c'est ce qui prouve qu'il s'agit
 * d'un seul logiciel et non de deux produits vendus ensemble. Toute recapture
 * doit préserver cette coïncidence, sinon la phrase d'accroche devient fausse.
 *
 * ⚠ LES DEUX THÈMES SONT MONTRÉS CÔTE À CÔTE, sans interrupteur. Un sélecteur
 * clair/sombre ferait de cette section une cinquième île cliente d'une page qui
 * en compte quatre, pour une bascule que personne ne cherche sur une page de
 * vente. Et à la largeur d'un téléphone, le CONTRASTE des deux thèmes est la
 * seule chose encore lisible : c'est précisément le message.
 */
export function ProductShot() {
  return (
    <section className="px-5 pb-20 sm:px-8 sm:pb-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-[46rem] text-center">
          <p className="t-eyebrow text-braise-texte">{C.eyebrow}</p>
          <h2 className="t-h2 mt-5 text-encre">{C.titre}</h2>
          <p className="t-body mx-auto mt-4 max-w-[54ch] text-encre-faible">
            {C.accroche}
          </p>
        </Reveal>

        {/* `items-end` : les deux appareils posent sur la même ligne de base.
            Sans lui, le navigateur flotterait au milieu de la hauteur des
            téléphones, et la composition se lirait comme deux blocs sans
            rapport plutôt que comme un seul poste de travail. */}
        <Reveal className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:items-end lg:gap-8">
          <CadreNavigateur />

          <div>
            <p className="t-eyebrow mb-4 text-center text-braise-texte">
              {C.mobileTitre}
            </p>
            <ul className="grid grid-cols-2 gap-3 sm:gap-5">
              {C.mobiles.map((mobile) => (
                <li key={mobile.cle}>
                  <CadreTelephone src={mobile.src} alt={mobile.alt} />
                  <p className="t-data mt-3 text-center text-[0.75rem] text-encre-ombre">
                    {mobile.legende}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <p className="t-body mx-auto mt-8 max-w-[46ch] text-center text-encre-ombre">
          {C.mobileNote}
        </p>
      </div>
    </section>
  );
}

/**
 * Le cadre de navigateur : sans lui, une image de tableau de bord posée nue se
 * lit comme une illustration plutôt que comme un écran.
 */
function CadreNavigateur() {
  return (
    <div className="overflow-hidden rounded-2xl border border-trait bg-paper-creux p-2 shadow-[0_1px_2px_rgba(28,24,21,0.06),0_24px_60px_-28px_rgba(28,24,21,0.35)] sm:rounded-3xl sm:p-2.5">
      <div className="overflow-hidden rounded-xl bg-white sm:rounded-2xl">
        <div className="flex items-center gap-3 bg-ink px-3 py-2.5 sm:px-4">
          <div className="flex shrink-0 gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </div>
          {/* ⚠ Le VRAI domaine : une barre d'adresse inventée est la première
              chose qu'un visiteur attentif remarque. */}
          <div className="min-w-0 flex-1 rounded bg-ink-relief px-3 py-1 text-center">
            <span className="t-data block truncate text-[0.6875rem] text-[#8a7f75]">
              {C.url}
            </span>
          </div>
        </div>

        <Image
          /* ⚠ LE CHEMIN PORTE LA VERSION, ET C'EST DÉLIBÉRÉ. L'optimiseur
             d'images de Next met en cache ses variantes par URL : remplacer un
             fichier SANS changer son chemin laisse servir l'ancienne capture,
             au navigateur comme au CDN, indéfiniment. Mesuré ici même - la page
             a continué d'afficher sept onglets alors que le fichier en portait
             huit. Toute recapture se renomme, ou change de dossier. */
          src="/app-preview/apercu-back-office.png"
          alt={C.altWeb}
          /* Les dimensions RÉELLES du fichier. En déclarer d'autres fausse
             l'espace réservé pendant le chargement, et la page saute. */
          width={2908}
          height={1654}
          sizes="(min-width: 1024px) 730px, 100vw"
          className="block h-auto w-full"
          priority
        />
      </div>
    </div>
  );
}

/**
 * Le cadre du téléphone.
 *
 * ⚠ LE CONTOUR EST NOIR, ET CE N'EST PAS UN CHOIX ESTHÉTIQUE. Les captures sont
 * des copies d'écran d'appareil : leurs quatre coins portent DÉJÀ le masque
 * arrondi de la dalle, en noir opaque (mesuré : 0,0,0 à 40 px du coin, blanc au
 * centre du même bord). Un contour clair laisserait donc apparaître quatre
 * onglets noirs autour de l'écran. Le noir les absorbe.
 */
function CadreTelephone({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-[1.6rem] bg-ink p-1 shadow-[0_1px_2px_rgba(28,24,21,0.06),0_18px_44px_-20px_rgba(28,24,21,0.45)] sm:rounded-[2rem] sm:p-1.5">
      <Image
        src={src}
        alt={alt}
        width={1344}
        height={2992}
        /* Deux téléphones par rangée : la moitié de la colonne de droite au
           palier bureau, la moitié de la largeur de page en dessous. */
        sizes="(min-width: 1024px) 190px, 45vw"
        className="block h-auto w-full rounded-[1.3rem] sm:rounded-[1.6rem]"
      />
    </div>
  );
}
