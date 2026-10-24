// Copia o leitor de notas (Tesseract) para public/ocr, para o celular ler a
// foto da nota sem depender de CDN externo nem da Claude API.
import { cpSync, mkdirSync, readdirSync } from "node:fs";

const destino = "public/ocr";
mkdirSync(`${destino}/core`, { recursive: true });
mkdirSync(`${destino}/lang`, { recursive: true });
cpSync("node_modules/tesseract.js/dist/worker.min.js", `${destino}/worker.min.js`);
for (const f of readdirSync("node_modules/tesseract.js-core")) {
  if (/^tesseract-core.*\.(js|wasm)$/.test(f)) cpSync(`node_modules/tesseract.js-core/${f}`, `${destino}/core/${f}`);
}
for (const l of ["por", "spa"]) {
  cpSync(`node_modules/@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`, `${destino}/lang/${l}.traineddata.gz`);
}
console.log("Leitor de notas copiado para", destino);
