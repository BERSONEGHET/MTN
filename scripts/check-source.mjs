import {createRequire} from "node:module";
import {mkdirSync} from "node:fs";
const require=createRequire(import.meta.url);
const {build}=require("esbuild");
mkdirSync("outputs",{recursive:true});
await build({entryPoints:["app/catalog.tsx"],outfile:"outputs/catalog.syntax.js",bundle:true,platform:"browser",format:"esm",external:["react","react/jsx-runtime"],target:"es2022"});
await build({entryPoints:["app/api/catalog/route.ts","app/api/olist/route.ts","app/api/olist/callback/route.ts","app/api/transfer/route.ts"],outdir:"outputs/routes",bundle:true,platform:"neutral",format:"esm",external:["cloudflare:workers","next/headers","next/navigation"],target:"es2022"});
await build({entryPoints:["app/page.tsx","app/layout.tsx"],outdir:"outputs/syntax",bundle:true,platform:"neutral",format:"esm",external:["react","react/jsx-runtime","next/headers","next/navigation","tailwindcss"],target:"es2022"});
console.log("Sintaxe e importações locais verificadas.");
