/**
 * Le texte des pages publiques AUTRES que l'accueil, en UN seul endroit.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ MÊME RÈGLE QUE `content.ts` : CHAQUE PHRASE DOIT ÊTRE VRAIE ET           │
 * │ VÉRIFIABLE DANS LE DÉPÔT.                                                │
 * │                                                                          │
 * │ Pas un chiffre d'adoption, pas un logo de client, pas une conformité     │
 * │ qu'on ne puisse pas montrer. Un commerçant de Kinshasa voit une          │
 * │ exagération en une seconde, et il n'y revient pas.                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LES ACHATS FOURNISSEURS N'APPARAISSENT NULLE PART. Le backend est complet,
 * aucun écran n'existe, ni sur le web ni sur le mobile. Les annoncer referait
 * exactement le défaut que `content.ts` a corrigé.
 *
 * ⚠ CES PAGES NE RECOPIENT PAS L'ACCUEIL. Là où l'accueil montre une grille de
 * huit modules avec trois puces chacun, /fonctionnalites en donne la PROSE que
 * l'accueil n'a pas : c'est ce texte propre qui distingue les deux URL, sans
 * quoi elles se concurrenceraient sur les mêmes requêtes.
 */

/* ────────────────────────────── /caisse-hors-ligne ────────────────────────── */

export const HORS_LIGNE = {
  eyebrow: "Sans réseau",
  titre: "Vendre sans réseau, et imprimer quand même.",
  accroche:
    "Le réseau tombe, la boutique reste ouverte. Vente Facile n'attend pas la connexion pour encaisser : la base vit sur le terminal, le ticket sort tout de suite, et tout remonte quand le réseau revient.",

  sections: [
    {
      titre: "La base vit sur l'appareil, pas sur le serveur.",
      corps: [
        "L'application du terminal n'est pas un site web avec un mode dégradé : elle est conçue pour travailler hors ligne. Le catalogue, les stocks, les clients et leurs dettes sont sur l'appareil. Une vente se compose, s'encaisse et s'imprime sans qu'aucune requête ne parte.",
        "Ce qui change, c'est le moment où le serveur l'apprend. Les opérations s'accumulent dans un journal local et partent dès que la connexion revient, sans que le caissier ait à y penser.",
      ],
    },
    {
      titre: "Le numéro du ticket est définitif dès l'impression.",
      corps: [
        "Chaque terminal reçoit un code à quatre caractères lors de son enrôlement, et tient sa propre série. Un ticket sort sous un numéro comme VT-20260920-K7QM-0004, et ce numéro ne changera jamais.",
        "C'est le point qui compte au comptoir : un client qui revient avec son papier peut prouver son paiement. Un numéro provisoire que le serveur remplacerait plus tard rendrait ce papier muet.",
      ],
    },
    {
      titre: "Un verdict par opération, jamais par lot.",
      corps: [
        "À la synchronisation, le serveur répond à chaque opération séparément. Une vente refusée ne condamne pas les deux cents autres, et rien n'est traité en bloc.",
        "Une opération refusée est mise de côté avec son motif, sur un écran qui la nomme. Elle ne repart pas toute seule, et elle ne disparaît pas non plus.",
      ],
    },
    {
      titre: "Le comptoir déduit ses propres ventes en attente.",
      corps: [
        "Tant qu'une vente n'est pas partie, le stock affiché tient déjà compte d'elle. Sans cela, le terminal opposerait le stock du dernier tirage à chaque nouveau client, et le même dernier casier se vendrait autant de fois qu'il se présenterait d'acheteurs.",
        "La même règle vaut pour le crédit : une vente à crédit encore en file entre dans le plafond du client avant d'avoir atteint le serveur.",
      ],
    },
  ],

  limiteTitre: "Ce que le hors-ligne ne peut pas faire.",
  limite: [
    "Si deux terminaux vendent le dernier article au même moment, sans réseau, le second sera refusé après coup : le client sera parti, et le ticket imprimé. Aucune architecture hors ligne n'évite cela, et prétendre le contraire serait faux.",
    "L'application le dit plutôt que de le taire : elle nomme l'opération, donne son motif, et laisse la corriger.",
    "Les rapports, eux, exigent le réseau. Leurs chiffres sont calculés par le serveur ; les recalculer sur le terminal donnerait deux résultats pour le même établissement, sans moyen de savoir lequel croire.",
  ],

  materielTitre: "Sur quel matériel.",
  materiel: [
    { label: "Terminal de caisse Android", corps: "Avec son imprimante intégrée. C'est le poste du comptoir." },
    { label: "Téléphone Android", corps: "Avec une imprimante 58 mm en Bluetooth, classique ou BLE." },
    { label: "Sans imprimante", corps: "Le ticket sort en PDF, à envoyer par message. Le même document dans les trois cas." },
  ],
} as const;

/* ────────────────────────────── /fonctionnalites ──────────────────────────── */

/**
 * Un paragraphe par module, dans l'ordre de `CAPACITES.items` de `content.ts`.
 *
 * ⚠ La clé est le `label` du module : elle RELIE ce texte à la grille de
 * l'accueil au lieu de la dupliquer. Un module ajouté là-bas sans texte ici se
 * verra, puisque la page n'affichera rien sous son titre.
 */
export const MODULES_DETAIL: Record<string, readonly string[]> = {
  "Point de vente": [
    "L'écran de vente montre le catalogue, accepte le scan d'un code-barres, et compose le panier. Un sélecteur de quantité distingue le gros du détail : on vend trois casiers, ou sept bouteilles, ou les deux, et l'on peut ouvrir un casier pour servir au détail.",
    "L'encaissement accepte plusieurs devises, rend la monnaie, applique une remise plafonnée par l'établissement, déduit des points de fidélité et inscrit une vente à crédit. Un panier peut être mis en attente et repris plus tard.",
  ],
  Stock: [
    "Un transfert naît en brouillon : le stock ne bouge qu'à l'expédition, puis à la réception, qui peut être partielle. Un ajustement suit le même chemin, et n'est appliqué qu'après approbation.",
    "Chaque mouvement conserve la quantité d'avant et celle d'après. Le déconditionnement ouvre un contenant pour reverser son contenu au détail, sans rien créer ni détruire.",
  ],
  Inventaire: [
    "Une session d'inventaire porte sur tout un dépôt, sur des catégories, ou sur une liste d'articles. Le serveur engendre la feuille de comptage avec le stock théorique du moment, et verrouille les articles concernés : ils cessent d'être vendables tant que le comptage dure.",
    "La feuille se remplit au fond du dépôt, sans réseau. L'écart est ventilé par canal, « -2 casiers, +5 bouteilles », parce qu'un manquant de scellés et un surplus d'unités isolées se compensent dans un total et y disparaissent.",
  ],
  Clients: [
    "Le crédit est tenu dans la devise de la facture. Un client qui doit en francs et paie en dollars voit sa dette diminuer là où elle est, et aucun écran n'additionne jamais deux monnaies.",
    "Un plafond par client est opposé à la vente, au comptoir comme au bureau. Un règlement solde les factures ouvertes de la plus ancienne à la plus récente, et l'écran annonce cette imputation avant de la faire. La balance âgée range les créances en 0-30, 30-60, 60-90 et 90 jours et plus.",
  ],
  Caisse: [
    "Le livre de caisse suit le tiroir, devise par devise : entrées, sorties, dépenses catégorisées, avec leur reçu imprimé sur place. Une dépense passe par une approbation avant que l'argent ne sorte.",
    "La clôture Z compte le tiroir par devise et se tire au comptoir, à la fermeture, même sans réseau. Le papier porte déjà son numéro définitif.",
  ],
  "Devis et retours": [
    "Un devis porte une date de validité et n'engage pas le stock : la réservation n'a lieu qu'à la conversion, qui inscrit une dette comme une vente à crédit.",
    "Un retour se crée depuis sa vente, et chaque ligne désigne une ligne de facture. Il naît en brouillon : ni le stock ni la caisse ne bougent avant une approbation. La marchandise revient en rayon, ou non, et c'est une case à cocher.",
  ],
  Rapports: [
    "Huit vues sur la période que vous choisissez : ventes, produits, clients, stock, bénéfices, trésorerie, rapport journalier et activité par employé. Les montants sont ramenés à la devise principale au taux figé sur chaque facture, jamais au cours du jour.",
    "Chaque vue s'exporte en PDF, en classeur Excel ou en CSV. Le document est fabriqué par le serveur : celui qu'on télécharge du bureau et celui qu'on partage depuis le terminal sont le même fichier.",
  ],
  "Équipe": [
    "Quatre rôles, et une permission par action. Un caissier ne voit que ses propres ventes, un magasinier ne voit que ses dépôts, et ce périmètre s'applique aux écrans, aux rapports et aux documents exportés de la même façon.",
    "Chaque terminal est enrôlé sous son propre code et peut être révoqué à distance. Un appareil perdu ne promeut personne et ne révoque personne.",
  ],
};

/**
 * La prose d'un module, ou une erreur.
 *
 * ⚠ ELLE LÈVE, ET C'EST VOULU. Rendre une chaîne vide afficherait un titre de
 * module suivi de rien : la page paraîtrait complète et serait amputée, ce qui
 * est exactement le genre de défaut qu'on ne voit qu'une fois en ligne.
 */
export function detailDuModule(label: string): readonly string[] {
  const prose = MODULES_DETAIL[label];

  if (!prose) {
    throw new Error(
      `Le module « ${label} » de CAPACITES n'a pas de prose dans MODULES_DETAIL. ` +
        `Ajoutez-la : /fonctionnalites rendrait sinon son titre sans texte.`,
    );
  }

  return prose;
}

export const FONCTIONNALITES = {
  eyebrow: "Fonctionnalités",
  titre: "Tout ce que Vente Facile fait.",
  accroche:
    "Un logiciel de caisse, de gestion de stock et de crédit client, pour les commerces de la RDC. Huit modules, et chacun est un écran qui existe aujourd'hui.",
} as const;

/* ────────────────────────────────── /tarifs ───────────────────────────────── */

export const PAGE_TARIFS = {
  // « Abonnement » et non « Tarifs » : la grille réemployée de l'accueil porte
  // déjà son propre sur-titre « Tarifs », et le fil d'Ariane aussi. Trois fois
  // le même mot en haut d'une page se lit comme un défaut de rendu.
  eyebrow: "Abonnement",
  titre: "Le prix de Vente Facile.",
  // ⚠ NE PAS reprendre ici la phrase de `TARIFS.accroche` : la grille est juste
  // en dessous et la porte déjà. Deux accroches presque identiques à deux blocs
  // d'écart se lisent comme un défaut de rendu.
  accroche:
    "Quatorze jours d'essai, sans carte bancaire et sans engagement. Ensuite, un abonnement mensuel ou annuel, réglé par Mobile Money.",

  compteTitre: "Ce qui est compté.",
  compteNote:
    "Aucune fonction n'est réservée à un plan supérieur. Ce sont les volumes qui distinguent les offres.",
  compte: [
    "Le nombre de points de vente et de dépôts",
    "Le nombre d'utilisateurs nommés",
    "Le nombre d'articles au catalogue",
    "Le nombre de transactions par mois",
    "L'espace de stockage des images d'articles",
  ],

  paiementTitre: "Comment on paie.",
  paiement: [
    "Par Mobile Money, depuis la page d'abonnement du back-office ou depuis le terminal. Le paiement part chez l'opérateur, vous validez sur votre téléphone, et l'abonnement s'active dès la confirmation.",
    "Aucune carte bancaire n'est demandée pour commencer : l'essai dure quatorze jours et le paiement n'arrive qu'après.",
  ],
  operateurs: ["Airtel Money", "Orange Money", "M-Pesa", "Afrimoney"],
} as const;

/* ────────────────────────────────── /contact ──────────────────────────────── */

export const CONTACT = {
  eyebrow: "Nous joindre",
  titre: "Parlons de votre comptoir.",
  accroche:
    "Une question sur le produit, une démonstration, ou de l'aide sur une caisse déjà en service : le plus rapide est le téléphone ou WhatsApp.",

  reseauxTitre: "Nous suivre",
  reseauxNote:
    "Des démonstrations du logiciel, et les nouveautés au fur et à mesure.",
  adresseTitre: "Nous rendre visite",
  adresseNote:
    "Passez de préférence après nous avoir appelés : nous sommes souvent en installation chez des marchands.",
} as const;

/* ─────────────────────────────── /mentions-legales ────────────────────────── */

/**
 * ⚠ CE QUI MANQUE EST OMIS, PAS INVENTÉ. La forme juridique, le RCCM, l'ID Nat
 * et le NIF ne sont pas renseignés dans `lib/seo/entreprise.ts` : leurs lignes
 * ne s'affichent pas. Les écrire au hasard dans des mentions légales serait une
 * fausse déclaration, et c'est la page où cela se paie le plus cher.
 */
export const MENTIONS = {
  eyebrow: "Informations légales",
  titre: "Mentions légales.",
  accroche:
    "Qui édite ce site, qui l'héberge, et dans quelles conditions il est mis à votre disposition.",
  majLe: "26 septembre 2026",

  editeurTitre: "Éditeur du site",
  hebergeurTitre: "Hébergement",
  hebergeurNote:
    "Le site est hébergé sur un serveur privé virtuel. Les données de votre établissement sont conservées sur cette infrastructure.",

  sections: [
    {
      titre: "Objet du service",
      corps: [
        "Vente Facile est un logiciel de gestion commerciale proposé en ligne : point de vente, gestion de stock, crédit client, livre de caisse et rapports. Il comprend une application web accessible par navigateur et une application Android destinée aux terminaux de caisse.",
        "L'accès au service est soumis à un abonnement, précédé d'une période d'essai. Les conditions tarifaires en vigueur sont publiées sur la page des tarifs.",
      ],
    },
    {
      titre: "Propriété intellectuelle",
      corps: [
        "Le logiciel Vente Facile, sa marque, ses interfaces, ses textes et ses éléments graphiques sont la propriété de l'éditeur. Toute reproduction ou réutilisation, totale ou partielle, sans autorisation écrite préalable, est interdite.",
        "Les données que vous saisissez dans le logiciel, elles, restent les vôtres : catalogue, clients, ventes, stocks et documents. L'éditeur ne s'en attribue aucun droit de propriété.",
      ],
    },
    {
      titre: "Disponibilité et responsabilité",
      corps: [
        "L'éditeur met en oeuvre les moyens raisonnables pour assurer la disponibilité du service, sans pouvoir garantir une continuité absolue : une interruption peut résulter d'une maintenance, d'une panne d'hébergement ou d'une coupure de réseau.",
        "L'application Android est conçue pour continuer à encaisser et à imprimer sans connexion, et pour remonter les opérations lorsque le réseau revient. Cette conception réduit l'effet d'une coupure, elle ne l'annule pas.",
        "L'éditeur ne saurait être tenu responsable d'une perte de données résultant d'un usage non conforme, d'une désinstallation de l'application avant synchronisation, ou de la perte d'un terminal non déclaré.",
      ],
    },
    {
      titre: "Liens et services tiers",
      corps: [
        "Le paiement de l'abonnement s'effectue par Mobile Money, au moyen d'un prestataire de paiement. Les échanges avec ce prestataire relèvent de ses propres conditions.",
        "Le site ne comporte ni publicité, ni régie, ni mesure d'audience.",
      ],
    },
    {
      titre: "Données personnelles",
      corps: [
        "Le traitement des données personnelles est décrit dans la politique de confidentialité, accessible depuis le pied de page. Elle précise ce qui est collecté, pourquoi, pendant combien de temps, et à qui ces données sont confiées.",
      ],
    },
    {
      titre: "Droit applicable",
      corps: [
        "Le présent site et le service qu'il présente sont régis par le droit de la République Démocratique du Congo. Tout différend relève de la compétence des juridictions de Kinshasa, à défaut de résolution amiable.",
      ],
    },
  ],
} as const;

/* ──────────────────── /politique-de-confidentialite ──────────────────────── */

/**
 * ⚠ CETTE PAGE DÉCRIT CE QUE LE LOGICIEL FAIT RÉELLEMENT, pas ce qu'il serait
 * confortable d'écrire. Trois points ont été vérifiés dans le dépôt avant d'être
 * affirmés ici : le rapport d'erreur passe par Sentry et il est ACTIF en
 * production, l'enregistrement de session y est désactivé, et le site ne pose
 * que des cookies d'authentification. Une politique qui promettrait davantage
 * serait un document faux, et c'est le seul type de texte où cela se sanctionne.
 */
export const CONFIDENTIALITE = {
  eyebrow: "Vos données",
  titre: "Politique de confidentialité.",
  accroche:
    "Ce que Vente Facile collecte, pourquoi, combien de temps, et à qui ces données sont confiées. Sans détour et sans clause qui ne s'applique pas.",
  majLe: "26 septembre 2026",

  sections: [
    {
      titre: "Deux rôles distincts, et la différence compte",
      corps: [
        "Pour les données de votre COMPTE et de votre établissement (votre nom, votre adresse électronique, votre abonnement), l'éditeur décide de ce qui est collecté : il en est responsable.",
        "Pour les données que VOUS saisissez dans le logiciel, c'est l'inverse. Vos clients, leurs numéros de téléphone, leurs soldes de crédit, vos ventes et vos stocks vous appartiennent : l'éditeur ne fait que les héberger et les traiter pour votre compte, selon vos instructions. Il ne les exploite à aucune autre fin, ne les revend pas, et ne les communique à personne.",
      ],
    },
    {
      titre: "Ce qui est collecté",
      corps: [
        "Compte et établissement : nom, adresse électronique, mot de passe (conservé sous forme d'empreinte, jamais en clair), rôle, ainsi que les informations de l'établissement que vous renseignez.",
        "Données d'exploitation : le catalogue, les stocks, les clients et leurs dettes, les ventes, les mouvements de caisse et les documents imprimés. Ce sont les données du métier, celles pour lesquelles le logiciel existe.",
        "Journal d'activité : pour les actions sensibles, le logiciel enregistre l'auteur, la date, la nature de l'action, l'adresse IP et le navigateur employé. C'est ce qui permet de répondre à « qui a annulé cette vente ».",
        "Terminaux enrôlés : un identifiant d'appareil, un code court, et l'empreinte d'un jeton. Aucun mot de passe n'est conservé sur le terminal.",
        "Paiement : lors du règlement d'un abonnement, le numéro de téléphone Mobile Money, le montant et la référence de la transaction. Aucune donnée de carte bancaire n'est demandée ni conservée.",
      ],
    },
    {
      titre: "À qui ces données sont confiées",
      corps: [
        "Hébergeur : les serveurs qui font tourner le service et la base de données.",
        "Prestataire de paiement Mobile Money : il reçoit le numéro et le montant nécessaires à la transaction, et lui seul.",
        "Service de rapport d'incident (Sentry) : lorsqu'une erreur survient, un rapport technique est envoyé pour permettre la correction. L'enregistrement des sessions de navigation y est DÉSACTIVÉ. Un tel rapport peut néanmoins contenir des éléments techniques de contexte, comme l'adresse d'une page ou un message d'erreur.",
        "En dehors de ces trois cas, aucune donnée n'est transmise à un tiers. Il n'y a ni régie publicitaire, ni courtier en données, ni revente.",
      ],
    },
    {
      titre: "Cookies",
      corps: [
        "Le site ne pose que les cookies nécessaires à votre connexion : ils maintiennent votre session et protègent les formulaires contre la falsification de requête. Ils sont inaccessibles au JavaScript de la page.",
        "Il n'y a aucun cookie publicitaire, aucun traceur, et aucune mesure d'audience. C'est la raison pour laquelle ce site ne vous demande pas votre consentement par un bandeau : il n'a rien à faire accepter.",
      ],
    },
    {
      titre: "Combien de temps",
      corps: [
        "Les données de votre établissement sont conservées tant que votre compte existe : un logiciel de caisse sert précisément à retrouver une vente ancienne, et les obligations comptables imposent de les garder.",
        "Le journal d'activité est conservé pour permettre les vérifications a posteriori. Les rapports d'incident techniques sont conservés par le service de rapport selon sa propre durée de rétention.",
        "À la fermeture définitive d'un compte, une demande de suppression peut être adressée par écrit à l'adresse de contact.",
      ],
    },
    {
      titre: "Sécurité",
      corps: [
        "Les échanges avec le service passent par une connexion chiffrée. Les mots de passe ne sont jamais conservés en clair. L'accès est gouverné par des rôles et des permissions : un caissier ne voit ni les rapports, ni les données des autres dépôts.",
        "Les terminaux sont enrôlés individuellement et peuvent être révoqués à distance en cas de perte. L'application Android empêche la sauvegarde de ses données par le système et la capture de ses écrans.",
        "⚠ À connaître : la base de données locale d'un terminal n'est pas chiffrée. Un appareil volé donne accès à son contenu tant qu'il n'est pas révoqué. Révoquez un terminal perdu sans attendre, depuis le back-office.",
      ],
    },
    {
      titre: "Vos droits",
      corps: [
        "Vous pouvez demander l'accès aux données qui vous concernent, leur rectification, leur suppression, ou une copie exploitable de vos données d'exploitation. Le back-office permet déjà d'exporter vos rapports et votre catalogue aux formats PDF, Excel et CSV.",
        "Pour toute demande, écrivez à l'adresse de contact indiquée ci-dessous. Précisez l'établissement concerné, afin que la demande puisse être rattachée au bon compte.",
      ],
    },
    {
      titre: "Modifications",
      corps: [
        "Cette politique peut évoluer avec le logiciel. La date de dernière mise à jour figure en tête de page. Un changement qui élargirait la collecte ou ajouterait un destinataire sera signalé dans l'application.",
      ],
    },
  ],
} as const;
