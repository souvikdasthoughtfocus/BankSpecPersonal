import { Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('http://127.0.0.1:5000/admin-portal', { waitUntil: 'domcontentloaded' });
  }

  async login(userId: string, pass: string, bankId: string) {
    const userIdInput = this.page.locator('input[name="user_id"]');
    await userIdInput.waitFor({ state: 'visible' });
    await userIdInput.clear();
    await userIdInput.fill(userId);

    const passInput = this.page.locator('input[name="password"]');
    await passInput.clear();
    await passInput.fill(pass);

    const bankIdInput = this.page.locator('input[name="bank_id"]');
    await bankIdInput.clear();
    await bankIdInput.fill(bankId);

    await this.page.getByRole('button', { name: 'Log In' }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async logout() {
    const logoutBtn = this.page.getByRole('button', { name: 'Log Out' });
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await this.page.waitForLoadState('networkidle');
    }
  }
}