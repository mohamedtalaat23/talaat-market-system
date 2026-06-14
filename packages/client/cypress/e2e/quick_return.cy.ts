describe('Quick Return UI - Hostile Testing', () => {
  beforeEach(() => {
    // Intercept API calls to mock backend
    cy.intercept('GET', '/api/products/barcode/*', {
      statusCode: 200,
      body: { success: true, data: { id: 'p123', name: 'Premium Espresso', selling_price: 15.50 } }
    }).as('scanProduct');

    cy.intercept('POST', '/api/return-queues', {
      statusCode: 201,
      body: { success: true, data: { queue_id: 'q456' } }
    }).as('createQueue');

    cy.intercept('POST', '/api/return-queues/*/scan', {
      statusCode: 200,
      body: { success: true }
    }).as('syncScan');

    cy.intercept('POST', '/api/return-queues/*/submit', {
      statusCode: 200,
      body: { success: true }
    }).as('submitQueue');

    // Login as admin for UI access
    cy.visit('/login');
    cy.get('input[name="username"]').type('admin');
    cy.get('input[name="password"]').type('admin123');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/pos');
  });

  it('HUI-3 Mitigation: Validates scanner-first Quick Return workflow', () => {
    // Open Quick Return Workspace via F10 keydown
    cy.get('body').trigger('keydown', { key: 'F10', force: true });
    
    // Verify Workspace is visible
    cy.contains('Quick Return Workspace').should('be.visible');
    
    // Simulate scanner barcode entry
    cy.get('body').trigger('keydown', { key: '1' });
    cy.get('body').trigger('keydown', { key: '2' });
    cy.get('body').trigger('keydown', { key: '3' });
    cy.get('body').trigger('keydown', { key: 'Enter' });

    // Wait for API sync
    cy.wait('@scanProduct');
    cy.wait('@createQueue');
    cy.wait('@syncScan');

    // Verify item was added to the list
    cy.contains('Premium Espresso').should('be.visible');

    // Submit queue
    cy.contains('Submit to Manager').click();
    cy.wait('@submitQueue');

    // Verify modal closed
    cy.contains('Quick Return Workspace').should('not.exist');
  });

  it('HUI-2 Mitigation: Disposition update triggers immediate sync without submitting queue', () => {
    cy.get('body').trigger('keydown', { key: 'F10', force: true });
    
    // Simulate scanner barcode entry
    cy.get('body').trigger('keydown', { key: '1' });
    cy.get('body').trigger('keydown', { key: 'Enter' });

    cy.wait('@scanProduct');
    cy.wait('@syncScan');

    // Change disposition to WRITE-OFF
    cy.get('select').first().select('NON_RESTOCKABLE');

    // Verify immediate background sync fired (HUI-2 Fix)
    cy.wait('@syncScan').then((interception) => {
      expect(interception.request.body.disposition).to.equal('NON_RESTOCKABLE');
      expect(interception.request.body.quantity).to.equal(0);
    });

    // Try to submit missing reason (should fail)
    cy.contains('Submit to Manager').click();
    cy.contains('Missing disposition or reason on some items').should('be.visible');

    // Set reason
    cy.get('select').last().select('DAMAGED');
    cy.wait('@syncScan').then((interception) => {
      expect(interception.request.body.non_restock_reason).to.equal('DAMAGED');
    });

    // Now submit successfully
    cy.contains('Submit to Manager').click();
    cy.wait('@submitQueue');
  });

  it('F8 Receipt Lookup populates return items', () => {
    cy.intercept('GET', '/api/pos/receipts/*', {
      statusCode: 200,
      body: { 
        success: true, 
        data: { 
          id: 'sale789', 
          lines: [
            { id: 'l1', product_id: 'p123', product_name: 'Premium Espresso', quantity: 2, unit_price: 15.50 }
          ] 
        } 
      }
    }).as('lookupReceipt');

    cy.get('body').trigger('keydown', { key: 'F10', force: true });
    
    // Press F8 for Receipt mode
    cy.get('body').trigger('keydown', { key: 'F8', force: true });
    
    // Check if input is focused
    cy.get('input[placeholder="Scan Receipt Barcode and press Enter..."]').type('sale789{enter}');

    cy.wait('@lookupReceipt');
    cy.wait('@syncScan'); // Verify auto-sync of loaded items

    cy.contains('Premium Espresso').should('be.visible');
    cy.contains('RECEIPTED').should('be.visible'); // Queue type verified
  });
});
