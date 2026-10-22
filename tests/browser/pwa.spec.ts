import { test, expect } from '@playwright/test';
test('production PWA: offline shell reload, queued report survives reload and syncs once', async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.TEST_BASE_URL,
    'Service worker is intentionally disabled in development. Run against npm run preview.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hello, Olivia.' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hello, Olivia.' })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hello, Olivia.' })).toBeVisible();
  await page.getByRole('button', { name: 'Report event', exact: true }).click();
  await page.getByRole('combobox', { name: 'Resident', exact: true }).selectOption('R-014');
  await page
    .getByPlaceholder('Add a short, factual description…')
    .fill('PWA offline persistence verification.');
  await page.getByRole('button', { name: 'Send event', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Queued offline' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to workspace' }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: '1 report pending synchronization' }),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: '1 report pending synchronization' })).toHaveCount(
    0,
  );
  await page.goto('/#diary');
  await page
    .getByRole('textbox', { name: 'Search reports, resident IDs or places' })
    .fill('PWA offline persistence verification');
  await expect(
    page.getByText('PWA offline persistence verification.', { exact: true }),
  ).toHaveCount(1);
  const cached = await page.evaluate(async () => {
    const result: string[] = [];
    for (const key of await caches.keys()) {
      const c = await caches.open(key);
      result.push(...(await c.keys()).map((r) => new URL(r.url).pathname));
    }
    return result;
  });
  expect(cached).toContain('/');
  expect(cached.some((p) => p.startsWith('/assets/'))).toBe(true);
  expect(cached.some((p) => p.startsWith('/api') || p.includes('MEDIA'))).toBe(false);
});
