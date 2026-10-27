import { posController } from '../pos.controller';
import { db } from '../../config/database';
import { posRepository } from '../../repositories/pos.repository';

jest.mock('../../config/database', () => {
  const chain: any = { where: jest.fn(), first: jest.fn() };
  chain.where.mockReturnValue(chain);
  return { db: jest.fn(() => chain) };
});

jest.mock('../../repositories/pos.repository', () => ({
  posRepository: { getShiftSummary: jest.fn() },
}));

jest.mock('../../middleware/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('POSController.getShiftSummary authorization', () => {
  const chain = (db as unknown as jest.Mock)();

  beforeEach(() => {
    jest.clearAllMocks();
    chain.where.mockClear();
    chain.first.mockReset();
  });

  it('returns 403 when a cashier requests another employee shift', async () => {
    chain.first.mockResolvedValueOnce({ id: 1, employee_id: 999 });
    const req = { params: { id: '1' }, user: { id: 7, role: 'cashier' } } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;

    await posController.getShiftSummary(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(posRepository.getShiftSummary).not.toHaveBeenCalled();
  });

  it('returns the summary for the cashier own shift', async () => {
    chain.first.mockResolvedValueOnce({ id: 1, employee_id: 7 });
    (posRepository.getShiftSummary as jest.Mock).mockResolvedValueOnce({ id: 1 });
    const req = { params: { id: '1' }, user: { id: 7, role: 'cashier' } } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;

    await posController.getShiftSummary(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('allows a manager to view any shift', async () => {
    chain.first.mockResolvedValueOnce({ id: 1, employee_id: 999 });
    (posRepository.getShiftSummary as jest.Mock).mockResolvedValueOnce({ id: 1 });
    const req = { params: { id: '1' }, user: { id: 3, role: 'manager' } } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;

    await posController.getShiftSummary(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
