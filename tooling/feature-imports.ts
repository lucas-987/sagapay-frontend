import { dirname, relative, resolve, sep } from "node:path";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const applicationRoot = resolve(import.meta.dirname, "../src");
const publicEntry = /^index(?:\.[cm]?[jt]sx?)?$/;
const testFile = /\.test\.[jt]sx?$/;
const featureLayers = new Set([
  "api",
  "auth",
  "features",
  "realtime",
  "shared",
]);

function staticSpecifier(source: TSESTree.Node) {
  if (source.type === AST_NODE_TYPES.Literal) {
    return source.value;
  }
  if (
    source.type === AST_NODE_TYPES.TemplateLiteral &&
    source.expressions.length === 0
  ) {
    return source.quasis[0]?.value.cooked;
  }
  return undefined;
}

export const featureImports: TSESLint.RuleModule<"dependency"> = {
  meta: {
    type: "problem",
    schema: [],
    defaultOptions: [],
    messages: {
      dependency: "Import {{target}} through an allowed module boundary.",
    },
  },
  create(context) {
    const filename = context.filename;
    const [layer, feature] = relative(applicationRoot, filename).split(sep);

    function check({ source }: { source: TSESTree.Node | null }) {
      if (source === null) {
        return;
      }

      const specifier = staticSpecifier(source);
      if (
        typeof specifier !== "string" ||
        (!specifier.startsWith(".") && !specifier.startsWith("/src/"))
      ) {
        return;
      }
      const path = specifier.startsWith("/src/")
        ? resolve(applicationRoot, specifier.slice("/src/".length))
        : resolve(dirname(filename), specifier);
      const [targetLayer, targetFeature, entry, subpath] = relative(
        applicationRoot,
        path,
      ).split(sep);
      const crossesFeature =
        targetLayer === "features" &&
        (layer !== "features" || targetFeature !== feature);
      const usesPublicEntry =
        targetFeature !== undefined &&
        subpath === undefined &&
        (entry === undefined || publicEntry.test(entry));
      const restricted =
        (layer === "shared" && targetLayer !== "shared") ||
        (layer === "features" && !featureLayers.has(targetLayer ?? "")) ||
        (targetLayer === "test" && layer !== "test") ||
        (crossesFeature &&
          (!usesPublicEntry ||
            (layer !== "features" && layer !== "app" && layer !== "test")));

      if (restricted && !(targetLayer === "test" && testFile.test(filename))) {
        context.report({
          node: source,
          messageId: "dependency",
          data: { target: specifier },
        });
      }
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check,
      TSImportType: check,
    };
  },
};
