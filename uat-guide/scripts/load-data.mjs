import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { resolve } from "node:path";

export async function loadUatData(root = process.cwd()) {
  const context = { window: {} };
  vm.createContext(context);
  for (const file of [
    "data/discovery.js",
    "data/test-helpers.js",
    "data/cases-customer.js",
    "data/cases-super-admin.js",
    "data/cases-roles.js",
    "data/cases-cross-role.js"
  ]) {
    vm.runInContext(await readFile(resolve(root, file), "utf8"), context, { filename: file });
    Object.assign(context, context.window);
  }
  return { discovery: context.window.UAT_DISCOVERY, cases: context.window.UAT_CASES };
}
