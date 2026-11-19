import { createAppStore } from "../app/store";

export function createTestStore(token = "token") {
  return createAppStore({
    session: { getAccessToken: () => Promise.resolve(token) },
  });
}
