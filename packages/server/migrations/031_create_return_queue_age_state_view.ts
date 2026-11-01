import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Insert default settings for return queue aging
  await knex('settings')
    .insert([
      { key: 'return_queue_warning_minutes', value: JSON.stringify(15) },
      { key: 'return_queue_critical_minutes', value: JSON.stringify(30) }
    ])
    .onConflict('key')
    .merge(['value']);

  // 2. Create the View
  await knex.raw(`
    CREATE OR REPLACE VIEW "ReturnQueueAgeState" AS
    WITH thresholds AS (
        SELECT 
            COALESCE(MAX(CASE WHEN key = 'return_queue_warning_minutes' THEN (value)::text::integer END), 15) AS warn_min,
            COALESCE(MAX(CASE WHEN key = 'return_queue_critical_minutes' THEN (value)::text::integer END), 30) AS crit_min
        FROM settings
    )
    SELECT
        rq.queue_id,
        rq.created_at,
        EXTRACT(EPOCH FROM (now() - rq.created_at))/60 AS age_minutes,
        CASE
            WHEN EXTRACT(EPOCH FROM (now() - rq.created_at))/60 < t.warn_min THEN 'NORMAL'
            WHEN EXTRACT(EPOCH FROM (now() - rq.created_at))/60 < t.crit_min THEN 'WARNING'
            ELSE 'CRITICAL'
        END AS age_state
    FROM "ReturnQueue" rq
    CROSS JOIN thresholds t;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP VIEW IF EXISTS "ReturnQueueAgeState"');
  await knex('settings').whereIn('key', ['return_queue_warning_minutes', 'return_queue_critical_minutes']).delete();
}
