const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const packagesRoot = path.join(root, 'packages');
const requiredTemplateAssets = [
  {
    path: 'scaffold/documentation/static/img/docusaurus.png',
    signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    path: 'scaffold/documentation/static/img/favicon.ico',
    signature: Buffer.from([0x00, 0x00, 0x01, 0x00]),
  },
];
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
  if (manifest.name === '@tu-cis-courses/docusaurus-template') {
    for (const asset of requiredTemplateAssets) {
      if (!report.files.some((file) => file.path === asset.path)) {
        throw new Error(`${manifest.name} tarball omits ${asset.path}`);
      }
      const contents = fs.readFileSync(path.join(directory, asset.path));
      if (!contents.subarray(0, asset.signature.length).equals(asset.signature)) {
        throw new Error(`${asset.path} has an invalid binary signature`);
      }
    }
  }
  console.log(`${manifest.name} ${manifest.version}: ${report.entryCount} files, ${report.size} bytes`);
}
