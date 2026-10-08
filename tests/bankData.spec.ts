import { expect, test } from '@playwright/test';
import * as path from 'path';
import { BankDataReader } from './helper/bankDataHelper';

test('Process first 3 banks sequentially', async ({ page }) => {
  const csvFilePath = path.join(__dirname, 'data', 'ACH_Spec_Values_By_Bank.csv');
  const externalJsonPath = 'C:/Users/107750/Downloads/Shrinidhi/ACH Testing PoC - Sunil/data/bank_admin_settings.json';

  // 1. Read and group all banks
  const groupedData = BankDataReader.readAndGroupBankData(csvFilePath);
  const bankCodes = Object.keys(groupedData);

  if (bankCodes.length === 0) {
    throw new Error('No valid bank data found.');
  }

  // 2. Limit loop to process the first 3 banks
  const targetBanks = bankCodes.slice(0, 3);
  console.log(`Processing ${targetBanks.length} banks: ${targetBanks.join(', ')}`);

  for (const bankCode of targetBanks) {
    console.log(`\n--- Starting workflow for Bank Code: ${bankCode} ---`);
    const currentBankSpecs = groupedData[bankCode];

    // Step A: Save JSON for current bank
    BankDataReader.saveSingleBankFormattedJson(currentBankSpecs, externalJsonPath);

    // Step B: Login (dynamically passing current bankCode)
    await page.goto('http://127.0.0.1:5000/admin-portal');
    await page.locator('input[name="user_id"]').fill('test');
    await page.locator('input[name="password"]').fill('test');
    await page.locator('input[name="bank_id"]').fill('202');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Step C: Schedule task
    await page.getByRole('button', { name: 'Scheduled Tasks' }).click();
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="name"]').fill('taskbankspec');
    await page.locator('input[name="code"]').fill('123');
    await page.locator('input[name="account_number"]').fill('12345678');
    await page.locator('input[name="amount"]').fill('5000');
    
    // Dynamic today's date (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[name="effective_date"]').fill(today);
    await page.locator('input[name="description"]').fill('desc');

    await page.getByRole('button', { name: 'Add Task' }).click();
    await page.waitForTimeout(5000);

    // Step D: File Upload
    await page.getByRole('button', { name: 'File Upload' }).click();
    await page.waitForLoadState('networkidle');

    const filePathToUpload = path.join(__dirname, 'data', 'system_prompt.txt');
    const fileName = path.basename(filePathToUpload);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('#ap-file-input').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePathToUpload);

    await page.getByRole('button', { name: 'Upload', exact: true }).click();

    // Step E: Assert Upload Success
    await expect(page.locator('#ap-upload-status')).toContainText('Uploaded');
    await expect(page.locator('#ap-upload-status')).toContainText('successfully.');

    // Step F: File History Verification
    await page.getByRole('button', { name: 'File History' }).click();
    await page.waitForLoadState('networkidle');

   // await expect(page.getByRole('heading', { name: 'File History' })).toBeVisible();
    //await expect(page.getByText(fileName).first()).toBeVisible();

    //const firstHistoryRow = page.locator('table tbody tr, .ap-history-row').first();
    //await expect(firstHistoryRow).toContainText(fileName);
await page.getByRole('button', { name: 'Log Out' }).click();
    await page.waitForLoadState('networkidle');
    console.log(`Successfully finished operations for Bank: ${bankCode}`);
  }
});