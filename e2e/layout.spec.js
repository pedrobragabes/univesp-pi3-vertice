import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
test('interface cabe em 320 px e o atalho de teclado alcança o conteúdo', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [name, path] of [['home', '/'], ['list', '/inspecoes'], ['form', '/inspecoes/nova'], ['method', '/sobre']]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const result = await new AxeBuilder({ page }).analyze();
    await writeFile(info.outputPath(`axe-${name}.json`), JSON.stringify(result.violations, null, 2));
    expect(result.violations).toEqual([]);
    await page.screenshot({ path: info.outputPath(`${name}.png`) });
  }
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});
