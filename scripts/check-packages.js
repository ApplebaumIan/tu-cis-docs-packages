const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const packagesRoot = path.join(root, 'packages');
const packages = fs.readdirSync(packagesRoot, {withFileTypes: true})
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(packagesRoot, entry.name))
  .filter((directory) => fs.existsSync(path.join(directory, 'package.json')));

for (const directory of packages) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: directory,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  const report = JSON.parse(result.stdout)[0];
  if (!report.files.some((file) => file.path === 'package.json')) {
    throw new Error(`${manifest.name} tarball omits package.json`);
  }
  if (!report.files.some((file) => file.path === 'LICENSE')) {
    throw new Error(`${manifest.name} tarball omits LICENSE`);
  }
  console.log(`${manifest.name} ${manifest.version}: ${report.entryCount} files, ${report.size} bytes`);
}
