/**
 * L'identité de l'entreprise, en UN seul endroit.
 *
 * Elle alimente les données structurées `Organization`, la page /contact, les
 * mentions légales et la politique de confidentialité.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN CHAMP VIDE EST OMIS, JAMAIS RENDU AVEC UN TEXTE DE REMPLACEMENT.      │
 * │                                                                          │
 * │ C'est la règle de `lib/marketing/content.ts` : « chaque phrase doit être  │
 * │ vraie et vérifiable ». Un « à venir » ou un numéro d'exemple dans un      │
 * │ balisage `Organization` est une donnée que Google AFFICHE, et qu'un       │
 * │ commerçant appelle. On préfère l'absence au faux.                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

export interface AdressePostale {
  rue: string;
  quartier?: string;
  commune?: string;
  ville: string;
  /** Code pays ISO. La RDC est « CD ». */
  pays: string;
  /** Repère parlant, tel qu'on l'indique à quelqu'un qui vient. */
  repere?: string;
}

export interface Reseau {
  /** Le réseau : « YouTube », « Facebook ». */
  reseau: string;
  /** Le nom du compte, tel qu'il s'affiche là-bas. */
  compte: string;
  /** Absente tant que l'URL exacte n'est pas connue : on ne devine pas une adresse. */
  url?: string;
}

export interface Entreprise {
  /** La marque, celle que le public cherche. */
  nom: string;
  /** L'entité qui édite le site. Distincte du nom du produit. */
  editeur: string;
  telephone: string;
  /** Le même numéro, chiffres seuls, pour construire un lien wa.me. */
  whatsapp: string;
  email: string;
  adresse: AdressePostale;
  reseaux: readonly Reseau[];
  hebergeur?: string;

  /**
   * ⚠ IDENTIFIANTS LÉGAUX. Le RCCM est renseigné ; `forme`, `idNat` et `nif` ne
   * le sont pas encore. Ils n'existent que chez l'éditeur, et les inventer dans
   * des mentions légales serait une fausse déclaration. Les lignes
   * correspondantes ne s'affichent tout simplement pas tant qu'ils sont absents.
   * Les renseigner ici suffit à les faire apparaître, sans toucher aux pages.
   */
  forme?: string;
  rccm?: string;
  idNat?: string;
  nif?: string;
}

export const ENTREPRISE: Entreprise = {
  nom: "Vente Facile",
  editeur: "CDIR Informatique",

  telephone: "+243 84 715 63 63",
  whatsapp: "243847156363",
  email: "cdirinfo25@gmail.com",

  adresse: {
    rue: "Numéro 1, avenue Lutendele",
    quartier: "Quartier Maman Yemo",
    // ⚠ « Mont-Ngafula » est l'orthographe de la commune de Kinshasa. Elle a été
    // rétablie ici : une adresse légale se lit telle qu'elle est enregistrée.
    commune: "Commune de Mont-Ngafula",
    ville: "Kinshasa",
    pays: "CD",
    repere: "Sur la route by-pass",
  },

  reseaux: [
    {
      reseau: "YouTube",
      compte: "CDIR Informatique",
      url: "https://www.youtube.com/@cdirinformatique2047",
    },
    /**
     * ⚠ L'ADRESSE DE DESTINATION, PAS LE LIEN DE PARTAGE.
     *
     * Le lien copié depuis l'application Facebook était
     * « /share/1CLmAr71u4/?mibextid=wwXIfr ». Deux défauts : `mibextid` est un
     * jeton de SUIVI, qu'on ne publie pas sur ses propres pages ; et une adresse
     * de partage est une redirection, quand `sameAs` attend l'adresse du profil.
     * Résolue en suivant les redirections : elle mène ici.
     */
    {
      reseau: "Facebook",
      compte: "CDIR Info",
      url: "https://www.facebook.com/people/CDIR-Info/61571315736898/",
    },
  ],

  rccm: "CD/KNG/RCCM/25-A-01386",

  // Déduit du reverse DNS de vente-facile.net : srv1267811.hstgr.cloud.
  // À confirmer par l'éditeur, ainsi que le pays du centre de données.
  hebergeur: "Hostinger",
};

/** L'adresse sur une ligne, pour un balisage ou un pied de page. */
export function adresseEnLigne(): string {
  const { rue, quartier, commune, ville } = ENTREPRISE.adresse;
  return [rue, quartier, commune, ville].filter(Boolean).join(", ");
}

/** Le lien WhatsApp, au format que l'application attend. */
export function lienWhatsApp(): string {
  return `https://wa.me/${ENTREPRISE.whatsapp}`;
}

/** Le lien d'appel. Les espaces de présentation ne passent pas dans un `tel:`. */
export function lienTelephone(): string {
  return `tel:${ENTREPRISE.telephone.replace(/\s/g, "")}`;
}
