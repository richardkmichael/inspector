import { test, expect } from "@playwright/test";

// Adjust the URL if your dev server runs on a different port
const APP_URL = "http://localhost:6274/";

test.describe("Startup State", () => {
  test("should not navigate to a tab when Inspector first opens", async ({
    page,
  }) => {
    await page.goto(APP_URL);

    // Wait for the page to load
    const selectTrigger = page.getByLabel("Transport Type");
    await expect(selectTrigger).toBeVisible();

    // Check that there is no hash fragment in the URL
    const url = page.url();
    expect(url).not.toContain("#");
  });

  test("CLI arguments should populate form fields", async ({ page }) => {
    const cliTestScenario = process.env.CLI_TEST_SCENARIO;

    // Skip this test if not running a CLI test scenario
    if (
      !cliTestScenario ||
      (cliTestScenario !== "inline" && cliTestScenario !== "file")
    ) {
      test.skip();
      return;
    }

    await page.goto(APP_URL);

    // Wait for the page to load
    const selectTrigger = page.getByLabel("Transport Type");
    await expect(selectTrigger).toBeVisible();

    // Both CLI scenarios should produce the same form values
    const commandInput = page.getByRole('textbox', { name: 'Command' })
    // const commandInput = page.locator('input[placeholder="Command"]');

    const argsInput = page.getByRole('textbox', { name: 'Arguments' })
    // const argsInput = page.locator('input[placeholder="Arguments"]');

    await expect(commandInput).toHaveValue("uv");
    await expect(argsInput).toHaveValue("run main.py");

    // Click to expand environment variables section
    const envButton = page.getByRole("button", {
      name: /Environment Variables/i,
    });
    await envButton.click();

    // Check that environment variables are populated (sorted alphabetically)
    const keyInputs = page.locator('input[placeholder="Key"]');
    const valueInputs = page.locator('input[placeholder="Value"]');

    await expect(keyInputs.first()).toHaveValue("FOO");
    await expect(valueInputs.first()).toHaveValue("bar");
  });
});
