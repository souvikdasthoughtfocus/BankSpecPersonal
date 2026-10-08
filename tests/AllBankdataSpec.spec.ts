import { expect, test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { BankDataReader } from './helper/AllbankDataHelper';

test('Process ALL banks sequentially with soft failures', async ({ page }) => {
  // Set test timeout to 30 minutes
  test.setTimeout(1800000);

  // File Paths
  const csvFilePath = path.join(__dirname, 'data', 'ACH_Spec_Values_By_Bank.csv');
  const externalJsonPath = 'C:/Users/107750/Downloads/Shrinidhi/ACH Testing PoC/data/bank_admin_settings.json';

  // Read and Validate Bank Data
  const groupedData = BankDataReader.readAndGroupBankData(csvFilePath);
  
  const allBankCodes = Object.keys(groupedData);
  const bankCodes = allBankCodes.slice(0, 10);

  if (bankCodes.length === 0) {
    throw new Error('No valid bank data found.');
  }

  console.log('\n==================================================');
  console.log(`TOTAL BANKS FOUND IN CSV: ${allBankCodes.length}`);
  console.log(`PROCESSING FIRST ${bankCodes.length} BANKS: ${bankCodes.join(', ')}`);
  console.log('==================================================');

  // Process Each Bank Sequentially
  for (let index = 0; index < bankCodes.length; index++) {
    const bankCode = bankCodes[index];

    // Master Step for the current Bank
    await test.step(`[BANK ${index + 1}/${bankCodes.length}] Processing Bank Code: ${bankCode}`, async () => {

      // -------------------------------------------------------------------------
      // FEATURE 1: Setup & Overwrite JSON
      // -------------------------------------------------------------------------
      await test.step(`[Bank ${bankCode}] Feature 1: JSON Overwrite`, async () => {
        try {
          const currentBankSpecs = groupedData[bankCode];
          BankDataReader.saveSingleBankFormattedJson(currentBankSpecs, externalJsonPath);
        } catch (err: any) {
          expect.soft(false, `JSON Overwrite failed: ${err.message}`).toBeTruthy();
        }
      });

      // -------------------------------------------------------------------------
      // FEATURE 2: Login & Admin Portal Navigation
      // -------------------------------------------------------------------------
      await test.step(`[Bank ${bankCode}] Feature 2: Admin Portal Login`, async () => {
        try {
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
          await bankIdInput.fill('202');

          await page.getByRole('button', { name: 'Log In' }).click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);
        } catch (err: any) {
          expect.soft(false, `Login failed: ${err.message}`).toBeTruthy();
        }
      });

      // -------------------------------------------------------------------------
      // FEATURE 3: Bank Settings & Fraud Settings
      // -------------------------------------------------------------------------
      await test.step(`[Bank ${bankCode}] Feature 3: Fraud Settings`, async () => {
        try {
          await page.locator('span', { hasText: 'Bank Settings' }).click();

          const bsHeading = page.locator('#ap-bs-heading');
          await expect.soft(bsHeading, 'Bank Settings Heading should be visible').toBeVisible({ timeout: 10000 });

          await page.locator('button[data-bs-tab="fraud"]').click();
          await page.locator('#ap-bs-fraud-provider').selectOption({ index: 2 });

          const channelIds = [
            '#ap-bs-chan-digital',
            '#ap-bs-chan-sftp',
            '#ap-bs-chan-viewer',
            '#ap-bs-chan-core',
            '#ap-bs-chan-fed',
          ];

          for (const id of channelIds) {
            const checkbox = page.locator(id);
            await checkbox.waitFor({ state: 'attached' });
            await checkbox.check();
          }

          await page.locator('#ap-bs-fraud-update-btn').click();

          const fraudSuccessMsg = page.getByText('fraud settings updated successfully', { exact: false });
          await expect.soft(fraudSuccessMsg, 'Fraud settings success toast missing').toBeVisible({ timeout: 3000 });
        } catch (err: any) {
          expect.soft(false, `Fraud Settings failed: ${err.message}`).toBeTruthy();
        }
      });

      // -------------------------------------------------------------------------
      // FEATURE 4: Bank History Extraction
      // -------------------------------------------------------------------------
      await test.step(`[Bank ${bankCode}] Feature 4: Bank History Extraction`, async () => {
        try {
          await page.locator('span', { hasText: 'Bank History' }).click();

          const bhBankInput = page.locator('#ap-bh-bank-number');
          await bhBankInput.waitFor({ state: 'visible' });
          await bhBankInput.clear();
          await bhBankInput.fill(bankCode);

          const firstBankOption = page.locator('#ap-bh-bank-dropdown .ap-search-select-item').first();
          await firstBankOption.waitFor({ state: 'visible', timeout: 3000 });
          await firstBankOption.click();

          const now = new Date();
          const endDate = now.toISOString().split('T')[0];
          const startDateObj = new Date();
          startDateObj.setMonth(now.getMonth() - 1);
          const startDate = startDateObj.toISOString().split('T')[0];

          await page.locator('#ap-bh-date-start').fill(startDate);
          await page.locator('#ap-bh-date-end').fill(endDate);
          await page.locator('#ap-bh-history-type').selectOption('Origination');

          await page.locator('#ap-bh-generate-btn').click();
          await expect.soft(page.getByRole('heading', { name: 'Extract Ready' }), 'Extract Ready heading missing').toBeVisible({ timeout: 10000 });
        } catch (err: any) {
          expect.soft(false, `Bank History Extraction failed: ${err.message}`).toBeTruthy();
        }
      });

      // -------------------------------------------------------------------------
      // FEATURE 5: Scheduled Tasks
      // -------------------------------------------------------------------------
      await test.step(`[Bank ${bankCode}] Feature 5: Scheduled Tasks`, async () => {
        try {
          const scheduledTasksBtn = page.getByRole('button', { name: 'Scheduled Tasks' });
          await scheduledTasksBtn.waitFor({ state: 'visible', timeout: 1000 });
          await scheduledTasksBtn.click();
          await page.getByRole('button', { name: 'Manage Tasks', exact: true }).click();
          await page.waitForLoadState('domcontentloaded');

          const nameInput = page.locator('input[name="name"]');
          await nameInput.waitFor({ state: 'visible' });
          await nameInput.clear();
          await nameInput.fill('taskbankspec');

          await page.locator('input[name="code"]').fill('123');
          await page.locator('input[name="account_number"]').fill('12345678');
          await page.locator('input[name="amount"]').fill('5000');
          await page.locator('input[name="effective_date"]').fill(new Date().toISOString().split('T')[0]);
          await page.locator('input[name="description"]').fill('desc');

          await page.getByRole('button', { name: 'Add Task' }).click();
        } catch (err: any) {
          expect.soft(false, `Scheduled Tasks failed: ${err.message}`).toBeTruthy();
        }
      });

      // -------------------------------------------------------------------------
      // FEATURE 6: Conversion - Company Profile
      // -------------------------------------------------------------------------
      await test.step(`[Bank ${bankCode}] Feature 6: Company Profile Conversion`, async () => {
        try {
          await page.getByRole('button', { name: 'Conversion' }).click();
          await page.getByRole('button', { name: 'Company Profile', exact: true }).click();
          await expect.soft(page.getByRole('heading', { name: 'Company Profile', level: 2 })).toBeVisible();

          const downloadDir = path.join(__dirname, 'data');
          const targetFilePath = path.join(downloadDir, '0000CompanyProfile.csv');

          if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
          }

          const downloadPromise = page.waitForEvent('download');
          await page.locator('#ap-cp-template-link').click();
          const download = await downloadPromise;
          await download.saveAs(targetFilePath);

          const bankNumberInput = page.locator('#ap-cp-bank-number');
          await bankNumberInput.waitFor({ state: 'visible' });
          await bankNumberInput.clear();
          await bankNumberInput.fill(bankCode);

          const fileChooserPromise = page.waitForEvent('filechooser');
          await page.locator('#ap-cp-choose-btn').click();
          const fileChooser = await fileChooserPromise;
          await fileChooser.setFiles(targetFilePath);

          await page.getByRole('button', { name: 'Run', exact: true }).click();

          const cpSuccessMsg = page.getByText(`Company Profile import completed for bank ${bankCode}`);
          await expect.soft(cpSuccessMsg, 'Company profile import completion message missing').toBeVisible({ timeout: 3000 });
        } catch (err: any) {
          expect.soft(false, `Company Profile Conversion failed: ${err.message}`).toBeTruthy();
        }
      });

      // -------------------------------------------------------------------------
      // FEATURE 7: Conversion - Filter Section
      // -------------------------------------------------------------------------
      await test.step(`[Bank ${bankCode}] Feature 7: Filter Conversion`, async () => {
        try {
          await page.getByRole('button', { name: 'Filter', exact: true }).click();

          const filterDownloadDir = path.join(__dirname, 'data');
          const filterFilePath = path.join(filterDownloadDir, '0000Filter.csv');
          const whitelistFilePath = path.join(filterDownloadDir, '0000Whitelist.csv');

          const filterDownloadPromise = page.waitForEvent('download');
          await page.getByText('Download Filter Template').click();
          const filterDownload = await filterDownloadPromise;
          await filterDownload.saveAs(filterFilePath);

          const whitelistDownloadPromise = page.waitForEvent('download');
          await page.getByText('Download Whitelist Template').click();
          const whitelistDownload = await whitelistDownloadPromise;
          await whitelistDownload.saveAs(whitelistFilePath);

          const filterBankInput = page.locator('#ap-fl-bank-number');
          await filterBankInput.waitFor({ state: 'visible' });
          await filterBankInput.clear();
          await filterBankInput.fill(bankCode);

          const filterChooserPromise = page.waitForEvent('filechooser');
          await page.locator('#ap-fl-choose-filter-btn').click();
          const filterChooser = await filterChooserPromise;
          await filterChooser.setFiles(filterFilePath);

          const whitelistChooserPromise = page.waitForEvent('filechooser');
          await page.locator('#ap-fl-choose-whitelist-btn').click();
          const whitelistChooser = await whitelistChooserPromise;
          await whitelistChooser.setFiles(whitelistFilePath);

          await page.getByRole('button', { name: 'Run', exact: true }).click();

          const filterSuccessMsg = page.getByText(`Filter import completed for bank ${bankCode}`);
          await expect.soft(filterSuccessMsg, 'Filter import completion message missing').toBeVisible({ timeout: 3000 });
        } catch (err: any) {
          expect.soft(false, `Filter Conversion failed: ${err.message}`).toBeTruthy();
        }
      });

      // -------------------------------------------------------------------------
      // FEATURE 8: Customer Lookup
      // -------------------------------------------------------------------------
      await test.step(`[Bank ${bankCode}] Feature 8: Customer Lookup`, async () => {
        try {
          await page.locator('span', { hasText: 'Customer Lookup' }).click();
          await expect.soft(page.locator('h1.ap-cv-title')).toHaveText('Customers');

          const customerName = 'Kim Prenzlow';
          const searchInput = page.locator('#ap-cv-search-input');
          await searchInput.waitFor({ state: 'visible' });
          await searchInput.clear();
          await searchInput.fill(customerName);

          const resultItem = page.locator('.ap-cv-result-item');
          await resultItem.waitFor({ state: 'visible', timeout: 5000 });
          await resultItem.locator('.ap-cv-result-name').click();

          // Wait 2 seconds for UI state to finalize
          await page.waitForTimeout(2000);

          // Check if the Error Modal appeared on screen
          const errorModalMsg = page.getByText('Unable to lookup the customer accounts', { exact: false });
          const errorModalHeading = page.getByRole('heading', { name: 'Error', exact: true });

          const isErrorDisplayed = 
            await errorModalMsg.isVisible().catch(() => false) || 
            await errorModalHeading.isVisible().catch(() => false);

          if (isErrorDisplayed) {
            expect.soft(
              false, 
              `[Bank ${bankCode}] BUG CAPTURED: Customer Lookup failed! 'Unable to lookup the customer accounts' error modal was displayed.`
            ).toBeTruthy();
          } else {
            // Verify Customer Details Dashboard loaded properly
            await expect.soft(
              page.getByRole('heading', { name: customerName, exact: true }),
              `[Bank ${bankCode}] BUG CAPTURED: Customer Dashboard failed to display.`
            ).toBeVisible({ timeout: 5000 });
          }

        } catch (err: any) {
          expect.soft(false, `Customer Lookup execution thrown error: ${err.message}`).toBeTruthy();
        }
      });

      // -------------------------------------------------------------------------
      // FEATURE 9: File Upload
      // -------------------------------------------------------------------------
      await test.step(`[Bank ${bankCode}] Feature 9: File Upload`, async () => {
        try {
          const fileUploadBtn = page.getByRole('button', { name: 'File Upload' });
          const uploadDisabled = await fileUploadBtn.evaluate((element) =>
            element.classList.contains('ap-nav-item--disabled') || element.hasAttribute('disabled')
          );

          const isBank2 = bankCode === '2' || bankCode === '002';
          const isBank3 = bankCode === '3' || bankCode === '003';

          if (isBank2) {
            expect.soft(uploadDisabled, 'Expected File Upload to be DISABLED').toBeTruthy();
          } else if (!uploadDisabled) {
            await fileUploadBtn.click();
            await page.waitForLoadState('domcontentloaded');

            if (isBank3) {
              const errorMessage = page.locator('text=File Upload is currently unavailable for this bank');
              await expect.soft(errorMessage, 'Unavailable error message missing').toBeVisible({ timeout: 2000 });
            } else {
              const filePathToUpload = path.join(__dirname, 'data', 'system_prompt.txt');
              const fileChooserPromise = page.waitForEvent('filechooser');

              await page.locator('#ap-file-input').click();
              const fileChooser = await fileChooserPromise;
              await fileChooser.setFiles(filePathToUpload);

              await page.getByRole('button', { name: 'Upload', exact: true }).click();

              const uploadStatus = page.locator('#ap-upload-status');
              await expect.soft(uploadStatus, 'Upload status success text missing').toContainText('Uploaded');
            }
          }
        } catch (err: any) {
          expect.soft(false, `File Upload failed: ${err.message}`).toBeTruthy();
        }
      });

      // -------------------------------------------------------------------------
      // FEATURE 10: File History
      // -------------------------------------------------------------------------
      await test.step(`[Bank ${bankCode}] Feature 10: File History`, async () => {
        try {
          const fileHistoryBtn = page.getByRole('button', { name: 'File History' });
          const historyDisabled = await fileHistoryBtn.evaluate((element) =>
            element.classList.contains('ap-nav-item--disabled') || element.hasAttribute('disabled')
          );

          const isBank2 = bankCode === '2' || bankCode === '002';

          if (isBank2) {
            expect.soft(historyDisabled, 'Expected File History to be DISABLED').toBeTruthy();
          } else if (!historyDisabled) {
            await fileHistoryBtn.click();
            await page.waitForLoadState('networkidle');
          }
        } catch (err: any) {
          expect.soft(false, `File History failed: ${err.message}`).toBeTruthy();
        }
      });

      // -------------------------------------------------------------------------
      // CLEANUP AFTER EACH BANK
      // -------------------------------------------------------------------------
      await test.step(`[Bank ${bankCode}] Clean up session`, async () => {
        try {
          const logoutBtn = page.getByRole('button', { name: 'Log Out' });
          if (await logoutBtn.isVisible().catch(() => false)) {
            await logoutBtn.click();
            await page.waitForLoadState('networkidle');
          }
          await page.context().clearCookies();
        } catch (cleanupErr) {
          console.warn(`[${bankCode}] Cleanup warning: ${(cleanupErr as Error).message}`);
        }
      });

    });
  }
});