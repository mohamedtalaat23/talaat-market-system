import express from 'express';
/** Only the desktop child enables this route. LAN API callers cannot fetch UI assets. */
export function desktopRenderer(directory: string): express.RequestHandler {
  const assets = express.static(directory, { dotfiles: 'deny', fallthrough: true });
  return (req, res, next) => {
    const remote = req.socket.remoteAddress;
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote ?? '')) return next();
    // Keep every API route (including unknown ones) outside static asset handling.
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    return assets(req, res, next);
  };
}
