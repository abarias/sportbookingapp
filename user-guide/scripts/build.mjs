import { access, cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const entry of ["index.html", "app.js", "styles.css", "data", "assets"]) {
  await cp(resolve(root, entry), resolve(dist, entry), { recursive: true });
}
try {
  await access(resolve(root, "output/pdf"));
  await cp(resolve(root, "output/pdf"), resolve(dist, "downloads"), { recursive: true });
} catch {
  console.warn("PDF output was not found; run npm run pdf before the final deployment build.");
}
console.log(`Built static user guide in ${dist}`);
