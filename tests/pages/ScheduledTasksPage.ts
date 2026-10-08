import { Page } from '@playwright/test';

export class ScheduledTasksPage {
  constructor(private page: Page) {}

  async openModule() {
    const scheduledTasksBtn = this.page.getByRole('button', { name: 'Scheduled Tasks' });
    await scheduledTasksBtn.waitFor({ state: 'visible', timeout: 10000 });
    await scheduledTasksBtn.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async fillTaskForm(details: { name: string; code: string; account: string; amount: string; description: string }) {
    const nameInput = this.page.locator('input[name="name"]');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.clear();
    await nameInput.fill(details.name);

    await this.page.locator('input[name="code"]').clear();
    await this.page.locator('input[name="code"]').fill(details.code);

    await this.page.locator('input[name="account_number"]').clear();
    await this.page.locator('input[name="account_number"]').fill(details.account);

    await this.page.locator('input[name="amount"]').clear();
    await this.page.locator('input[name="amount"]').fill(details.amount);

    const today = new Date().toISOString().split('T')[0];
    await this.page.locator('input[name="effective_date"]').clear();
    await this.page.locator('input[name="effective_date"]').fill(today);

    await this.page.locator('input[name="description"]').clear();
    await this.page.locator('input[name="description"]').fill(details.description);
  }

  async submitTask(bankCode: string) {
    this.page.once('dialog', async (dialog) => {
      console.log(`[${bankCode}] Dialog: ${dialog.message()}`);
      await dialog.accept();
    });

    await this.page.getByRole('button', { name: 'Add Task' }).click();
    await this.page.waitForTimeout(2000);
  }
}