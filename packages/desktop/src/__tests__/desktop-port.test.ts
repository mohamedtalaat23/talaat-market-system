import net from 'net';
import { ensureDesktopPortAvailable } from '../desktop-port';
it('refuses an occupied origin rather than hiding persisted storage behind a new port', async () => {
  const occupied = net.createServer();
  await new Promise<void>((resolve) => occupied.listen(0, 'localhost', resolve));
  const port = (occupied.address() as net.AddressInfo).port;
  try {
    await expect(ensureDesktopPortAvailable(port)).rejects.toThrow(
      'saved carts and offline records',
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      occupied.close((error) => (error ? reject(error) : resolve())),
    );
  }
  await expect(ensureDesktopPortAvailable(port)).resolves.toBe(port);
});
