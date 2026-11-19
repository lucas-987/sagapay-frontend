import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { generateApiTypes } from "./api-types.ts";

const petSpec = `openapi: 3.1.0
info: { title: Pets, version: "1" }
paths: {}
components:
  schemas:
    Pet:
      type: object
      required: [name]
      properties:
        name: { type: string }
`;

function git(cwd: string, ...args: string[]) {
  return execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@example.test", ...args],
    { cwd, encoding: "utf8" },
  ).trim();
}

function backendCheckout() {
  const dir = mkdtempSync(join(tmpdir(), "backend-"));
  mkdirSync(join(dir, "pets"));
  writeFileSync(join(dir, "pets", "pets.openapi.yaml"), petSpec);
  git(dir, "init", "--quiet");
  git(dir, "add", ".");
  git(dir, "commit", "--quiet", "-m", "init");
  return { dir, revision: git(dir, "rev-parse", "HEAD") };
}

function workDir(revision: string) {
  const dir = mkdtempSync(join(tmpdir(), "frontend-"));
  const revisionFile = join(dir, "backend-revision");
  writeFileSync(revisionFile, `${revision}\n`);
  return { outputDir: join(dir, "generated"), revisionFile };
}

const services = [
  { name: "pets", source: "pets/pets.openapi.yaml", output: "pets.ts" },
];

describe("generateApiTypes", () => {
  test("writes one module per service at the recorded revision", async () => {
    const backend = backendCheckout();
    const { outputDir, revisionFile } = workDir(backend.revision);

    await generateApiTypes({
      backendDir: backend.dir,
      revisionFile,
      outputDir,
      services,
    });

    expect(readFileSync(join(outputDir, "pets.ts"), "utf8")).toBe(
      `/* Generated from pets/pets.openapi.yaml at backend revision ${backend.revision}. Do not edit. */\n\n` +
        `export type paths = Record<string, never>;\n` +
        `export type webhooks = Record<string, never>;\n` +
        `export interface components {\n` +
        `    schemas: {\n` +
        `        Pet: {\n` +
        `            name: string;\n` +
        `        };\n` +
        `    };\n` +
        `    responses: never;\n` +
        `    parameters: never;\n` +
        `    requestBodies: never;\n` +
        `    headers: never;\n` +
        `    pathItems: never;\n` +
        `}\n` +
        `export type $defs = Record<string, never>;\n` +
        `export type operations = Record<string, never>;\n`,
    );
  });

  test("fails naming both revisions when the checkout is at another revision", async () => {
    const backend = backendCheckout();
    const recorded = "0123456789abcdef0123456789abcdef01234567";
    const { outputDir, revisionFile } = workDir(recorded);

    await expect(
      generateApiTypes({
        backendDir: backend.dir,
        revisionFile,
        outputDir,
        services,
      }),
    ).rejects.toThrow(
      `Backend checkout is at ${backend.revision} but the recorded revision is ${recorded}.`,
    );
  });

  test("writes nothing when the revision differs", async () => {
    const backend = backendCheckout();
    const { outputDir, revisionFile } = workDir("0".repeat(40));

    await expect(
      generateApiTypes({
        backendDir: backend.dir,
        revisionFile,
        outputDir,
        services,
      }),
    ).rejects.toThrow();

    expect(() => readFileSync(join(outputDir, "pets.ts"))).toThrow(/ENOENT/);
  });
});
