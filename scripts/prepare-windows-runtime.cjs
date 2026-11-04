const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const { execFileSync } = require('node:child_process');
const { manifest, directory, verifyArchive, validateRuntime } = require('./windows-runtime.cjs');
async function prepare() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'talaat-pg-acquire-'));
  try {
    const cache = process.env.TALAAT_PG_CACHE_DIR || path.join(os.tmpdir(), 'talaat-pg-cache');
    fs.mkdirSync(cache, { recursive: true });
    const archive = path.join(cache, manifest.archive);
    if (!fs.existsSync(archive)) {
      console.log(`Downloading pinned PostgreSQL ${manifest.version}-${manifest.revision}...`);
      const response = await fetch(manifest.url, { signal: AbortSignal.timeout(300000) });
      if (!response.ok || !response.body)
        throw new Error(`Runtime download failed (${response.status}).`);
      const partial = path.join(temp, manifest.archive);
      await pipeline(
        Readable.fromWeb(response.body),
        fs.createWriteStream(partial, { flags: 'wx' }),
      );
      verifyArchive(partial);
      fs.copyFileSync(partial, archive);
    }
    verifyArchive(archive);
    const extraction = path.join(temp, 'extracted');
    fs.mkdirSync(extraction);
    if (process.platform === 'win32')
      execFileSync('tar.exe', ['-xf', archive, '-C', extraction], {
        stdio: 'inherit',
        windowsHide: true,
      });
    else execFileSync('unzip', ['-q', archive, '-d', extraction], { stdio: 'inherit' });
    const source = path.join(extraction, manifest.archiveRoot);
    fs.writeFileSync(
      path.join(source, 'runtime-provenance.json'),
      JSON.stringify(manifest, null, 2),
    );
    console.log('Distribution directories: ' + fs.readdirSync(source).join(', '));
    // Validate the new extraction before replacing previous build output.
    validateRuntime(source);
    fs.mkdirSync(directory, { recursive: true });
    for (const name of fs.readdirSync(directory))
      if (!['README.md', '.gitignore'].includes(name))
        fs.rmSync(path.join(directory, name), { recursive: true, force: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      // Optional GUI/admin installers, headers and symbols are not server dependencies.
      if (entry.isDirectory() && !['bin', 'lib', 'share', 'doc'].includes(entry.name)) continue;
      fs.cpSync(path.join(source, entry.name), path.join(directory, entry.name), {
        recursive: true,
      });
    }
    validateRuntime(directory);
    console.log(`Verified PostgreSQL ${manifest.version}; SHA-256 ${manifest.sha256}`);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
if (require.main === module)
  prepare().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { prepare };
