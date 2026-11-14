/**
 * Le mot de passe temporaire que l'administration dicte au téléphone.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ IL SE DICTE, DONC IL NE SE TROMPE PAS À L'OREILLE.                        │
 * │                                                                          │
 * │ Trois groupes de quatre, en minuscules et en chiffres, sans les          │
 * │ caractères que la voix ou une police confondent (0/o, 1/l/i). Les        │
 * │ majuscules sont exclues : « K majuscule » au téléphone double le temps   │
 * │ de la dictée et la moitié des erreurs.                                   │
 * │                                                                          │
 * │ Près de soixante bits (31¹²) : un mot de passe qui ne vit que le         │
 * │ temps d'une connexion, que le serveur fera changer d'office, et dont les │
 * │ essais sont bornés par le verrou de connexion (cinq échecs).             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ `crypto.getRandomValues`, jamais `Math.random` : celui-ci n'est pas fait pour
 * fabriquer un secret, et rien ne garantit ce qu'il donne d'un moteur à l'autre.
 */

export const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const GROUPES = 3;
const TAILLE_GROUPE = 4;
const CHIFFRES = /[0-9]/g;
const LETTRES = /[a-z]/g;

/** Un caractère de l'alphabet, sans biais de modulo. */
function tirer(aleatoire: (octets: Uint8Array) => Uint8Array): string {
  // 256 n'est pas un multiple de 31 : on rejette ce qui dépasse le dernier
  // multiple, sinon les premiers caractères sortiraient plus souvent.
  const plafond = 256 - (256 % ALPHABET.length);
  const octet = new Uint8Array(1);
  for (;;) {
    aleatoire(octet);
    if (octet[0] < plafond) return ALPHABET[octet[0] % ALPHABET.length];
  }
}

/** Assez de lettres ET de chiffres pour passer les validateurs du serveur. */
export function estConforme(motDePasse: string): boolean {
  const sansTirets = motDePasse.replace(/-/g, "");
  return (
    sansTirets.length === GROUPES * TAILLE_GROUPE &&
    [...sansTirets].every((c) => ALPHABET.includes(c)) &&
    (sansTirets.match(CHIFFRES)?.length ?? 0) >= 2 &&
    (sansTirets.match(LETTRES)?.length ?? 0) >= 2
  );
}

export function genererMotDePasse(
  aleatoire: (octets: Uint8Array) => Uint8Array = (o) => globalThis.crypto.getRandomValues(o),
): string {
  for (;;) {
    const groupes = Array.from({ length: GROUPES }, () =>
      Array.from({ length: TAILLE_GROUPE }, () => tirer(aleatoire)).join(""),
    );
    const candidat = groupes.join("-");
    // ⚠ Un tirage tout en chiffres serait refusé par le serveur (« entièrement
    // numérique »), et l'admin lirait une erreur sur un mot de passe qu'il n'a
    // pas choisi. On retire, ce qui arrive rarement.
    if (estConforme(candidat)) return candidat;
  }
}
