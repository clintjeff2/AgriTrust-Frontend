import { test, expect } from './fixtures/test';

test.describe('Web3 Wallet and Soroban RPC Flows', () => {
  test('should login successfully with wallet and redirect', async ({ page, mockWallet }) => {
    await page.goto('/login');
    
    // Find and click wallet connect button
    const connectBtn = page.getByRole('button', { name: /connect|freighter|metamask|login/i }).first();
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();
    
    // Assert redirect and success UI state
    await expect(page).toHaveURL(/\/dashboard|\/inventory|network|\//);
    const connectedState = page.getByText(new RegExp(`connected|0x|${mockWallet.address.slice(0, 6)}`, 'i'));
    await expect(connectedState).toBeVisible();
  });

  test('should handle escrow deposit with optimistic updates', async ({ page }) => {
    await page.goto('/inventory');
    
    let getTransactionCallCount = 0;
    
    await page.route(url => url.includes('soroban') || url.includes('rpc') || url.includes('stellar'), async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const body = request.postDataJSON() || {};
        const method = body.method;
        
        if (method === 'sendTransaction') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                status: 'PENDING',
                hash: 'mock-tx-hash-123'
              }
            })
          });
        } else if (method === 'getTransaction') {
          getTransactionCallCount++;
          if (getTransactionCallCount === 1) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: body.id,
                result: {
                  status: 'PENDING',
                  hash: 'mock-tx-hash-123'
                }
              })
            });
          } else {
            // Delay by 2 seconds then return success
            await new Promise(resolve => setTimeout(resolve, 2000));
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: body.id,
                result: {
                  status: 'SUCCESS',
                  hash: 'mock-tx-hash-123',
                  resultXdr: 'AAAAAgAAAA...'
                }
              })
            });
          }
        } else if (method === 'getLatestLedger') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: { sequence: 100 }
            })
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {}
            })
          });
        }
      } else {
        await route.continue();
      }
    });

    const depositBtn = page.getByRole('button', { name: /deposit/i }).first();
    await expect(depositBtn).toBeVisible();
    await depositBtn.click();

    // Assert optimistic 'pending' UI state
    const pendingToast = page.getByText(/pending|processing|submitting/i);
    await expect(pendingToast).toBeVisible();

    // Assert confirmed UI state after the delay
    const confirmedToast = page.getByText(/success|confirmed|completed/i);
    await expect(confirmedToast).toBeVisible();
  });

  test('should rollback UI and display error toast on tx_bad_seq failure', async ({ page }) => {
    await page.goto('/inventory');
    
    await page.route(url => url.includes('soroban') || url.includes('rpc') || url.includes('stellar'), async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const body = request.postDataJSON() || {};
        const method = body.method;
        
        if (method === 'sendTransaction') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                status: 'FAILED',
                errorResultXdr: 'tx_bad_seq',
                hash: 'mock-tx-failed-123'
              }
            })
          });
        } else if (method === 'getLatestLedger') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: { sequence: 100 }
            })
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {}
            })
          });
        }
      } else {
        await route.continue();
      }
    });

    const depositBtn = page.getByRole('button', { name: /deposit/i }).first();
    await expect(depositBtn).toBeVisible();
    
    // Track original button state / page state if needed
    const initialText = await depositBtn.innerText();
    
    await depositBtn.click();

    // Assert error toast for tx_bad_seq is displayed
    const errorToast = page.getByText(/tx_bad_seq|failed|error/i);
    await expect(errorToast).toBeVisible();

    // Assert UI rolls back to previous state
    const currentText = await depositBtn.innerText();
    expect(currentText).toBe(initialText);
  });
});
