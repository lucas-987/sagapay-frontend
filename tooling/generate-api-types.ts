import { resolve } from "node:path";
import { apiServices, generateApiTypes } from "./api-types.ts";

const root = resolve(import.meta.dirname, "..");
const backendDir = process.env["SAGAPAY_BACKEND_DIR"];
if (backendDir === undefined || backendDir === "") {
  console.error("Set SAGAPAY_BACKEND_DIR to a SagaPay backend checkout.");
  process.exit(1);
}

try {
  await generateApiTypes({
    backendDir,
    revisionFile: resolve(root, "tooling/backend-revision"),
    outputDir: resolve(root, "src/api/generated"),
    services: apiServices,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
