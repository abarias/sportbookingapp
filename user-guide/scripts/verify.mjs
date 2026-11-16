import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const root = process.cwd();
const required = ["index.html", "app.js", "styles.css", "data/content.js", "assets/MMG_STELLAR_logo.png", "assets/MMG_STELLAR_favicon.png"];
for (const file of required) await access(resolve(root, file));

const context = { window: {} };
vm.runInNewContext(await readFile(resolve(root, "data/content.js"), "utf8"), context);
const content = context.window.GUIDE_CONTENT;
if (!content || content.personas.length !== 5) throw new Error("Expected five persona guides.");

const expectedPersonas = ["customer", "super-admin", "booking-admin", "receptionist", "social-media"];
const actualPersonas = content.personas.map((persona) => persona.id);
if (JSON.stringify(actualPersonas) !== JSON.stringify(expectedPersonas)) throw new Error(`Persona order mismatch: ${actualPersonas.join(", ")}`);

const ids = new Set();
const imageReferences = new Set();
for (const persona of content.personas) {
  if (!persona.scenarios.length) throw new Error(`${persona.name} has no scenarios.`);
  for (const scenario of persona.scenarios) {
    if (ids.has(scenario.id)) throw new Error(`Duplicate scenario ID: ${scenario.id}`);
    ids.add(scenario.id);
    if (scenario.steps.length < 3) throw new Error(`${scenario.id} needs at least three steps.`);
    for (const item of scenario.steps) if (!item.action || !item.expected) throw new Error(`${scenario.id} has an incomplete step.`);
    for (const image of scenario.screenshots || []) imageReferences.add(image.file);
  }
}
for (const image of imageReferences) await access(resolve(root, "assets/screenshots", image));

const html = await readFile(resolve(root, "index.html"), "utf8");
for (const asset of ["styles.css", "data/content.js", "app.js"]) if (!html.includes(asset)) throw new Error(`index.html does not include ${asset}`);
console.log(`Verified ${content.personas.length} personas, ${ids.size} scenarios, and ${imageReferences.size} screenshot references.`);
