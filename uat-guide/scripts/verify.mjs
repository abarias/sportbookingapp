import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadUatData } from "./load-data.mjs";

const root = process.cwd();
const requiredSections = [
  "home", "before-you-start", "environment", "customer-guide", "super-admin-guide", "receptionist-guide",
  "booking-admin-guide", "social-media-guide", "cross-role", "permission-tests", "responsive-tests",
  "accessibility-tests", "issue-reporting", "dashboard", "traceability", "known-gaps", "print-views"
];
const requiredCaseFields = [
  "id", "persona", "category", "scenario", "priority", "purpose", "feature", "preconditions", "account", "data",
  "steps", "finalExpected", "screenshots", "cleanup", "evidence", "confidence", "sourceEvidence"
];
const html = await readFile(resolve(root, "index.html"), "utf8");
const { discovery, cases } = await loadUatData(root);
const errors = [];

for (const id of requiredSections) {
  if (!html.includes(`id="${id}"`)) errors.push(`Missing required section #${id}`);
}

const ids = new Set();
for (const testCase of cases) {
  if (ids.has(testCase.id)) errors.push(`Duplicate test ID: ${testCase.id}`);
  ids.add(testCase.id);
  for (const field of requiredCaseFields) {
    if (!(field in testCase)) errors.push(`${testCase.id} missing ${field}`);
  }
  if (!Array.isArray(testCase.steps) || testCase.steps.length === 0) errors.push(`${testCase.id} has no steps`);
  for (const [index, step] of testCase.steps.entries()) {
    if (!step.action || !step.expected) errors.push(`${testCase.id} step ${index + 1} lacks action/expected`);
  }
}

for (const persona of discovery.personas) {
  if (!cases.some((testCase) => testCase.persona === persona.id)) errors.push(`No cases for ${persona.label}`);
}

const scriptSources = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
const styleSources = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((match) => match[1]);
for (const asset of [...scriptSources, ...styleSources]) {
  try { await access(resolve(root, asset)); } catch { errors.push(`Missing referenced asset: ${asset}`); }
}

const secretPatterns = [
  /postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/i,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s]+/i,
  /NEXTAUTH_SECRET\s*=\s*[^\s]+/i,
  /re_[A-Za-z0-9]{20,}/,
  /sk_(?:live|test)_[A-Za-z0-9]{12,}/
];
for (const file of ["index.html", "app.js", "data/discovery.js", "data/cases-customer.js", "data/cases-super-admin.js", "data/cases-roles.js", "data/cases-cross-role.js"]) {
  const content = await readFile(resolve(root, file), "utf8");
  for (const pattern of secretPatterns) if (pattern.test(content)) errors.push(`Potential secret pattern in ${file}: ${pattern}`);
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

const counts = Object.fromEntries(discovery.personas.map((persona) => [persona.label, cases.filter((item) => item.persona === persona.id).length]));
console.log(`Verified ${cases.length} unique test cases across ${Object.keys(counts).length} personas.`);
console.log(counts);
