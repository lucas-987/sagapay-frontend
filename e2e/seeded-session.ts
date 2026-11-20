import type { Page } from "@playwright/test";

const storageKey =
  "oidc.user:http://localhost:8180/realms/sagapay:sagapay-frontend";

export const seededWallet = {
  accountId: "00000000-0000-4000-a000-000000000099",
  currency: "EUR",
  balance: { currency: "EUR", amount: "4405.50" },
  available: { currency: "EUR", amount: "4285.50" },
  held: { currency: "EUR", amount: "120.00" },
};

// The preview server has no Keycloak or gateway: a stored session that
// outlives the test and fulfilled wallet and transfer list requests let the
// shell specs run as a signed-in customer with no activity.
export async function seedSession(page: Page) {
  await page.addInitScript((key) => {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        access_token: "seeded-token",
        token_type: "Bearer",
        scope: "openid profile",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        profile: { sub: "seeded-customer", name: "Julien Simon" },
      }),
    );
  }, storageKey);
  await page.route("**/v1/wallet", (route) =>
    route.fulfill({ json: seededWallet }),
  );
  await page.route("**/v1/transfers?*", (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
}
