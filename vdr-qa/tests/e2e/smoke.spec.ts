import { test, expect, Page } from '@playwright/test';

// Selectors are ASSUMED - adjust after a first look at the UI (prefer getByRole / getByLabel).
async function loginUi(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log ?in|sign ?in/i }).click();
}

test.describe('UI smoke', () => {
  test('owner can log in', async ({ page }) => {
    await loginUi(page, process.env.OWNER_EMAIL!, process.env.OWNER_PASSWORD!);
    await expect(page.getByLabel(/password/i)).toBeHidden();
  });

  test('refresh on a deep link does not 404 (SPA fallback, past regression)', async ({ page }) => {
    await loginUi(page, process.env.OWNER_EMAIL!, process.env.OWNER_PASSWORD!);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    await page.reload();
    expect(page.url()).toBe(url);
    await expect(page.locator('body')).not.toContainText(/404|not found/i);
  });

  test.fixme('logout clears previous user data (cache leak, past regression)', async () => {
    // login john -> logout -> login viewer -> assert none of john's folders are visible
  });
});
