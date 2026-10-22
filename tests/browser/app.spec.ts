import { test, expect } from '@playwright/test';
test('desktop: report → inbox → claim → diary → chat → handover; no runtime errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hello, Olivia.' })).toBeVisible();
  await page.screenshot({ path: '/tmp/ras-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Report event', exact: false }).first().click();
  await expect(page.getByRole('heading', { name: 'Report an event' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Resident', exact: true }).selectOption('R-014');
  await page
    .getByPlaceholder('Add a short, factual description…')
    .fill('Browser workflow verification report.');
  await page.getByRole('button', { name: 'Send event', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Event sent' })).toBeVisible();
  await page.getByRole('button', { name: 'View event', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Event details' })
      .getByText('Browser workflow verification report.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Event details' })
    .getByRole('button', { name: 'Take charge', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Close event', exact: true })).toBeVisible();
  await page
    .getByPlaceholder('Record the outcome without changing the original report')
    .fill('Verified by the demo workflow.');
  await page.getByRole('button', { name: 'Close event', exact: true }).click();
  await expect(page.getByText('Recorded outcome')).toBeVisible();
  await page.getByRole('button', { name: 'Open event conversation', exact: true }).click();
  await expect(page.getByText('Connected to the official report.').first()).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Message colleagues' })
    .fill('Report outcome is now recorded.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByText('Report outcome is now recorded.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ward diary', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Search reports, resident IDs or places' })
    .fill('Browser workflow');
  await expect(
    page.getByText('Browser workflow verification report.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Handover', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shift handover', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Acknowledge this version', exact: true }).click();
  await expect(page.getByText('You acknowledged version 1')).toBeVisible();
  expect(errors).toEqual([]);
});
test('phone: assistant offline report, reconnect once, role switching and restricted routes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hello, Olivia.' })).toBeVisible();
  await page.screenshot({ path: '/tmp/ras-phone.png', fullPage: true });
  await page.getByRole('button', { name: 'Demo data' }).click();
  await page.getByLabel('View as', { exact: true }).selectOption('assistant');
  await expect(page.getByRole('heading', { name: 'Hello, Emma.' })).toBeVisible();
  await page.getByRole('button', { name: 'Demo data' }).click();
  await page.getByLabel('Simulate offline').check();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Report event', exact: true }).click();
  await page.getByRole('combobox', { name: 'Resident', exact: true }).selectOption('R-014');
  await page
    .getByPlaceholder('Add a short, factual description…')
    .fill('Offline browser verification.');
  await page.getByRole('button', { name: 'Send event', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Queued offline' })).toBeVisible();
  await expect(
    page.getByText(
      'Queued offline. Staff have not been notified. Use your ward’s urgent communication procedure.',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to workspace' }).click();
  await expect(
    page.getByRole('button', { name: '1 report pending synchronization' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Demo data' }).click();
  await page.getByLabel('Simulate offline').uncheck();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('button', { name: '1 report pending synchronization' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await page.getByRole('button', { name: /Willow care team/ }).click();
  await expect(page.getByRole('textbox', { name: 'Message colleagues' })).toBeVisible();
  await page.screenshot({ path: '/tmp/ras-phone-chat.png', fullPage: true });
  await page
    .getByRole('textbox', { name: 'Message colleagues' })
    .fill('A message from the mobile care team.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(
    page
      .locator('.conversation-thread')
      .getByText('A message from the mobile care team.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Demo data' }).click();
  await page.getByLabel('View as', { exact: true }).selectOption('management');
  await expect(page.getByRole('heading', { name: 'A shared view of operations.' })).toBeVisible();
  await page.getByLabel('Report date').fill('1900-01-01');
  await expect(
    page.locator('.stat-card').filter({ hasText: 'Reported events' }).locator('.stat-number'),
  ).toHaveText('0');
  await expect(page.getByRole('button', { name: 'Report event', exact: true })).toHaveCount(0);
  await page.goto('/#diary');
  await expect(page.getByRole('heading', { name: 'This page is unavailable' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('360px: every care route and full-screen report fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hello, Olivia.' })).toBeVisible();
  for (const route of ['home', 'inbox', 'diary', 'handover', 'shift', 'more', 'settings', 'chat']) {
    await page.goto('/#' + route);
    await page.waitForTimeout(80);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      route,
    ).toBe(true);
  }
  await page.getByRole('button', { name: 'Report event', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send event', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('document capture, OCR review, coordinator draft/sign and incoming acknowledgement', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/#diary');
  await page.getByRole('button', { name: 'Capture document' }).click();
  const capture = page.getByRole('dialog', { name: 'Capture a document' });
  await capture.getByRole('button', { name: 'Use synthetic sample' }).click();
  await capture.getByRole('button', { name: 'Attach', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Document extraction review' });
  await expect(review).toBeVisible();
  await review
    .getByLabel('Human-corrected text')
    .fill('Room 108 — follow-up at 14:30. Call bell checked.');
  await review.getByRole('button', { name: 'Confirm extracted text' }).click();
  await expect(review.getByText(/Reviewed by Olivia Bennett/)).toBeVisible();
  await expect(review.getByRole('button', { name: 'Validate clinical content' })).toHaveCount(0);
  await review.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Demo data' }).click();
  await page.getByLabel('View as', { exact: true }).selectOption('coordinator');
  await expect(page.getByRole('heading', { name: 'Hello, Sarah.' })).toBeVisible();
  await page.getByRole('button', { name: 'Team overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ward team overview' })).toBeVisible();
  await page.getByRole('button', { name: 'Handover', exact: true }).click();
  await page.getByLabel('Your shift summary').fill('All open follow-ups have source reports.');
  await page.getByRole('button', { name: 'Add contribution' }).click();
  await page.getByRole('button', { name: 'Prepare amendment draft' }).click();
  await expect(page.getByText('AI draft · review required')).toBeVisible();
  await page.getByRole('button', { name: 'Mark reviewed', exact: true }).click();
  await page.getByRole('button', { name: 'Sign outgoing handover', exact: true }).click();
  await expect(page.getByText('Signed version', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Demo data' }).click();
  await page.getByLabel('View as', { exact: true }).selectOption('assistant');
  await expect(page.getByRole('heading', { name: 'Hello, Emma.' })).toBeVisible();
  await page.goto('/#handover');
  await page.getByRole('button', { name: 'Acknowledge this version', exact: true }).click();
  await expect(page.getByText('You acknowledged version 2')).toBeVisible();
});
test('voice note and in-app camera produce playable and previewable attachments', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['microphone', 'camera']);
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Report event', exact: true }).click();
  await page.getByRole('combobox', { name: 'Resident', exact: true }).selectOption('R-014');
  await page.getByRole('button', { name: 'Record voice note', exact: true }).click();
  await expect(page.getByRole('button', { name: /Stop ·/ })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Stop ·/ }).click();
  await expect(page.locator('.media-preview audio')).toBeVisible();
  await page.getByRole('button', { name: 'Attach', exact: true }).click();
  await expect(page.getByText('Voice note', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open camera', exact: true }).click();
  await expect(page.locator('video')).toBeVisible();
  await page.waitForFunction(() => {
    const v = document.querySelector('video');
    return v && v.videoWidth > 0;
  });
  await page.getByRole('button', { name: 'Capture photo', exact: true }).click();
  await expect(page.getByAltText('Photo preview')).toBeVisible();
  await page.getByRole('button', { name: 'Attach', exact: true }).click();
  await expect(page.getByText('Event photo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Send event', exact: true }).click();
  await page.getByRole('button', { name: 'View event', exact: true }).click();
  const detail = page.getByRole('dialog', { name: 'Event details' });
  await expect(detail.locator('audio')).toBeVisible();
  await expect(detail.getByAltText('Event photo')).toBeVisible();
  expect(
    await detail
      .locator('audio')
      .evaluate((a: HTMLAudioElement) => a.src.startsWith('data:audio/')),
  ).toBe(true);
});
test('assistant has source links and denies cross-ward questions; technical admin has no care content', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ask RAS Assistant' }).click();
  await page.getByRole('button', { name: 'Show unresolved events in my ward.' }).click();
  await expect(page.locator('.ai-message .message-sources')).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Message RAS Assistant' })
    .fill('Show Cedar Ward reports for R-031.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(
    page
      .locator('.conversation-thread')
      .getByText('Access denied. I can only use records in your current authorized ward.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Demo data' }).click();
  await page.getByLabel('View as', { exact: true }).selectOption('administrator');
  await expect(page.getByRole('heading', { name: 'Accounts & access', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ward diary', exact: true })).toHaveCount(0);
  await expect(page.getByText('Alice Parker', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Integrations', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Corporate SSO / MFA' })).toBeVisible();
  await expect(page.getByText('Not connected', { exact: true })).toHaveCount(5);
  await page.goto('/#chat');
  await expect(page.getByRole('heading', { name: 'This page is unavailable' })).toBeVisible();
});
