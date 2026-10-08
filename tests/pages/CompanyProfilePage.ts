import { Page, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

export class CompanyProfilePage {
  constructor(private page: Page) {}

  async navigateToCompanyProfile() {
    await this.page.getByRole('button', { name: 'Conversion' }).click();
    await this.page.getByRole('button', { name: 'Company Profile', exact: true }).click();
    await expect(this.page.getByRole('heading', { name: 'Company Profile', level: 2 })).toBeVisible();
  }

  async downloadTemplate() {
    const downloadDir = path.join(__dirname, '..', 'data');
    const targetFilePath = path.join(downloadDir, '0000CompanyProfile.csv');

    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const downloadPromise = this.page.waitForEvent('download');
    await this.page.locator('#ap-cp-template-link').click();
    const download = await downloadPromise;

    await download.saveAs(targetFilePath);

    expect(fs.existsSync(targetFilePath)).toBeTruthy();
    expect(fs.statSync(targetFilePath).size).toBeGreaterThan(0);
  }
}