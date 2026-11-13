/**
 * Les tests UNITAIRES du back-office : ceux de ses modules PURS.
 *
 * Le back-office n'avait AUCUN lanceur de tests : seuls `tsc` et les balayages
 * `check:*` y retenaient une divergence, et aucun ne voit une règle fausse
 * dans un module qui compile. Les copies tenues à la main de règles du
 * terminal (`lib/stock/nombres.ts`, `lib/contacts/imputation.ts`…) y
 * dérivaient sans que rien ne le dise.
 *
 * ⚠ Environnement `node`, et c'est voulu : on n'éprouve ici que des modules
 *   sans React ni navigateur. Un composant se juge à l'écran.
 */
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "hooks/**/*.test.ts"],
  },
});
