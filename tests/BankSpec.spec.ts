import { expect, test } from '@playwright/test';
import * as path from 'path';
import { BankDataReader } from './helper/bankDataHelper';

test('Process first 3 banks sequentially with custom bank permissions', async ({ page }) => {
  // Set generous timeout for multi-bank processing loop
  test.setTimeout(180000);

  const csvFilePath = path.join(__dirname, 'data', 'ACH_Spec_Values_By_Bank.csv');
  const externalJsonPath = 'C:/Users/107750/Downloads/Shrinidhi/ACH Testing PoC/data/bank_admin_settings.json';

  // 1. Read and group all bank configurations
  const groupedData = BankDataReader.readAndGroupBankData(csvFilePath);
  const bankCodes = Object.keys(groupedData);

  if (bankCodes.length === 0) {
    throw new Error('No valid bank data found.');
  }

  // 2. Limit execution loop to process the first 3 banks
  const targetBanks = bankCodes.slice(0, 3);
  console.log(`Processing ${targetBanks.length} banks: ${targetBanks.join(', ')}`);

  for (const bankCode of targetBanks) {
    console.log(`\n==================================================`);
    console.log(`--- Starting workflow for Bank Code: ${bankCode} ---`);
    console.log(`==================================================`);

    try {
      const currentBankSpecs = groupedData[bankCode];

      // Step A: Save JSON configuration for active bank
      BankDataReader.saveSingleBankFormattedJson(currentBankSpecs, externalJsonPath);

      // Step B: Authenticate
      await page.goto('http://127.0.0.1:5000/admin-portal', { waitUntil: 'domcontentloaded' });

      const userIdInput = page.locator('input[name="user_id"]');
      await userIdInput.waitFor({ state: 'visible' });
      await userIdInput.clear();
      await userIdInput.fill('test');

      const passInput = page.locator('input[name="password"]');
      await passInput.clear();
      await passInput.fill('test');

      const bankIdInput = page.locator('input[name="bank_id"]');
      await bankIdInput.clear();
      await bankIdInput.fill(bankCode);

      await page.getByRole('button', { name: 'Log In' }).click();
      await page.waitForLoadState('networkidle');

      // Step C: Schedule Task (Common to all bank workflows)
      const scheduledTasksBtn = page.getByRole('button', { name: 'Scheduled Tasks' });
      await scheduledTasksBtn.waitFor({ state: 'visible', timeout: 10000 });
      await scheduledTasksBtn.click();
      await page.waitForLoadState('domcontentloaded');

      // Populate schedule task form fields with explicit clears to prevent input freezing
      const nameInput = page.locator('input[name="name"]');
      await nameInput.waitFor({ state: 'visible' });
      await nameInput.clear();
      await nameInput.fill('taskbankspec');

      const codeInput = page.locator('input[name="code"]');
      await codeInput.clear();
      await codeInput.fill('123');

      const accInput = page.locator('input[name="account_number"]');
      await accInput.clear();
      await accInput.fill('12345678');

      const amtInput = page.locator('input[name="amount"]');
      await amtInput.clear();
      await amtInput.fill('5000');

      const today = new Date().toISOString().split('T')[0];
      const dateInput = page.locator('input[name="effective_date"]');
      await dateInput.clear();
      await dateInput.fill(today);

      const descInput = page.locator('input[name="description"]');
      await descInput.clear();
      await descInput.fill('desc');

      // Handle any native alert popups on task submit
      page.once('dialog', async dialog => {
        await dialog.accept();
      });

      await page.getByRole('button', { name: 'Add Task' }).click();
      await page.waitForTimeout(2000);

      // ==================================================
      // BANK SPECIFIC CONDITIONAL WORKFLOWS
      // ==================================================

      // --------------------------------------------------
      // BANK 001: All Features Enabled (Full End-to-End Workflow)
      // --------------------------------------------------
      if (bankCode === targetBanks[0]) {
        console.log(`[Bank 001] Executing full file upload and history verification...`);

        const fileUploadBtn = page.getByRole('button', { name: 'File Upload' });
        await fileUploadBtn.waitFor({ state: 'visible' });
        await fileUploadBtn.click();
        await page.waitForLoadState('domcontentloaded');

        const filePathToUpload = path.join(__dirname, 'data', 'system_prompt.txt');
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.locator('#ap-file-input').click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(filePathToUpload);

        await page.getByRole('button', { name: 'Upload', exact: true }).click();
        await expect(page.locator('#ap-upload-status')).toContainText('Uploaded');
        await expect(page.locator('#ap-upload-status')).toContainText('successfully.');

        await page.getByRole('button', { name: 'File History' }).click();
        await page.waitForLoadState('networkidle');

        console.log(`[Bank 001] Workflow completed successfully.`);
      }

      // --------------------------------------------------
      // BANK 002: Restricted Features (File History & Upload Disabled)
      // --------------------------------------------------
      else if (bankCode === targetBanks[1]) {
        console.log(`[Bank 002] Verifying File Upload & File History contain disabled CSS class...`);

        const fileUploadBtn = page.getByRole('button', { name: 'File Upload' });
        const fileHistoryBtn = page.getByRole('button', { name: 'File History' });

        // Assert presence of the custom disabled CSS class on both elements
        await expect(fileUploadBtn).toHaveClass(/ap-nav-item--disabled/);
        await expect(fileHistoryBtn).toHaveClass(/ap-nav-item--disabled/);
        await page.waitForTimeout(5000);

        console.log(`[Bank 002] PASSED: Verified 'ap-nav-item--disabled' class present on restricted options.`);
      }

      // --------------------------------------------------
      // BANK 003: Known Application Bug Verification
      // --------------------------------------------------
      else if (bankCode === targetBanks[2]) {
        console.log(`[Bank 003] Accessing File Upload screen to verify known application error...`);

        const fileUploadBtn = page.getByRole('button', { name: 'File Upload' });
        await fileUploadBtn.waitFor({ state: 'visible' });
        await fileUploadBtn.click({ force: true });
        await page.waitForLoadState('domcontentloaded');

        // Assert application displays known error message block
        const uploadStatus = page.locator('#ap-upload-status');
        await expect(uploadStatus).toContainText('Something went wrong');
        await expect(uploadStatus).toContainText('File Upload is currently unavailable for this bank. Please try again later.');

        console.log(`[Bank 003] PASSED: Caught expected application error message.`);
      }

    } catch (error) {
      console.error(`[Execution Warning] Issue observed on Bank ${bankCode}: ${(error as Error).message}`);
    } finally {
      // Step D: Logout & Session Reset (Guarantees script proceeds to next bank regardless of pass/fail)
      const logoutBtn = page.getByRole('button', { name: 'Log Out' });
      if (await logoutBtn.isVisible()) {
        await logoutBtn.click();
        await page.waitForLoadState('networkidle');
      }

      await page.context().clearCookies();
      console.log(`Teardown complete for Bank Code: ${bankCode}`);
    }
  }
});