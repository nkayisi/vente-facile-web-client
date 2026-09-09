import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // ┌──────────────────────────────────────────────────────────────────────┐
    // │ LA CONFIG PLATE NE LIT PAS `.gitignore`, ET CE DOSSIER FAIT 967 Mo. │
    // │                                                                      │
    // │ `.pnpm-store/` est le magasin de paquets, ignoré par git depuis      │
    // │ toujours mais pas par ESLint, qui n'écarte d'office que              │
    // │ `node_modules`. Il porte 265 000 fichiers JavaScript : `pnpm lint`   │
    // │ rendait donc plus de dix-neuf mille problèmes et prenait un quart    │
    // │ d'heure, pour un code source qui en compte une centaine.             │
    // │                                                                      │
    // │ Un lint qu'on ne peut pas lire est un lint que personne ne lance -   │
    // │ c'est ainsi qu'une page a accumulé dix `no-unused-vars` sans que     │
    // │ rien ne les signale.                                                 │
    // └──────────────────────────────────────────────────────────────────────┘
    ".pnpm-store/**",
    ".playwright-cli/**",
  ]),
]);

export default eslintConfig;
