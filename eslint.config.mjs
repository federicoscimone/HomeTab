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
