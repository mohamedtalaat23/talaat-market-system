import { settingsRepository } from '../settings.repository';
import { db } from '../../config/database';

jest.mock('../../config/database', () => {
  const mockDb = jest.fn();
  return { db: mockDb };
});

describe('SettingsRepository', () => {
  let mockQueryBuilder: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      onConflict: jest.fn().mockReturnThis(),
      merge: jest.fn().mockResolvedValue([]),
    };
    mockQueryBuilder.then = (resolve: any) => {
      resolve(mockQueryBuilder._resolvedValue || []);
    };
    (db as unknown as jest.Mock).mockReturnValue(mockQueryBuilder);
  });

  it('should fetch all settings as record key-value pairs', async () => {
    mockQueryBuilder._resolvedValue = [
      { key: 'store_name', value: 'My Store' },
      { key: 'tax_rate', value: 0.15 },
    ];

    const result = await settingsRepository.getAllSettings();
    expect(result.store_name).toBe('My Store');
    expect(result.tax_rate).toBe(0.15);
  });

  it('should bulk upsert settings', async () => {
    const payload = { store_name: 'New Name', timezone: 'UTC' };
    mockQueryBuilder._resolvedValue = [
      { key: 'store_name', value: 'New Name' },
      { key: 'timezone', value: 'UTC' },
    ];

    const result = await settingsRepository.updateSettings(payload, 1);

    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ key: 'store_name', value: 'New Name', updated_by: 1 }),
        expect.objectContaining({ key: 'timezone', value: 'UTC', updated_by: 1 }),
      ]),
    );
    expect(result.store_name).toBe('New Name');
  });
});
