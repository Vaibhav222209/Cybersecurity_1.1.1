import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const passwordModule = 'Better passwords, safer accounts';
const passingAnswers = [
  'A password stolen from one service cannot be reused on your other accounts.',
  'A passkey or a compatible security key.',
  'Replace it with a unique password, check account activity, and enable MFA.',
];
const failingAnswers = [
  'It makes every website load faster.',
  'A password made from your birthday.',
  'Wait until your next scheduled password change.',
];
const taskTitle = 'Use unique passwords for important accounts';
const storageKey = 'cipher-workspace-v1';

async function navigate(page: Page, label: string) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: new RegExp(`^${label}(?: \\d+)?$`) }).click();
}

async function startPasswordQuiz(page: Page) {
  await navigate(page, 'Learning path');
  await page.getByRole('button', { name: new RegExp(passwordModule) }).click();
  const dialog = page.getByRole('dialog', { name: passwordModule });
  await expect(dialog.getByRole('heading', { name: 'Make every password unique' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Next lesson', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Add another layer' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Next lesson', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Keep recovery under your control' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Take the quiz', exact: true }).click();
  return dialog;
}

async function answerQuiz(page: Page, answers: string[], expectedCorrect: boolean[]) {
  const dialog = page.getByRole('dialog', { name: passwordModule });
  for (let index = 0; index < answers.length; index += 1) {
    const next = dialog.getByRole('button', { name: index === 2 ? 'See results' : 'Next question', exact: true });
    await expect(next).toBeDisabled();
    const answer = dialog.getByRole('button').filter({ hasText: answers[index] });
    await answer.click();
    await expect(answer).toBeDisabled();
    await expect(dialog.getByRole('status')).toContainText(expectedCorrect[index] ? 'Exactly right.' : 'A useful thing to learn.');
    await next.click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Your security starts here.' })).toBeVisible();
});

test('navigation, keyboard search, no-match feedback, and result actions work', async ({ page }) => {
  await navigate(page, 'Learning path');
  await expect(page.getByRole('heading', { level: 1, name: 'Learn the habits that matter.' })).toBeVisible();
  await expect(page.locator('.all-modules .module-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Intermediate', exact: true }).click();
  await expect(page.locator('.all-modules .module-card')).toHaveCount(2);
  await page.keyboard.press('/');
  const search = page.getByRole('dialog', { name: 'Find your next step' });
  await expect(search).toBeVisible();
  await search.getByRole('textbox', { name: 'Search modules and tools' }).fill('no-matching-cipher-content');
  await expect(search).toContainText('No matches for');
  await search.getByRole('button', { name: 'Clear search' }).click();
  await search.getByRole('textbox', { name: 'Search modules and tools' }).fill('SHA-256');
  await search.getByRole('button', { name: /SHA-256 calculator/ }).click();
  await expect(search).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'A fingerprint for your text.' })).toBeVisible();
  await expect(page).toHaveURL(/#\/tools$/);
  await page.getByRole('button', { name: 'About Cipher' }).click();
  await expect(page.getByRole('dialog', { name: 'A little about Cipher' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('reading lessons and passing a quiz persists module completion after reload', async ({ page }) => {
  await startPasswordQuiz(page);
  await answerQuiz(page, passingAnswers, [true, true, true]);
  const dialog = page.getByRole('dialog', { name: passwordModule });
  await expect(dialog).toContainText('MODULE COMPLETE');
  await expect(dialog.getByText('3 of 3', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep exploring' }).click();
  await page.reload();
  await expect(page.locator('.learning-progress-end')).toContainText('1 / 6 complete');
  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page.locator('.all-modules .module-card')).toHaveCount(1);
  await expect(page.locator('.all-modules .module-card')).toContainText(passwordModule);
  await navigate(page, 'Overview');
  await expect(page.locator('.stat-card').filter({ hasText: 'Best quiz score' })).toContainText('100%');
  await expect(page.locator('.activity-list')).toContainText('Completed Better passwords, safer accounts · 3/3 correct');
});

test('a failed quiz stays incomplete, and a two-answer retake passes', async ({ page }) => {
  await startPasswordQuiz(page);
  await answerQuiz(page, failingAnswers, [false, false, false]);
  const dialog = page.getByRole('dialog', { name: passwordModule });
  await expect(dialog).toContainText('KEEP PRACTICING');
  await expect(dialog.getByText('0 of 3', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload();
  await expect(page.locator('.learning-progress-end')).toContainText('0 / 6 complete');
  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your first milestone is ahead.' })).toBeVisible();
  await page.getByRole('button', { name: 'All modules', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(passwordModule) }).click();
  await dialog.getByRole('button', { name: 'Next lesson', exact: true }).click();
  await dialog.getByRole('button', { name: 'Next lesson', exact: true }).click();
  await dialog.getByRole('button', { name: 'Take the quiz' }).click();
  await answerQuiz(page, [passingAnswers[0], passingAnswers[1], failingAnswers[2]], [true, true, false]);
  await expect(dialog).toContainText('MODULE COMPLETE');
  await expect(dialog.getByText('2 of 3', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep exploring' }).click();
  await page.reload();
  await expect(page.locator('.learning-progress-end')).toContainText('1 / 6 complete');
});

test('reviewing lessons after a failed quiz starts a fresh answerable quiz', async ({ page }) => {
  await startPasswordQuiz(page);
  await answerQuiz(page, failingAnswers, [false, false, false]);
  const dialog = page.getByRole('dialog', { name: passwordModule });
  await expect(dialog).toContainText('KEEP PRACTICING');
  await dialog.getByRole('button', { name: 'Review lessons', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Make every password unique' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Next lesson', exact: true }).click();
  await dialog.getByRole('button', { name: 'Next lesson', exact: true }).click();
  await dialog.getByRole('button', { name: 'Take the quiz', exact: true }).click();
  await expect(dialog).toContainText('Question 1 of 3');
  await expect(dialog.getByRole('heading', { name: 'Why should each account have its own password?' })).toBeVisible();
  for (const option of await dialog.locator('.quiz-option').all()) await expect(option).toBeEnabled();
  await expect(dialog.getByRole('status')).toHaveCount(0);
  await answerQuiz(page, passingAnswers, [true, true, true]);
  await expect(dialog).toContainText('MODULE COMPLETE');
  await expect(dialog.getByText('3 of 3', { exact: true })).toBeVisible();
});

test('checklist filters, completion totals, and checked states persist', async ({ page }) => {
  await navigate(page, 'Security checklist');
  await expect(page.getByRole('checkbox')).toHaveCount(10);
  const firstTask = page.getByRole('checkbox', { name: new RegExp(taskTitle) });
  await firstTask.check();
  await expect(page.locator('.checklist-summary')).toContainText('1 of 10 tasks complete.');
  await page.getByRole('button', { name: 'Network', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(2);
  await expect(page.locator('.checklist-items')).not.toContainText(taskTitle);
  await page.getByRole('checkbox', { name: /Use WPA3 or WPA2-AES/ }).check();
  await expect(page.locator('.checklist-summary')).toContainText('2 of 10 tasks complete.');
  await page.reload();
  await expect(firstTask).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Use WPA3 or WPA2-AES/ })).toBeChecked();
  await firstTask.uncheck();
  await page.reload();
  await expect(firstTask).not.toBeChecked();
  await expect(page.locator('.checklist-summary')).toContainText('1 of 10 tasks complete.');
});

test('password checker and generator behave correctly without saving secrets', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await navigate(page, 'Security tools');
  const password = page.getByLabel('Password to check');
  await password.fill('password123');
  await page.getByRole('button', { name: 'Check password', exact: true }).click();
  await expect(page.locator('.tool-strength-label')).toContainText('Weak');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  const secret = '7tY!52nQR$8xvCmb#PLw';
  await password.fill(secret);
  await expect(page.locator('.tool-strength-label')).toContainText('Very strong');
  await page.getByRole('button', { name: 'Password generator', exact: false }).click();
  await page.getByRole('button', { name: 'Generate password', exact: true }).click();
  const generated = await page.locator('.tool-copy-output code').innerText();
  expect(generated).toHaveLength(20);
  expect(generated).toMatch(/[a-z]/);
  expect(generated).toMatch(/[A-Z]/);
  expect(generated).toMatch(/\d/);
  expect(generated).toMatch(/[^a-zA-Z0-9]/);
  await page.getByRole('button', { name: 'Copy generated password' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Copied to clipboard.' })).toHaveText('Copied to clipboard.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(generated);
  await page.getByLabel(/Uppercase letters/).uncheck();
  await page.getByLabel(/Lowercase letters/).uncheck();
  await page.getByLabel(/Numbers/).uncheck();
  await page.getByLabel(/Symbols/).uncheck();
  await page.getByRole('button', { name: 'Generate another password', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Select at least one character type.');
  await page.getByLabel(/Numbers/).check();
  await page.getByRole('button', { name: 'Generate password', exact: true }).click();
  await expect(page.locator('.tool-copy-output code')).toHaveText(/^\d{20}$/);
  const saved = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  expect(saved).not.toContain(secret);
  expect(saved).not.toContain(generated);
});

test('SHA-256 produces known digests, supports empty text, and clears stale results', async ({ page }) => {
  await navigate(page, 'Security tools');
  await page.getByRole('button', { name: /SHA-256 hash/ }).click();
  await page.getByLabel('Text to hash').fill('abc');
  await page.getByRole('button', { name: 'Generate SHA-256 hash' }).click();
  await expect(page.locator('.tool-hash-output code')).toHaveText('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  await page.getByLabel('Text to hash').fill('');
  await expect(page.locator('.tool-hash-output')).toHaveCount(0);
  await page.getByRole('button', { name: 'Generate SHA-256 hash' }).click();
  await expect(page.locator('.tool-hash-output code')).toHaveText('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  await page.getByLabel('Text to hash').fill('new input');
  await expect(page.locator('.tool-hash-output')).toHaveCount(0);
});

test('URL inspection identifies an obscured host without contacting it or saving the URL', async ({ page }) => {
  await navigate(page, 'Security tools');
  await page.getByRole('button', { name: /URL inspector/ }).click();
  const externalRequests: string[] = [];
  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(requestUrl.hostname)) {
      externalRequests.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });
  const suspiciousUrl = 'http://bank.example@192.0.2.4/verify';
  await page.getByLabel('Link to inspect').fill(suspiciousUrl);
  await page.getByRole('button', { name: 'Inspect link' }).click();
  await expect(page.locator('.tool-risk-high')).toBeVisible();
  await expect(page.locator('.tool-url-result')).toContainText('192.0.2.4');
  await expect(page.locator('.tool-url-result')).toContainText('Credentials before the destination');
  await expect(page.locator('.tool-url-result')).toContainText('Unencrypted connection');
  expect(externalRequests).toEqual([]);
  const saved = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  expect(saved).not.toContain(suspiciousUrl);
  await page.getByLabel('Link to inspect').fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Inspect link' }).click();
  await expect(page.locator('.tool-url-result')).toContainText('Unsupported address');
  expect(externalRequests).toEqual([]);
});

test('settings exports real progress and reset requires an explicit confirmation', async ({ page }) => {
  await navigate(page, 'Security checklist');
  await page.getByRole('checkbox', { name: new RegExp(taskTitle) }).check();
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Workspace settings' });
  const downloadPromise = page.waitForEvent('download');
  await settings.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('cipher-progress.json');
  const path = await download.path();
  expect(path).not.toBeNull();
  const exported = JSON.parse(await readFile(path!, 'utf8'));
  expect(exported.version).toBe(1);
  expect(exported.checkedItems).toEqual(['unique-passwords']);
  expect(exported.activities).toHaveLength(1);
  await settings.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(settings.getByRole('alert')).toContainText('Clear all of your saved progress?');
  await settings.getByRole('button', { name: 'Keep my progress' }).click();
  await expect(settings.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).checkedItems.length, storageKey)).toBe(1);
  await settings.getByRole('button', { name: 'Reset', exact: true }).click();
  await settings.getByRole('button', { name: 'Yes, clear progress' }).click();
  await settings.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('checkbox', { name: new RegExp(taskTitle) })).not.toBeChecked();
  await expect(page.locator('.checklist-summary')).toContainText('0 of 10 tasks complete.');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: new RegExp(taskTitle) })).not.toBeChecked();
});

test('mobile navigation, tool forms, and dialogs fit a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  const assertNoOverflow = async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  };
  await assertNoOverflow();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await navigate(page, 'Security tools');
  await expect(page.getByRole('heading', { name: 'Your everyday security toolkit.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: /SHA-256 hash/ }).click();
  await page.getByLabel('Text to hash').fill('mobile');
  await page.getByRole('button', { name: 'Generate SHA-256 hash' }).click();
  await expect(page.locator('.tool-hash-output code')).toHaveText(/^[a-f0-9]{64}$/);
  await assertNoOverflow();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await navigate(page, 'Learning path');
  await page.getByRole('button', { name: new RegExp(passwordModule) }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const dialogBounds = await page.getByRole('dialog').boundingBox();
  expect(dialogBounds).not.toBeNull();
  expect(dialogBounds!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBounds!.width).toBeLessThanOrEqual(390);
  await assertNoOverflow();
});

test('keyboard skip preserves the tools route and the 320px sidebar stays inert until opened', async ({ page }) => {
  await page.goto('/#/tools');
  await expect(page.getByRole('heading', { name: 'Your everyday security toolkit.' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page).toHaveURL(/#\/tools$/);
  await page.setViewportSize({ width: 320, height: 760 });
  const sidebar = page.locator('.sidebar');
  await expect(sidebar).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(sidebar).not.toHaveAttribute('inert', '');
  await navigate(page, 'Overview');
  await expect(sidebar).toHaveAttribute('inert', '');
  const explore = page.getByRole('button', { name: 'Explore tools', exact: true });
  await expect(explore).toBeVisible();
  const bounds = await explore.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
