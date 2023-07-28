import { test } from '@playwright/test';

test('Confirm a blob datasource @CICompatible', async ({ page }) => {
  await page.goto('/');

  await page.locator('[id="GNURadioSigMFRepo"]').first().click();
  await page.locator('[id="IQEngineLogo"]').click();
});
