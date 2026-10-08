import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    // Un identificatore non dichiarato è un errore: una variabile definita dentro una funzione e
    // usata in un'altra passava il lint e falliva solo a runtime (ReferenceError).
    rules: { "no-undef": "error" },
  },
  {
    // Nessun testo scritto direttamente nel JSX: ogni frase visibile passa da messages/*.json,
    // così non resta nulla in una sola lingua. Simboli e numeri si scrivono come espressione
    // ({'↓'}), che la regola accetta: è un modo esplicito per dire "non va tradotto".
    files: ["app/**/*.js", "components/**/*.js"],
    rules: { "react/jsx-no-literals": ["error", { noStrings: false, ignoreProps: true }] },
  },
  {
    // Script eseguiti da mongosh all'avvio del container: lì `db` è una variabile globale.
    files: ["deploy/mongo/init/**/*.js"],
    languageOptions: { globals: { db: "readonly" } },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
