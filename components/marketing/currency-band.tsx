import { DEVISES as D } from "@/lib/marketing/content";
import { Reveal } from "./reveal";

/**
 * Deux colonnes qui ne s'ADDITIONNENT jamais.
 *
 * Elles se rencontrent, en revanche, et c'est le propos : la même vente y est
 * écrite deux fois, une facture en francs et le règlement en dollars qui la
 * solde. Ce qui n'existe nulle part, c'est leur somme.
 *
 * ⚠ Les libellés des deux colonnes DIFFÈRENT parce qu'elles ne décrivent pas la
 * même chose. Voir `DEVISES.colonnes` dans content.ts avant de les aligner.
 *
 * Le geste de design est une ABSENCE : là où un gabarit poserait un total
 * général sous les deux colonnes, il n'y a qu'une mention en petites
 * capitales, « pas de total commun ». C'est le vide qui porte le message, et
 * c'est la règle la plus répétée de tout le produit.
 */
export function CurrencyBand() {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:items-center lg:gap-20">
        <Reveal>
          <p className="t-eyebrow text-braise-texte">{D.eyebrow}</p>
          <h2 className="t-h2 mt-5 text-encre">{D.titre}</h2>
          {D.corps.map((p) => (
            <p key={p} className="t-body mt-5 max-w-[42ch] text-encre-faible">
              {p}
            </p>
          ))}
        </Reveal>

        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-trait bg-white">
            <div className="grid grid-cols-2">
              {D.colonnes.map((col, i) => (
                <div
                  key={col.code}
                  className={i === 0 ? "border-r border-trait p-5 sm:p-6" : "p-5 sm:p-6"}
                >
                  <p className="t-data text-[0.9375rem] font-semibold text-encre">
                    {col.code}
                  </p>
                  <p className="mt-0.5 text-[0.75rem] text-encre-ombre">{col.libelle}</p>

                  <dl className="mt-5 space-y-3">
                    {col.lignes.map((l) => (
                      <div key={l.label}>
                        <dt className="text-[0.75rem] text-encre-ombre">{l.label}</dt>
                        <dd className="t-data mt-0.5 text-[0.9375rem] text-encre">
                          {l.valeur}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>

            {/* Le vide. Le filet dit qu'on attend une somme ; la mention dit
                qu'il n'y en aura pas. */}
            <div className="border-t border-trait bg-paper-creux px-5 py-4 text-center sm:px-6">
              <p className="t-eyebrow text-[0.6875rem] text-encre-ombre">
                {D.absenceDeTotal}
              </p>
            </div>
          </div>

          <p className="mt-4 max-w-[46ch] text-[0.8125rem] leading-relaxed text-encre-ombre">
            {D.note}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
