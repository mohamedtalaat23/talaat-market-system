import express from 'express';
import request from 'supertest';
import { authRateLimiter } from '../rateLimit';
it('allows a trading-day sequence of valid approvals while limiting failed authentication', async () => {
  const app = express();
  app.post('/login', authRateLimiter, (req, res) =>
    res.sendStatus(req.query['valid'] === '1' ? 200 : 401),
  );
  for (let i = 0; i < 40; i++) expect((await request(app).post('/login?valid=1')).status).toBe(200);
  for (let i = 0; i < 30; i++) expect((await request(app).post('/login')).status).toBe(401);
  expect((await request(app).post('/login')).status).toBe(429);
});
