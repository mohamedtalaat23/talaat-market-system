import { db } from '../config/database';

export class SettingsRepository {
  /**
   * Fetch all settings as a key-value dictionary
   */
  async getAllSettings(): Promise<Record<string, any>> {
    const rows = await db('settings').select('*');
    const settings: Record<string, any> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  }

  /**
   * Upsert settings
   */
  async updateSettings(payload: Record<string, any>, userId: number): Promise<Record<string, any>> {
    const keys = Object.keys(payload);
    if (keys.length === 0) return this.getAllSettings();

    const insertData = keys.map((key) => ({
      key,
      // Knex automatically serializes objects into JSON for jsonb columns, but if it is already a string we leave it or stringify complex objects.
      // Postgres jsonb column will accept a JS object natively via knex.
      value: payload[key],
      updated_by: userId,
      updated_at: new Date(),
    }));

    await db('settings')
      .insert(insertData)
      .onConflict('key')
      .merge(['value', 'updated_by', 'updated_at']);

    return this.getAllSettings();
  }
}

export const settingsRepository = new SettingsRepository();
