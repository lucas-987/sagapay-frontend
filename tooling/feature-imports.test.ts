import { resolve } from "node:path";
import { ESLint } from "eslint";
import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "..");
const eslint = new ESLint({ cwd: root });

describe("feature import boundaries", () => {
  test.each([
    ["src/shared/theme/theme.ts", "../../features/activity"],
    ["src/shared/theme/theme.ts", "../../features/../features/activity"],
    ["src/shared/theme/theme.ts", "/src/features/activity/index"],
    ["src/app/layout.tsx", "../features/activity/activity-page"],
    ["src/features/activity/index.ts", "../send/send-page"],
    ["src/features/activity/index.ts", "../../app/layout"],
    ["src/shared/theme/theme.ts", "../../test/setup"],
  ])(
    "rejects %s importing %s",
    { timeout: 60_000 },
    async (filePath, target) => {
      const [result] = await eslint.lintText(`import '${target}';`, {
        filePath,
      });
      expect(result?.messages).toMatchObject([
        {
          ruleId: "architecture/feature-imports",
          severity: 2,
          message: `Import ${target} through an allowed module boundary.`,
        },
      ]);
      expect(result?.errorCount).toBe(1);
      expect(result?.warningCount).toBe(0);
    },
  );

  test.each([
    ["src/app/layout.tsx", "../features/activity"],
    ["src/features/activity/index.ts", "../send/index"],
    ["src/features/activity/index.ts", "./activity-page"],
    ["src/features/activity/index.ts", "../../shared/theme/theme"],
    ["src/shared/theme/theme.ts", "@mui/material/styles"],
    ["src/app/app.test.tsx", "../test/setup"],
  ])("allows %s to import %s", async (filePath, target) => {
    const [result] = await eslint.lintText(`import '${target}';`, { filePath });
    expect(result?.messages).toEqual([]);
  });

  test.each([
    "export { ActivityPage } from '../../features/activity';",
    "export * from '../../features/activity';",
    "export type Page = typeof import('../../features/activity').ActivityPage;",
    "void import('../../features/activity');",
    "void import(`../../features/activity`);",
  ])("rejects a shared module dependency declared as %s", async (source) => {
    const [result] = await eslint.lintText(source, {
      filePath: "src/shared/theme/theme.ts",
    });
    expect(result?.messages).toMatchObject([
      {
        ruleId: "architecture/feature-imports",
        severity: 2,
        message:
          "Import ../../features/activity through an allowed module boundary.",
      },
    ]);
  });
});
