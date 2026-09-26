import { getPublicPlans } from "@/actions/subscription.actions";

import { Pricing } from "./pricing";

/**
 * La grille de tarifs, servie par le backend.
 *
 * Extraite de la page d'accueil pour que /tarifs la réemploie : deux chargeurs
 * finiraient par trier différemment, ou par ne pas traiter le même échec.
 *
 * `getPublicPlans` rattrape ses propres erreurs et rend `success: false` : un
 * backend arrêté donne une section vide qui PARLE, jamais une page cassée.
 */
export async function SectionTarifs({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const reponse = await getPublicPlans();

  const plans =
    reponse.success && reponse.data
      ? [...reponse.data].sort((a, b) => a.sort_order - b.sort_order)
      : [];

  return <Pricing plans={plans} isAuthenticated={isAuthenticated} />;
}
