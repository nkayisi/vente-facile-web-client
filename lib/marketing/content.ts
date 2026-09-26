/**
 * Tout le texte de la page d'accueil, en UN seul endroit.
 *
 * RÈGLE DE CE FICHIER : chaque phrase doit être vraie et vérifiable dans le
 * dépôt. La version précédente de la page affirmait « 10 000+ entreprises »,
 * « Disponible dans 50+ pays », « Conforme SOC 2 » et portait trois témoignages
 * de Paris, Casablanca et Bruxelles, sur un produit conçu pour la RDC. Rien de
 * tout cela n'était fondé, et un commerçant de Kinshasa le voyait en une
 * seconde. Ne pas réintroduire de chiffre, de logo ou de conformité qu'on ne
 * puisse pas montrer.
 *
 * Les achats fournisseurs n'apparaissent nulle part : le backend est complet
 * mais aucun écran n'existe, ni sur le web ni sur le mobile. Les annoncer
 * referait exactement le défaut qu'on corrige.
 */

/**
 * ⚠ TROIS PAGES RÉELLES, PLUS AUCUNE ANCRE.
 *
 * `SiteHeader` est monté sur TOUTES les pages publiques, et une ancre nue comme
 * « #comptoir » résout, depuis /tarifs, en « /tarifs#comptoir » : la cible
 * n'existe pas, le lien ne fait rien, et rien ne le signale. Le passage à des
 * pages ferme ce piège par construction, et donne à chaque page du site trois
 * liens internes vers des URL indexables, ce qu'une ancre ne vaut pas.
 *
 * « Fonctionnalités » plutôt que « Tarifs » : la droite de la barre porte déjà
 * « Ouvrir un compte », donc l'intention d'achat est servie. Ce qui manque à
 * quelqu'un qui arrive sur les mentions légales, c'est de savoir CE QUE FAIT le
 * produit. Les tarifs restent au pied de page et sur l'accueil.
 */
export const NAV = [
  { href: "/", label: "Accueil" },
  { href: "/fonctionnalites", label: "Fonctionnalités" },
  { href: "/contact", label: "Nous joindre" },
] as const;

export const HERO = {
  eyebrow: "Caisse · Stock · Crédit · RDC",
  titre: ["Tenez votre commerce,", "même sans réseau."],
  accroche:
    "Vente Facile est la caisse, le stock et le crédit client de votre boutique. Ça vend en francs et en dollars, ça compte en casiers et en bouteilles, et ça imprime le ticket avant que le réseau ne revienne.",
  ctaPrincipal: "Ouvrir un compte",
  ctaSecondaire: "Voir ce que ça fait",
  preuve: ["14 jours d'essai", "sans carte bancaire", "CDF et USD"],
} as const;

/**
 * L'EXEMPLE DE RAYON de la page, en UN seul endroit.
 *
 * ⚠ LE TOTAL EN UNITÉS EST DÉRIVÉ, JAMAIS RECOPIÉ. « Jamais 43 » a survécu au
 * passage du facteur de 12 à 24 : le titre de la section Conditionnement
 * refusait un nombre que la carte, trois centimètres plus bas, calculait à 79.
 * Rien ne l'a signalé, et c'est la section dont tout le propos est l'exactitude.
 * Deux phrases le citent (ici et dans `RECONNAISSANCES`) ; elles le prennent
 * toutes les deux de `RAYON_UNITES`.
 */
const RAYON = {
  facteur: 24,
  /** ⚠ Le titre de la section cite ces deux nombres en clair : les changer ici
   *  demande de changer la phrase. Le TOTAL, lui, suit tout seul. */
  avant: { casiers: 3, isolees: 7 },
  /** Après ouverture d'un casier. Le total DOIT rester identique : ouvrir un
   *  casier déplace des unités entre les deux compteurs, il n'en crée aucune. */
  apres: { casiers: 2, isolees: 31 },
} as const;

/**
 * Total en unités de détail d'un état du rayon. UNE seule arithmétique pour les
 * phrases de ce fichier et pour la carte qui les illustre : la calculer à deux
 * endroits est très exactement ce qui a produit le « 43 ».
 */
export function unitesDuRayon(p: { casiers: number; isolees: number }) {
  return p.casiers * RAYON.facteur + p.isolees;
}

const RAYON_UNITES = unitesDuRayon(RAYON.avant);

/**
 * Trois situations PARALLÈLES, pas une séquence : aucune numérotation
 * « 01 / 02 / 03 ». Le marqueur est le guillemet, parce que ce sont des
 * phrases de commerçant.
 */
export const RECONNAISSANCES = {
  titre: "Ce que vous dites, et ce que le logiciel en fait.",
  items: [
    {
      dit: "Le réseau tombe à 14 h.",
      fait: "Vous continuez à vendre. Le ticket sort avec son numéro définitif, pas un numéro provisoire que le serveur remplacera. Le client qui revient avec son papier peut prouver son paiement.",
      donnee: "VT-20260920-K7QM-0004",
      legende: "Le numéro imprimé est celui qui restera.",
    },
    {
      dit: "Le client prend 3 casiers et 7 bouteilles.",
      fait: `Le stock l'écrit comme ça, pas « ${RAYON_UNITES} ». Chaque article connaît son conditionnement, son prix de gros et son prix de détail, et un écart d'inventaire se lit par canal.`,
      donnee: "-2 casiers, +5 bouteilles",
      legende: "Un écart d'inventaire, ventilé.",
    },
    {
      dit: "Il paie 20 $ sur une facture en francs.",
      fait: "Le taux est figé sur la vente, pas sur le cours du jour. Sa dette reste dans sa monnaie, la monnaie rendue sort en francs, et aucun écran n'additionne jamais des dollars et des francs.",
      donnee: "1 USD = 2 800 CDF",
      legende: "Le taux du jour de la vente, gardé.",
    },
  ],
} as const;

export const CONDITIONNEMENT = {
  eyebrow: "Conditionnement",
  /** Le nombre REFUSÉ vient de `RAYON_UNITES` : voir la docstring de `RAYON`. */
  titre: `3 casiers + 7 bouteilles. Jamais ${RAYON_UNITES}.`,
  corps: [
    "Au comptoir, on compte ce qu'on peut soulever. Un rayon qui porte trois casiers scellés et sept bouteilles isolées ne se présente pas comme un seul nombre.",
    "Le total en unités existe : il est écrit en dessous, plus petit, parce qu'il sert au réassort et pas à la vente. Ouvrir un casier déplace des unités entre les deux compteurs. Il n'en crée ni n'en détruit.",
  ],
  article: "BOISSON 24 CL",
  ...RAYON,
  uniteGros: "casiers",
  uniteDetail: "bouteilles",
  action: "Ouvrir un casier",
  invariant: "Total inchangé",
} as const;

export const DEVISES = {
  eyebrow: "Multi-devise",
  titre: "Francs et dollars. Jamais additionnés.",
  corps: [
    "Une facture est libellée dans une monnaie. Le règlement peut arriver dans une autre, au taux du jour, et ce taux est figé sur la vente : le chiffre d'affaires d'hier ne bouge plus avec le cours.",
    "Les créances, la caisse et les rapports gardent chaque monnaie dans sa colonne.",
  ],
  /**
   * ⚠ LES DEUX COLONNES NE DÉCRIVENT PAS LA MÊME CHOSE, et l'asymétrie de leurs
   * libellés est DÉLIBÉRÉE : à gauche la FACTURE, libellée en francs ; à droite
   * le RÈGLEMENT, reçu en dollars. Les « harmoniser » est très exactement ce qui
   * a produit l'incohérence d'avant, où la note annonçait une facture soldée
   * pendant que la colonne CDF affichait la totalité en reste dû.
   *
   * C'est aussi le modèle du backend : `Payment.amount` est libellé dans la
   * devise de la VENTE, `tendered_amount` dans celle du billet reçu.
   *
   * ⚠ L'ARITHMÉTIQUE DOIT TOMBER, et le lecteur a tout pour la refaire :
   * 2 250 × 2 800 = 6 300 000, le montant porté à la facture. La version
   * précédente écrivait 6 303 000, qui ne correspond à aucun règlement rond.
   */
  colonnes: [
    {
      code: "CDF",
      libelle: "Facture en francs",
      lignes: [
        { label: "Facturé", valeur: "6 300 000 FC" },
        { label: "Encaissé", valeur: "6 300 000 FC" },
        { label: "Reste dû", valeur: "0 FC" },
      ],
    },
    {
      code: "USD",
      libelle: "Règlement en dollars",
      /**
       * ⚠ LE TAUX VIT DANS SON LIBELLÉ, ET LA VALEUR RESTE UN MONTANT PUR.
       * MESURÉ dans la vraie page, police chargée : la demi-colonne fait 133 px
       * à 390 px de large mais 118 px à 360 px, largeur très répandue sur les
       * Android d'entrée de gamme, qui sont le parc visé. « 1 $ = 2 800 FC »
       * (quatorze caractères de mono à 9 px, donc 126 px) s'y coupait en deux,
       * et « 1 USD = 2 800 CDF » n'aurait tenu sur aucun téléphone. Les trois
       * valeurs sont donc des montants, comme dans la colonne d'en face.
       *
       * ⚠ NE PAS RENDRE LES MONTANTS EUX-MÊMES INSÉCABLES. À 320 px la colonne
       * tombe à 98 px et « 6 300 000 FC » en demande 108 : il s'y replie, ce
       * qui est laid mais lisible. Insécable, il DÉBORDERAIT, donc serait rogné
       * ou pousserait un défilement horizontal. Le repli est le moindre mal, et
       * il est antérieur à ce lot (« 6 303 000 FC » faisait la même longueur).
       *
       * « Monnaie rendue : 0 $ » est une AFFIRMATION, pas un remplissage : elle
       * prouve que le règlement était exact, donc que la facture est soldée.
       */
      lignes: [
        { label: "Reçu", valeur: "2 250,00 $" },
        { label: "Taux figé pour 1\u00a0$", valeur: "2 800 FC" },
        { label: "Monnaie rendue", valeur: "0 $" },
      ],
    },
  ],
  /** Là où un gabarit mettrait un total. C'est le vide qui porte le message. */
  absenceDeTotal: "pas de total commun",
  /**
   * ⚠ LES ESPACES DES MONTANTS SONT INSÉCABLES (`\u00a0`), et ce n'est pas du
   * zèle : MESURÉ à 390 px, « 6 300 000 FC » se coupait entre « 6 300 » et
   * « 000 FC », soit un montant à sept chiffres brisé en deux lignes, sur la
   * carte dont tout le propos est l'exactitude. Ils sont écrits en échappement
   * et non en caractère littéral pour qu'on les VOIE en relisant.
   */
  note: "Le règlement de 2\u00a0250,00\u00a0$ solde la facture de 6\u00a0300\u00a0000\u00a0FC, au taux figé le jour de la vente et non au cours du jour. Les deux colonnes décrivent le même encaissement, et aucun écran ne les additionne.",
} as const;

/**
 * Les huit modules, chacun avec trois PRÉCISIONS.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ⚠ CHACUNE DES VINGT-QUATRE PUCES TOMBE SOUS LA RÈGLE DE CE FICHIER.     │
 * │                                                                          │
 * │ Elles sont tirées d'écrans qui existent, jamais d'un vocabulaire de      │
 * │ brochure : « suivi par lots et numéros de série », « conformité SOC 2 », │
 * │ « synchronisation temps réel » sont exactement le genre de ligne que la  │
 * │ version précédente affichait et que personne ne pouvait montrer.         │
 * │                                                                          │
 * │ ⚠ TROIS PUCES COURTES, PAS TROIS PHRASES. La section a gagné des cartes │
 * │ mais garde l'argument de densité : ce qu'elle doit communiquer reste     │
 * │ l'ÉTENDUE, et huit paragraphes la noieraient.                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export const CAPACITES = {
  eyebrow: "L'ensemble",
  titre: "Et tout ce qui va avec.",
  accroche:
    "Un seul outil, du comptoir au dépôt. Chaque ligne ci-dessous est un écran qui existe aujourd'hui.",
  items: [
    {
      icone: "panier",
      label: "Point de vente",
      ligne: "Encaisser au comptoir, avec ou sans réseau.",
      details: [
        "Remise par ligne ou sur le total, plafonnée",
        "Panier mis en attente, repris plus tard",
        "Vente à crédit, points de fidélité déduits",
      ],
    },
    {
      icone: "colis",
      label: "Stock",
      ligne: "Plusieurs dépôts, et ce qui circule entre eux.",
      details: [
        "Transferts et ajustements, en deux temps",
        "Déconditionnement : ouvrir un casier",
        "Chaque mouvement garde son avant et son après",
      ],
    },
    {
      icone: "presse-papier",
      label: "Inventaire",
      ligne: "Compter le rayon, et n'appliquer qu'après.",
      details: [
        "Session totale, par catégorie ou par article",
        "Feuille de comptage utilisable au dépôt",
        "Écart ventilé entre gros et détail",
      ],
    },
    {
      icone: "clients",
      label: "Clients",
      ligne: "Le crédit, tenu dans la monnaie de la facture.",
      details: [
        "Plafond par client, opposé à la vente",
        "Balance âgée : 0-30, 30-60, 60-90, 90+",
        "Numéro appelable depuis la fiche",
      ],
    },
    {
      icone: "caisse",
      label: "Caisse",
      ligne: "Le tiroir, devise par devise.",
      details: [
        "Entrées, sorties et dépenses catégorisées",
        "Clôture Z avec comptage du tiroir",
        "Reçu de dépense imprimé sur place",
      ],
    },
    {
      icone: "document",
      label: "Devis et retours",
      ligne: "Ce qui précède la vente, et ce qui la défait.",
      details: [
        "Devis daté, converti en vente en un geste",
        "Retour rattaché à sa ligne de facture",
        "Rien ne bouge avant une approbation",
      ],
    },
    {
      icone: "graphique",
      label: "Rapports",
      ligne: "Huit vues, sur la période que vous choisissez.",
      details: [
        "Ventes, produits, clients, stock, bénéfices",
        "Export PDF, Excel ou CSV",
        "Le même document depuis le web ou le terminal",
      ],
    },
    {
      icone: "bouclier",
      label: "Équipe",
      ligne: "Qui peut faire quoi, et qui a fait quoi.",
      details: [
        "Quatre rôles, et une permission par action",
        "Périmètre par dépôt et par utilisateur",
        "Appareils enrôlés, révocables à distance",
      ],
    },
  ],
} as const;

/**
 * Ce qui se passe après « Ouvrir un compte ».
 *
 * La page ne le disait nulle part : elle décrivait le produit, son prix et ses
 * limites, et laissait le lecteur deviner le chemin. Trois étapes, et non
 * quatre comme l'ancienne version - c'est aussi le nombre de vues de la
 * présentation du terminal, et les deux surfaces racontent la même entrée.
 */
export const DEMARRAGE = {
  eyebrow: "Démarrer",
  titre: "Trois étapes, et vous vendez.",
  accroche:
    "Aucune installation sur un serveur, aucun technicien. Le back-office s'ouvre dans un navigateur, l'application se télécharge sur le terminal.",
  etapes: [
    {
      numero: "01",
      titre: "Ouvrez votre compte",
      corps:
        "Deux minutes, sans carte bancaire. L'essai dure quatorze jours et donne accès à tout.",
    },
    {
      numero: "02",
      titre: "Montez votre catalogue",
      corps:
        "Article par article, ou par import Excel. Les erreurs du fichier sont rendues ligne par ligne, pour que vous corrigiez plutôt que de recommencer.",
    },
    {
      numero: "03",
      titre: "Ouvrez la caisse",
      corps:
        "Installez l'application sur le terminal, comptez votre fonds, vendez. Ce qui est encaissé hors ligne remonte dès que le réseau revient.",
    },
  ],
} as const;

/**
 * La capture de l'application, en bande sous le hero.
 *
 * ⚠ LE DOMAINE EST LE VRAI. La version précédente écrivait
 * « app.ventefacile.com », qui n'existe pas. C'est la seule page que
 * `robots.index` autorise à être indexée, et la règle en tête de ce fichier
 * vaut aussi pour une barre d'adresse dessinée.
 */
export const CAPTURE = {
  eyebrow: "Bureau et comptoir",
  titre: "Le même établissement, sur tous vos écrans.",
  accroche:
    "Le back-office s'ouvre dans un navigateur, l'application sur le terminal de caisse. Les deux lisent le même établissement : ci-dessous, ce sont les mêmes chiffres, le même jour.",

  url: "vente-facile.net/dashboard",
  altWeb:
    "Le tableau de bord de Vente Facile dans un navigateur : ventes totales, nombre de clients, unités vendues, bénéfice brut, l'évolution des ventes et les encaissements par devise.",

  mobileTitre: "Sur le terminal",
  mobileNote:
    "L'application suit le thème du terminal, ou celui que vous lui imposez.",
  mobiles: [
    {
      cle: "clair",
      src: "/app-preview/mobile-light.png",
      legende: "Thème clair",
      alt: "Le même tableau de bord dans l'application Android, en thème clair, avec ses onglets Accueil, Caisse, POS, Stock et Paramètres.",
    },
    {
      cle: "sombre",
      src: "/app-preview/mobile-dark.png",
      legende: "Thème sombre",
      alt: "Le même tableau de bord dans l'application Android, en thème sombre.",
    },
  ],
} as const;

export const TERMINAL = {
  eyebrow: "Sur le comptoir",
  titre: "L'application tient sur le terminal de caisse.",
  corps: [
    "Android, conçue pour travailler hors ligne, pas « avec un mode hors ligne ». La base vit sur l'appareil.",
    "Les ventes partent quand le réseau revient, une par une, avec un verdict par opération : une vente refusée ne condamne pas les deux cents autres.",
    "Impression sur l'imprimante intégrée du terminal, sur une 58 mm Bluetooth, ou en PDF à partager. Le même document dans les trois cas.",
  ],
  verdictsTitre: "Un verdict par opération",
  verdictsNote:
    "Ce que le serveur répond à chaque vente envoyée. Rien n'est traité par lot : c'est ce qui empêche une seule opération fautive d'emporter la journée.",
  verdicts: [
    { code: "appliquée", ton: "ok" as const, sens: "Enregistrée sur le serveur." },
    { code: "doublon", ton: "ok" as const, sens: "Déjà reçue. Renvoyer après une coupure reste sûr." },
    { code: "refusée", ton: "refus" as const, sens: "Refus définitif. Mise de côté, avec son motif." },
    { code: "à réessayer", ton: "attente" as const, sens: "Incident passager. Repart seule, un peu plus tard." },
    { code: "bloquée", ton: "attente" as const, sens: "Abonnement ou droit manquant. Conservée telle quelle." },
  ],
} as const;

export const TARIFS = {
  eyebrow: "Tarifs",
  titre: "Un prix, sans surprise.",
  accroche:
    "Tous les plans donnent accès à l'ensemble des fonctions. Ce qui change, ce sont les volumes : points de vente, utilisateurs, articles, transactions.",
  mensuel: "Mensuel",
  annuel: "Annuel",
  populaire: "Le plus choisi",
  gratuit: "Gratuit",
  surMesure: "Sur mesure",
  ctaEssai: "Commencer l'essai",
  ctaPlan: "Continuer avec ce plan",
  note: "Paiement par Mobile Money. Vous ne payez qu'à la fin de l'essai.",
  indisponible:
    "Les tarifs ne se chargent pas pour le moment. Vous pouvez quand même ouvrir un compte : l'essai dure quatorze jours.",
} as const;

/**
 * Six questions. Les réponses NOMMENT les limites : c'est ce qui rend une FAQ
 * crédible, et c'est ce que l'ancienne version ne faisait nulle part.
 */
export const QUESTIONS = {
  eyebrow: "Questions",
  titre: "Ce qu'on nous demande avant de signer.",
  items: [
    {
      q: "Est-ce que ça marche vraiment sans internet ?",
      r: "Oui. L'application du terminal garde ses données sur l'appareil : vous vendez, vous encaissez, vous imprimez. Chaque opération part dès que le réseau revient et reçoit une réponse individuelle. Une limite à connaître : si deux terminaux vendent le dernier article au même moment hors ligne, le second sera refusé après coup. L'application le dit, nomme l'opération, et vous laisse la corriger.",
    },
    {
      q: "Sur quel matériel ?",
      r: "Un terminal de caisse Android avec imprimante intégrée, ou n'importe quel téléphone avec une imprimante 58 mm Bluetooth. Le back-office s'ouvre dans un navigateur, sur ordinateur comme sur téléphone. Sans imprimante, le ticket sort en PDF à partager.",
    },
    {
      q: "Comment je paie l'abonnement ?",
      r: "Par Mobile Money. Vous commencez par l'essai, sans carte bancaire ; le paiement n'arrive qu'après.",
    },
    {
      q: "Mes données sont-elles en sécurité ?",
      r: "Les échanges sont chiffrés, les données sauvegardées, et chaque compte n'accède qu'à son établissement. À l'intérieur, vous décidez qui peut faire quoi, action par action, et chaque écriture laisse une trace nominative.",
    },
    {
      q: "Puis-je importer mon catalogue ?",
      r: "Oui, depuis un fichier Excel, dans le back-office. Les erreurs sont rendues ligne par ligne, pour que vous corrigiez le fichier plutôt que de recommencer.",
    },
    {
      q: "Je gère plusieurs boutiques ?",
      r: "Oui : plusieurs dépôts, plusieurs caisses, et un périmètre par utilisateur. Un magasinier ne voit que les dépôts qui lui sont confiés, et un caissier ne voit que ses propres ventes si vous le décidez.",
    },
  ],
} as const;

export const FINAL = {
  titre: "Ouvrez votre caisse cette semaine.",
  accroche:
    "Quatorze jours, sans carte bancaire. Vous montez votre catalogue, vous vendez, vous décidez après.",
  cta: "Ouvrir un compte",
  dejaClient: "J'ai déjà un compte",
} as const;

/**
 * PIED DE PAGE : uniquement des destinations qui EXISTENT.
 * L'ancienne version pointait vers /contact, /docs, /help, /blog, /api,
 * /about, /integrations, /changelog, /privacy et /terms : neuf routes sur
 * treize renvoyaient un 404.
 */
export const PIED = {
  phrase:
    "La caisse, le stock et le crédit client, dans un seul outil. Conçu pour les commerces de la RDC.",
  colonnes: [
    {
      titre: "Produit",
      liens: [
        { href: "/fonctionnalites", label: "Fonctionnalités" },
        { href: "/caisse-hors-ligne", label: "La caisse hors ligne" },
        { href: "/tarifs", label: "Tarifs" },
        { href: "/#questions", label: "Questions" },
      ],
    },
    {
      titre: "Compte",
      liens: [
        { href: "/auth/register", label: "Créer un compte" },
        { href: "/auth/login", label: "Connexion" },
        { href: "/auth/forgot-password", label: "Mot de passe oublié" },
      ],
    },
    {
      titre: "Entreprise",
      liens: [
        { href: "/contact", label: "Nous joindre" },
        { href: "/mentions-legales", label: "Mentions légales" },
        { href: "/politique-de-confidentialite", label: "Confidentialité" },
      ],
    },
  ],
  mention: "Conçu pour les commerces de la RDC",
} as const;

/** Le panier que joue la démo du hero. Les montants sont cohérents entre eux. */
export const DEMO = {
  tauxLigne: "1 USD = 2 800 CDF",
  articles: [
    { code: "CASIER 24×", nom: "Boisson 24 cl", detail: "1 casier", pu: "62 000", total: "62 000" },
    { code: "SAVON", nom: "Savon de ménage", detail: "12 pièces", pu: "1 500", total: "18 000" },
  ],
  totalCdf: "80 000 FC",
  totalUsd: "28,57 $",
  reference: "VT-20260920-K7QM-0004",
  etats: {
    synchro: "Synchronisé",
    horsLigne: "Hors ligne",
    enAttente: "1 vente en attente d'envoi",
  },
  /** Décrit l'animation pour les lecteurs d'écran, qui ne la voient pas. */
  resume:
    "Démonstration : deux articles entrent au panier, le réseau se coupe, la vente est encaissée et le ticket s'imprime malgré tout, puis la vente remonte au serveur dès le retour du réseau.",
} as const;
