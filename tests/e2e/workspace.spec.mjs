import { test, expect } from '@playwright/test';

test('social-work meeting workflow can be completed locally', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Dawith Welfare Office/);
  await page.getByRole('button', { name: /회의록 만들기/ }).click();
  await page.getByRole('button', { name: '예시 넣기' }).click();
  await page.getByRole('button', { name: /초안 만들기/ }).click();
  await expect(page.locator('#outputContent')).toBeVisible();
  await expect(page.locator('#outputText')).toHaveValue(/주요 안건/);
  await page.getByRole('button', { name: /검토한 기록 저장/ }).click();
  await page.getByRole('button', { name: '기록 보관함' }).click();
  await expect(page.locator('#allRecords .record-item')).toHaveCount(1);
  await page.locator('#allRecords [data-record]').first().click();
  await expect(page.locator('#workspaceView')).toHaveClass(/active/);
  await page.locator('#outputText').fill('검토자가 확인한 회의 요약입니다.');
  await page.getByRole('button', { name: /검토한 기록 저장/ }).click();
  await page.getByRole('button', { name: '기록 보관함' }).click();
  await page.locator('#recordSearch').fill('검토자가');
  await page.getByRole('button', { name: '검색' }).click();
  await expect(page.locator('#allRecords .record-item')).toHaveCount(1);
});

for (const [taskName, expectedText] of [['상담 내용 정리', '상담일지'], ['녹취 파일 정리', '녹취 기반 상담기록']]) {
  test(`${taskName} creates a visible local draft`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(taskName) }).click();
    await page.getByRole('button', { name: '예시 넣기' }).click();
    await page.getByRole('button', { name: /초안 만들기/ }).click();
    await expect(page.locator('#outputTitle')).toHaveText(new RegExp(expectedText));
    await expect(page.locator('#outputText')).not.toHaveValue('');
  });
}
