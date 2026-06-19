import { test, expect } from './fixtures/test';

test.describe('Web3 Wallet and Soroban RPC Flows', () => {
  test('should connect wallet successfully and display balance', async ({ page }) => {
    await page.goto('/wallet');
    
    // Check balance to connect wallet
    const checkBalanceBtn = page.getByRole('button', { name: /Check Balance/i });
    await expect(checkBalanceBtn).toBeVisible();
    await checkBalanceBtn.click();
    
    // Assert balance is displayed
    const balanceText = page.locator('text=-- XLM');
    await expect(balanceText).toBeVisible();

    // Assert transaction panel is now visible
    const txHeading = page.getByRole('heading', { name: /Soroban Transaction/i });
    await expect(txHeading).toBeVisible();
  });

  test('should handle transaction submission with optimistic pending state', async ({ page }) => {
    await page.goto('/wallet');
    
    // Connect wallet
    await page.getByRole('button', { name: /Check Balance/i }).click();
    
    // Fill transaction hash
    const hashInput = page.getByPlaceholder(/Transaction hash/i);
    await expect(hashInput).toBeVisible();
    await hashInput.fill('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
    
    // Submit transaction
    const submitBtn = page.getByRole('button', { name: /Submit/i });
    await expect(submitBtn).toBeEnabled();
    
    // Click submit and check optimistic state
    await submitBtn.click();
    
    // Assert results output is displayed
    const resultJson = page.locator('pre');
    await expect(resultJson).toBeVisible();
    await expect(resultJson).toContainText('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
    await expect(resultJson).toContainText('pending');
  });

  test('should validate transaction input state correctly', async ({ page }) => {
    await page.goto('/wallet');
    
    // Connect wallet
    await page.getByRole('button', { name: /Check Balance/i }).click();
    
    const hashInput = page.getByPlaceholder(/Transaction hash/i);
    const submitBtn = page.getByRole('button', { name: /Submit/i });
    
    // Initial state: empty input, disabled submit
    await expect(hashInput).toHaveValue('');
    await expect(submitBtn).toBeDisabled();
    
    // Fill input: enabled submit
    await hashInput.fill('mock-hash-val');
    await expect(submitBtn).toBeEnabled();
    
    // Clear input: disabled submit
    await hashInput.fill('');
    await expect(submitBtn).toBeDisabled();
  });
});
