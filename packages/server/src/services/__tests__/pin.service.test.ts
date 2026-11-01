import { pinService } from '../pin.service';
import { db } from '../../config/database';
import bcrypt from 'bcryptjs';

jest.mock('../../config/database', () => {
  const mockDb = jest.fn().mockImplementation(() => {
    return {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      increment: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      first: jest.fn(),
    };
  });
  return { db: mockDb };
});

jest.mock('bcryptjs');

describe('PinService', () => {
  let mockFirst: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirst = jest.fn();
    (db as unknown as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      increment: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      first: mockFirst,
    });
  });

  it('should return error if manager is not found or has no pin_hash', async () => {
    mockFirst.mockResolvedValue(null);

    const result = await pinService.verifyPin(1, '1234');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Manager account not found');
  });

  it.each(['credential_rotation_required', 'must_change_password'])(
    'rejects approvals while %s is set',
    async (flag) => {
      mockFirst.mockResolvedValue({ id: 1, pin_hash: 'hashed_pin', [flag]: true });
      const result = await pinService.verifyPin(1, '482913');
      expect(result.success).toBe(false);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    },
  );

  it('should return error on incorrect PIN and countdown attempts', async () => {
    mockFirst.mockResolvedValue({
      id: 1,
      role: 'manager',
      is_active: true,
      pin_hash: 'hashed_pin',
      failed_pin_attempts: 0,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const result = await pinService.verifyPin(1, '1234');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid PIN');
    expect(result.message).toContain('4 attempt(s) remaining');
  });

  it('should lock out manager after 5 failed attempts', async () => {
    let attemptsCount = 0;
    mockFirst.mockImplementation(async () => ({
      id: 2,
      role: 'manager',
      is_active: true,
      pin_hash: 'hashed_pin2',
      failed_pin_attempts: attemptsCount++,
      pin_locked_until: attemptsCount > 5 ? new Date(Date.now() + 5 * 60 * 1000) : null,
    }));
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    // Call 4 times
    for (let i = 0; i < 4; i++) {
      await pinService.verifyPin(2, 'wrong');
    }

    // 5th attempt should lock out
    const result = await pinService.verifyPin(2, 'wrong');
    expect(result.success).toBe(false);
    expect(result.message).toContain('locked out');

    // 6th attempt should return early lockout message
    const lockedResult = await pinService.verifyPin(2, 'any');
    expect(lockedResult.success).toBe(false);
    expect(lockedResult.message).toContain('Too many failed PIN attempts');
  });

  it('should reset failed attempts and succeed on correct PIN', async () => {
    mockFirst.mockResolvedValue({
      id: 3,
      role: 'manager',
      is_active: true,
      pin_hash: 'hashed_pin3',
      failed_pin_attempts: 2,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await pinService.verifyPin(3, '5678');
    expect(result.success).toBe(true);
    expect(result.message).toContain('PIN successfully verified');
  });
});
