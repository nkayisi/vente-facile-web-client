/**
 * Les bornes de taille des fichiers envoyés depuis le back-office, en UN SEUL
 * endroit.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ TROIS ÉCRANS PROMETTAIENT PLUS QUE CE QUE LE SERVEUR ACCEPTAIT.          │
 * │                                                                          │
 * │ Un fichier envoyé d'ici ne part pas au backend depuis le navigateur : il │
 * │ passe par une SERVER ACTION, donc il voyage dans le corps de la requête  │
 * │ POST vers le serveur Next. Next borne ce corps à 1 Mo PAR DÉFAUT, quand  │
 * │ la photo d'un produit acceptait 5 Mo, l'avatar 10 Mo, et l'import de     │
 * │ catalogue rien du tout. Le fichier était accepté par l'écran puis refusé │
 * │ par Next - sur la photo, APRÈS que le produit avait été créé, si bien    │
 * │ que le marchand lisait un écran de crash sur un produit qui existait.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LA BORNE DU CORPS EST DÉRIVÉE DES BORNES DE CHAMP, JAMAIS RECOPIÉE. Des
 * nombres tenus à la main se contrediraient un jour, et la contradiction ne se
 * verrait qu'au-delà du plus petit des deux - c'est-à-dire sur l'écran d'un
 * marchand, et pas sur celui du développeur qui essaie avec une petite image.
 * C'est la règle du dépôt : on ne surveille pas une divergence, on supprime ce
 * qui peut diverger.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ⚠ CHANGER UN PLAFOND ICI EXIGE DE REDÉMARRER LE SERVEUR DE DÉV.          │
 * │                                                                          │
 * │ MESURÉ : Next ne surveille que `next.config.ts` lui-même, PAS ses        │
 * │ imports transitifs. Une modification de ce fichier recompile l'app mais  │
 * │ ne fait PAS relire la configuration : le serveur garde la borne calculée │
 * │ à son dernier démarrage, et l'écart ne se voit qu'au-delà de la plus     │
 * │ petite des deux valeurs - donc sur un fichier d'essai assez gros, et pas │
 * │ sur une petite image. `docker compose restart frontend`.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Ce que le champ photo d'un produit accepte.
 *
 * Au-delà, l'envoi devient lent sur les connexions du terrain : 5 Mo sur une 2G
 * congolaise se comptent en minutes, et c'est déjà la vraie borne pratique.
 */
export const TAILLE_MAX_PHOTO_MO = 5;

/**
 * Ce que l'import de catalogue accepte.
 *
 * Un classeur de cinquante mille lignes tient très en dessous : la borne n'est
 * pas là pour contraindre un vrai catalogue, elle est là pour qu'un fichier
 * manifestement faux (une vidéo renommée, une archive) soit refusé SOUS LE
 * CHAMP plutôt qu'au bout d'un envoi de plusieurs minutes.
 */
export const TAILLE_MAX_IMPORT_MO = 5;

/**
 * Ce que le sélecteur d'avatar accepte comme fichier SOURCE.
 *
 * ⚠ CETTE BORNE N'ENTRE PAS DANS LE CALCUL DE `LIMITE_CORPS_ACTION`, ET C'EST
 * LE PIÈGE DE CE FICHIER. Le fichier source ne traverse JAMAIS le réseau : il
 * est lu dans le navigateur, recadré, puis ré-encodé à `COTE_MAX_AVATAR_PX`.
 * Ce qui part est l'image recadrée, et elle seule. L'inclure ici relèverait la
 * borne du corps de 10 Mo pour un fichier qui ne sort pas du navigateur.
 *
 * Elle protège la mémoire, pas le réseau : `FileReader.readAsDataURL` charge
 * tout le fichier en base64, soit environ un tiers de plus que sa taille.
 */
export const TAILLE_MAX_AVATAR_SOURCE_MO = 10;

/**
 * Le côté le plus long d'un avatar, après recadrage et avant envoi.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ C'EST CE PLAFOND QUI SORT L'AVATAR DE LA QUESTION DE LA BORNE DU CORPS. │
 * │                                                                          │
 * │ Sans lui, le recadrage ré-encodait la région choisie À SA TAILLE SOURCE :│
 * │ un carré pris dans une photo de douze mégapixels sortait en plusieurs    │
 * │ mégaoctets de JPEG, pour une image affichée au plus à 96 px de côté      │
 * │ (`h-24 w-24` sur la fiche de profil, le plus grand rendu du dépôt).      │
 * │ Relever une borne n'aurait fait que déplacer le seuil ; borner la SORTIE │
 * │ rend l'envoi petit et DÉTERMINISTE, donc très en dessous de la borne du  │
 * │ corps quelle que soit la photo d'origine.                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * 512 couvre 96 px CSS à plus de cinq fois la densité : la marge est large, et
 * un JPEG de 512 px de côté pèse une centaine de kilooctets.
 */
export const COTE_MAX_AVATAR_PX = 512;

/**
 * La plus grosse taille qu'un fichier puisse avoir EN TRAVERSANT une server
 * action. L'avatar n'y figure pas : voir `TAILLE_MAX_AVATAR_SOURCE_MO`.
 */
const TAILLE_MAX_ENVOYEE_MO = Math.max(TAILLE_MAX_PHOTO_MO, TAILLE_MAX_IMPORT_MO);

/**
 * ⚠ LA MARGE N'EST PAS UN ARRONDI DE CONFORT.
 *
 * La requête d'une server action ne porte pas que le fichier : elle porte aussi
 * les autres arguments (jeton d'accès, identifiant d'organisation, identifiant
 * de produit) et l'encodage multipart qui les sépare. Une borne posée
 * EXACTEMENT à la taille du champ refuserait donc un fichier que l'écran vient
 * d'accepter, et on aurait déplacé le défaut d'un facteur au lieu de le fermer -
 * avec le même symptôme, au même endroit, pour une poignée d'octets.
 */
const MARGE_ENVELOPPE_MO = 1;

/**
 * La borne du corps d'une server action, telle que `next.config.ts` l'attend.
 *
 * ⚠ ELLE NE SUFFIT PAS SEULE EN PRODUCTION : un proxy inverse devant Next
 * borne lui aussi le corps des requêtes (nginx : 1 Mo par défaut, comme Next).
 * S'il n'est pas relevé, le refus revient un cran plus loin, en 413, et SANS le
 * message de Next qui dit au moins quoi configurer.
 */
export const LIMITE_CORPS_ACTION = `${TAILLE_MAX_ENVOYEE_MO + MARGE_ENVELOPPE_MO}mb` as const;
