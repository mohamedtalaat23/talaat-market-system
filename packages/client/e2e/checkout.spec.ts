import { test, expect } from '@playwright/test';

test.describe('Cashier Supermarket POS Integration Flow', () => {
  test('should log in, override manager PIN, open shift, search/scan products, and execute checkout payments', async ({ page }) => {
    // Monitor browser logs
    page.on('console', (msg) => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));

    // 1. Visit homepage (will redirect to login)
    await page.goto('/login');

    // Set language to English in localStorage to guarantee LTR and English selectors
    await page.evaluate(() => {
      localStorage.setItem('talaat_lang', 'en');
      localStorage.setItem('talaat_theme', 'dark');
    });
    // Reload the page to apply the language change
    await page.reload();

    // 2. Login as cashier1
    await page.fill('#username', 'cashier1');
    await page.fill('#password', 'cashier123');
    await page.click('button[type="submit"]');

    // Verify login is successful and redirects to dashboard (url is /)
    await expect(page).toHaveURL('/');
    
    // We should see cashier's name in layout header
    await expect(page.locator('header').locator('text=Sarah Connor')).toBeVisible();

    // 3. Navigate to POS
    // Find the Point of Sale link and click it
    await page.click('a[href="/pos"]');
    await expect(page).toHaveURL('/pos');

    // 4. POS Manager Override Modal triggers immediately
    // Wait for the manager override dialog to appear
    await expect(page.locator('#override-modal-title')).toBeVisible();

    // Select manager (dropdown #manager-select) containing Supermarket Manager
    await page.locator('#manager-select').selectOption({ label: 'Supermarket Manager (MANAGER)' });
    
    // Enter pin 2222
    await page.fill('#pin-input', '2222');
    
    // Click authorize (submit form button inside override modal)
    await page.click('button:has-text("Authorize Action")');

    // Wait for the manager override dialog to be hidden to prevent race conditions
    await expect(page.locator('#override-modal-title')).not.toBeVisible();

    // 5. Open Shift Drawer Flow (if not already open)
    const isLocked = await page.locator('text=POS Locked').isVisible();
    if (isLocked) {
      // Click Open Shift button
      await page.click('button:has-text("Open Shift")');

      // Open Register Shift Modal appears
      await expect(page.locator('text=Open Register Shift')).toBeVisible();

      // Enter starting cash
      await page.fill('input[type="number"]', '500');

      // Start shift
      await page.click('button:has-text("Start Shift")');

      // Verify shift is opened and lock overlay is gone
      await expect(page.locator('text=POS Locked')).not.toBeVisible();
    }

    await expect(page.locator('text=Shift Open').first()).toBeVisible();

    // Disable Auto-Print to verify Receipt Preview modal flow
    await page.click('button:has-text("Auto-Print")');

    // 6. Search and add products
    // Programmatically open the product search modal to bypass headless browser F-key limits
    await page.evaluate(() => {
      (window as any).__modalStore.getState().openModal('pos_product_search');
    });

    // Product Search Modal should be visible
    await expect(page.locator('text=Product Search')).toBeVisible();

    // Search input
    await page.fill('#search-input', 'Coca-Cola');

    // Wait for debounce/search query to fire and show Coca-Cola Can
    await page.waitForTimeout(600); // 400ms debounce + query time
    await expect(page.locator('text=Coca-Cola Can 330ml')).toBeVisible();

    // Select product by pressing Enter
    await page.keyboard.press('Enter');

    // Verify item is added to the cart
    await expect(page.locator('text=Product Search')).not.toBeVisible();
    await expect(page.locator('.font-semibold:has-text("Coca-Cola Can 330ml")')).toBeVisible();

    // 6b. Search and add second product: Mineral Water
    await page.evaluate(() => {
      (window as any).__modalStore.getState().openModal('pos_product_search');
    });
    await expect(page.locator('text=Product Search')).toBeVisible();
    await page.fill('#search-input', 'Mineral Water');
    await page.waitForTimeout(600); // Debounce
    await expect(page.locator('text=Mineral Water 1.5L')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Product Search')).not.toBeVisible();

    // Verify second item is added to the cart
    await expect(page.locator('.font-semibold:has-text("Mineral Water 1.5L")')).toBeVisible();

    // 7. Adjust quantity of Coca-Cola
    // Click Coca-Cola item in cart to focus it
    await page.click('.font-semibold:has-text("Coca-Cola Can 330ml")');
    
    // Press Enter to open the quantity modification modal
    await page.keyboard.press('Enter');
    
    // Wait for quantity modal
    await expect(page.locator('#quantity-modal-title')).toBeVisible();
    await page.fill('#quantity-input', '5');
    await page.click('button:has-text("Update Quantity")');

    // Verify the cart quantity updated to 5
    await expect(page.locator('span.font-mono:has-text("5")')).toBeVisible();

    // 8. Payment Flow (Cash checkout)
    // Click pay button
    await page.click('button:has-text("Pay")');

    // Payment Modal should appear
    await expect(page.locator('text=Checkout')).toBeVisible();

    // Enter cash amount >= total (e.g., 50.00 EGP)
    await page.fill('#cash-input', '50');

    // Click "Complete Sale"
    await page.click('button:has-text("Complete Sale")');

    // Receipt Preview modal should be visible
    await expect(page.locator('text=Thank you for shopping!')).toBeVisible();

    // Press Escape to close receipt preview
    await page.keyboard.press('Escape');

    // Verify cart is cleared and we are back to empty state
    await expect(page.locator('text=Scan barcode to add items')).toBeVisible();
  });
});
