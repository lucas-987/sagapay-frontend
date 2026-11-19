import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { apiServices } from "./api-types.ts";

const root = resolve(import.meta.dirname, "..");
const generatedDir = join(root, "src/api/generated");

function runScript(backendDir: string | undefined) {
  const env: Record<string, string> = { PATH: process.env["PATH"] ?? "" };
  if (backendDir !== undefined) env["SAGAPAY_BACKEND_DIR"] = backendDir;
  return spawnSync(
    process.execPath,
    [join(root, "tooling/generate-api-types.ts")],
    { cwd: root, env, encoding: "utf8" },
  );
}

function snapshotOfGeneratedDir() {
  return readdirSync(generatedDir).map((file) => [
    file,
    readFileSync(join(generatedDir, file), "utf8"),
  ]);
}

describe("generate-api-types command", () => {
  test.each([
    ["unset", undefined],
    ["empty", ""],
  ])("refuses to run when SAGAPAY_BACKEND_DIR is %s", (_name, backendDir) => {
    const before = snapshotOfGeneratedDir();

    const result = runScript(backendDir);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "Set SAGAPAY_BACKEND_DIR to a SagaPay backend checkout.\n",
    );
    expect(snapshotOfGeneratedDir()).toStrictEqual(before);
  });

  test("fails on stderr and writes nothing when the checkout is at another revision", () => {
    const dir = mkdtempSync(join(tmpdir(), "backend-"));
    writeFileSync(join(dir, "README"), "backend");
    const git = (...args: string[]) =>
      execFileSync(
        "git",
        ["-c", "user.name=t", "-c", "user.email=t@example.test", ...args],
        { cwd: dir, encoding: "utf8" },
      ).trim();
    git("init", "--quiet");
    git("add", ".");
    git("commit", "--quiet", "-m", "init");
    const actual = git("rev-parse", "HEAD");
    const recorded = readFileSync(
      join(root, "tooling/backend-revision"),
      "utf8",
    ).trim();
    const before = snapshotOfGeneratedDir();

    const result = runScript(dir);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      `Backend checkout is at ${actual} but the recorded revision is ${recorded}.\n`,
    );
    expect(snapshotOfGeneratedDir()).toStrictEqual(before);
  });
});

describe("apiServices", () => {
  test("names the two backend contracts and the modules generated from them", () => {
    expect(apiServices).toStrictEqual([
      {
        name: "ledger-accounts",
        source:
          "ledger-accounts-service/src/main/resources/openapi/ledger-accounts-service.openapi.yaml",
        output: "ledger-accounts.ts",
      },
      {
        name: "transfer",
        source:
          "transfer-orchestrator/src/main/resources/openapi/transfer-service.openapi.yaml",
        output: "transfer.ts",
      },
    ]);
  });

  test("each committed module says it was generated from its service's source", () => {
    const headers = apiServices.map((service) => [
      service.output,
      readFileSync(join(generatedDir, service.output), "utf8").split("\n")[0],
    ]);

    const revision = readFileSync(
      join(root, "tooling/backend-revision"),
      "utf8",
    ).trim();
    expect(headers).toStrictEqual(
      apiServices.map((service) => [
        service.output,
        `/* Generated from ${service.source} at backend revision ${revision}. Do not edit. */`,
      ]),
    );
  });
});
