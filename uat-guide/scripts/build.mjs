import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const output = resolve(root, "dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of ["index.html", "styles.css", "app.js", "data", "assets"]) {
  await cp(resolve(root, entry), resolve(output, entry), { recursive: true });
}

console.log(`Static UAT portal built at ${output}`);
