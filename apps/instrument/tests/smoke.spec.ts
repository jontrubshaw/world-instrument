import { expect, test } from "@playwright/test";

test("loads the instrument app shell", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/World Instrument/);
  await expect(
    page.getByRole("main", { name: "World Instrument app shell" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "A browser body for deterministic visual scores.",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Generative visual stage")).toBeVisible();
  await expect(page.getByText(/visual field ready/i)).toBeVisible();
});
