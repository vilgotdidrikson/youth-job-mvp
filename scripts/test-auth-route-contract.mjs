import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

for (const mode of ["login", "signup"]) {
  const path = `app/${mode}/page.tsx`;
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const page = source.statements.find(node => ts.isFunctionDeclaration(node) && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword));
  assert.ok(page, `${path} must export a page`);
  assert.equal(page.parameters.length, 0, "Custom auth props belong on a component, not a Next.js page");
  const imports = source.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text);
  assert.deepEqual(imports, ["@/components/auth-page"]);
  const returned = page.body.statements.find(ts.isReturnStatement).expression;
  assert.ok(ts.isJsxSelfClosingElement(returned));
  assert.equal(returned.tagName.getText(source), "AuthPage");
  const initialMode = returned.attributes.properties.find(attribute => attribute.name?.getText(source) === "initialMode");
  assert.equal(initialMode.initializer.text, mode, "Each route must retain its initial mode");
}
const component = readFileSync("components/auth-page.tsx", "utf8");
assert.match(component, /^"use client";/);
assert.match(component, /useState<Mode>\(initialMode\)/);
assert.match(component, /<Suspense fallback=\{null\}><LoginPageContent initialMode=\{initialMode\}/);
const onboarding = readFileSync("app/youth/onboarding/page.tsx", "utf8");
assert.match(onboarding, /return <ShortYouthOnboarding \/>;/);
assert.doesNotMatch(onboarding, /export function YouthOnboardingFlow/);
assert.match(readFileSync("components/youth-onboarding-flow.tsx", "utf8"), /export function YouthOnboardingFlow/);
console.log("PASS: valid auth route exports, shared client component, login/signup initial modes and search-params Suspense boundary.");
