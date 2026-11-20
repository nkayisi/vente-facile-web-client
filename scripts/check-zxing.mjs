/**
 * Garde-fou : le lecteur de codes-barres servi par le site est celui du paquet.
 *
 * Le scan à la caméra du point de vente passe par `barcode-detector`, qui
 * décode en WebAssembly (`zxing_reader.wasm`). On sert ce fichier depuis
 * `public/zxing/` plutôt que depuis le CDN par défaut : un comptoir dont le
 * réseau filtre jsDelivr n'aurait pas de caméra, sans que rien ne dise
 * pourquoi.
 *
 * ⚠ LA CONTREPARTIE : LA COPIE PEUT VIEILLIR. Une montée de version du paquet
 *   attendrait un `.wasm` d'une autre version, et la caméra échouerait au
 *   premier scan, en production seulement. Ce contrôle compare l'empreinte de
 *   la copie à `ZXING_WASM_SHA256`, celle que le paquet INSTALLÉ annonce.
 *
 * Sorties : 0 conforme, 1 copie périmée, 2 vérification impossible.
 * Réparer :
 *   cp node_modules/.pnpm/zxing-wasm@*\/node_modules/zxing-wasm/dist/reader/zxing_reader.wasm public/zxing/
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const COPIE = new URL("../public/zxing/zxing_reader.wasm", import.meta.url).pathname;

let attendue;
let version;
try {
  const paquet = await import("barcode-detector/ponyfill");
  attendue = paquet.ZXING_WASM_SHA256;
  version = paquet.ZXING_WASM_VERSION;
} catch (erreur) {
  console.error(`✗ barcode-detector introuvable : ${erreur.message}`);
  process.exit(2);
}
if (!attendue) {
  console.error("✗ Le paquet n'annonce aucune empreinte (ZXING_WASM_SHA256) : vérification impossible.");
  process.exit(2);
}
if (!existsSync(COPIE)) {
  console.error(`✗ ${COPIE} est absent : la caméra du point de vente n'aurait aucun décodeur.`);
  process.exit(2);
}

const reelle = createHash("sha256").update(readFileSync(COPIE)).digest("hex");
if (reelle !== attendue) {
  console.error(
    `✗ public/zxing/zxing_reader.wasm ne correspond pas à zxing-wasm ${version}.\n` +
      `  attendue : ${attendue}\n  servie   : ${reelle}\n` +
      "  Recopier le fichier depuis node_modules (voir l'en-tête de ce script)."
  );
  process.exit(1);
}
console.log(`✓ Décodeur de la caméra conforme (zxing-wasm ${version}).`);
