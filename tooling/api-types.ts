import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

export interface ApiService {
  name: string;
  source: string;
  output: string;
}

export const apiServices: ApiService[] = [
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
];

export interface GenerateOptions {
  backendDir: string;
  revisionFile: string;
  outputDir: string;
  services: ApiService[];
}

export async function generateApiTypes(options: GenerateOptions) {
  const recorded = readFileSync(options.revisionFile, "utf8").trim();
  const actual = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: options.backendDir,
    encoding: "utf8",
  }).trim();
  if (actual !== recorded) {
    throw new Error(
      `Backend checkout is at ${actual} but the recorded revision is ${recorded}.`,
    );
  }

  const modules = await Promise.all(
    options.services.map(async (service) => {
      const ast = await openapiTS(
        pathToFileURL(join(options.backendDir, service.source)),
        { silent: true },
      );
      return {
        file: service.output,
        text: `/* Generated from ${service.source} at backend revision ${recorded}. Do not edit. */\n\n${astToString(ast)}`,
      };
    }),
  );

  mkdirSync(options.outputDir, { recursive: true });
  for (const { file, text } of modules) {
    writeFileSync(join(options.outputDir, file), text);
  }
}
