import { db } from './src/config/database';
import { employeeService } from './src/services/employee.service';
import { employeeRepository } from './src/repositories/employee.repository';
import { auditService } from './src/services/audit.service';

async function run() {
  try {
    const empBefore = await employeeRepository.findById(1);
    console.log('Before role:', empBefore?.role);

    const oldLogEvent = auditService.logEvent;
    auditService.logEvent = async (input) => {
      throw new Error('Forced Audit Failure');
    };

    try {
      await employeeService.updateEmployee(1, { role: 'cashier' }, 'admin');
      console.log('Employee update succeeded (Should not happen!)');
    } catch (e) {
      console.log('Employee update failed as expected:', e.message);
    }

    const empAfter = await employeeRepository.findById(1);
    console.log('After role:', empAfter?.role);
    
    auditService.logEvent = oldLogEvent;
  } catch (e) {
    console.error('Fatal:', e);
  } finally {
    await db.destroy();
  }
}
run();
