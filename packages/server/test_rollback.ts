import { db } from './src/config/database';
import { productService } from './src/services/product.service';
import { productRepository } from './src/repositories/product.repository';
import { auditService } from './src/services/audit.service';

async function run() {
  try {
    const prodBefore = await productRepository.findById(1);
    console.log('Before price:', prodBefore?.selling_price);

    const oldLogEvent = auditService.logEvent;
    auditService.logEvent = async (input) => {
      throw new Error('Forced Audit Failure');
    };

    try {
      await productService.updateProduct(1, { selling_price: 9999.99 });
      console.log('Product update succeeded (Should not happen!)');
    } catch (e) {
      console.log('Product update failed as expected:', e.message);
    }

    const prodAfter = await productRepository.findById(1);
    console.log('After price:', prodAfter?.selling_price);
    
    auditService.logEvent = oldLogEvent;
  } catch (e) {
    console.error('Fatal:', e);
  } finally {
    await db.destroy();
  }
}
run();
