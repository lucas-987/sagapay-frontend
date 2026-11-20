import { expect, test } from "vitest";
import { normaliseHandle } from "./handle";

test.each([
  { name: "a bare handle", text: "alice", handle: "alice" },
  { name: "a leading @", text: "@alice", handle: "alice" },
  { name: "upper case", text: "@Alice", handle: "alice" },
  { name: "surrounding spaces", text: "  @alice  ", handle: "alice" },
  { name: "an empty field", text: "", handle: "" },
  { name: "only an @", text: "@", handle: "" },
  { name: "only spaces", text: "   ", handle: "" },
  { name: "a second @", text: "@@alice", handle: "@alice" },
])("normalises $name", ({ text, handle }) => {
  expect(normaliseHandle(text)).toBe(handle);
});
