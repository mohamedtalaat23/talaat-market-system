import { db } from './src/config/database';

async function run() {
  try {
    // try to insert an audit log
    await db('audit_logs').insert({
      entity_type: 'test',
      action: 'test',
    });
    console.log('Insert OK');
    
    // try to update
    try {
      await db('audit_logs').where({ entity_type: 'test' }).update({ action: 'updated' });
      console.log('Update OK');
    } catch (e) {
      console.log('Update Error:', e.message);
    }
    
    // try to delete
    try {
      await db('audit_logs').where({ entity_type: 'test' }).del();
      console.log('Delete OK');
    } catch (e) {
      console.log('Delete Error:', e.message);
    }

    // try to query
    const results = await db('audit_logs').where({ entity_type: 'test' });
    console.log('Query OK, count:', results.length);

  } catch (e) {
    console.error('Fatal:', e);
  } finally {
    await db.destroy();
  }
}
run();
