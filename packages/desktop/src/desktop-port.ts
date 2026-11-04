import net from 'net';
/** Renderer storage is scoped to this origin: never silently change its port. */
export const DESKTOP_SERVICE_PORT = 3001;
export function ensureDesktopPortAvailable(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () =>
      reject(
        new Error(
          `Desktop service port ${port} is unavailable. Close the conflicting application and retry. The address cannot change because saved carts and offline records belong to this origin.`,
        ),
      ),
    );
    probe.listen(port, 'localhost', () => probe.close(() => resolve(port)));
  });
}
