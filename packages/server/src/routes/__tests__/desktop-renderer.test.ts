import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { desktopRenderer } from '../../desktop-renderer';

it('serves packaged assets to loopback without capturing API routes or private files', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'talaat-ui-'));
  try {
    fs.writeFileSync(path.join(dir, 'index.html'), 'synthetic renderer');
    fs.writeFileSync(path.join(dir, '.env'), 'must not serve');
    const app = express();
    app.use(desktopRenderer(dir));
    expect((await request(app).get('/')).text).toBe('synthetic renderer');
    expect((await request(app).get('/api/missing')).status).toBe(404);
    expect((await request(app).get('/.env')).status).toBe(404);
    const next = jest.fn();
    desktopRenderer(dir)({ socket: { remoteAddress: '192.168.1.5' } } as any, {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
