const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tu-cis-docs-packed-'));
const yarn = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
const packages = {
  '@tu-cis-courses/create-project-docs': 'create-project-docs',
  '@tu-cis-courses/docs-content-template': 'docs-content-template',
  '@tu-cis-courses/docusaurus-components': 'docusaurus-components',
  '@tu-cis-courses/docusaurus-preset': 'docusaurus-preset',
  '@tu-cis-courses/docusaurus-template': 'docusaurus-template',
};

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {cwd, stdio: 'inherit', ...options});
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed.`);
  return result;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

try {
  const tarballs = {};
  for (const [name, directory] of Object.entries(packages)) {
    const result = run('npm', ['pack', '--json', '--pack-destination', temporaryRoot], path.join(root, 'packages', directory), {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const report = JSON.parse(result.stdout)[0];
    tarballs[name] = `file:${path.join(temporaryRoot, report.filename)}`;
  }

  const bootstrap = path.join(temporaryRoot, 'bootstrap');
  const bootstrapPackages = [
    '@tu-cis-courses/create-project-docs',
    '@tu-cis-courses/docs-content-template',
    '@tu-cis-courses/docusaurus-template',
  ];
  writeJson(path.join(bootstrap, 'package.json'), {
    private: true,
    dependencies: Object.fromEntries(bootstrapPackages.map((name) => [name, tarballs[name]])),
    resolutions: Object.fromEntries(bootstrapPackages.map((name) => [name, tarballs[name]])),
  });
  run(yarn, ['install'], bootstrap);
  run(path.join(bootstrap, 'node_modules', '.bin', 'create-project-docs'), [
    'new',
    path.join(bootstrap, 'generated'),
    '--skip-install',
  ], bootstrap);

  const documentation = path.join(bootstrap, 'generated', 'documentation');
  const generatedAssets = [
    ['docusaurus.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['favicon.ico', Buffer.from([0x00, 0x00, 0x01, 0x00])],
  ];
  for (const [filename, signature] of generatedAssets) {
    const contents = fs.readFileSync(path.join(documentation, 'static', 'img', filename));
    if (!contents.subarray(0, signature.length).equals(signature)) {
      throw new Error(`Generated ${filename} has an invalid binary signature.`);
    }
  }
  const packageJsonPath = path.join(documentation, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  for (const [name, tarball] of Object.entries(tarballs)) {
    const collection = packageJson.dependencies[name] ? packageJson.dependencies : packageJson.devDependencies;
    collection[name] = tarball;
    packageJson.resolutions[name] = tarball;
  }
  writeJson(packageJsonPath, packageJson);

  const smokeDocument = `---\ntitle: Package smoke test\n---\n\nimport {Contributors, Figure, InlineDocs} from '@tu-cis-courses/docusaurus-components';\n\n<Figure src="/img/docusaurus.png" alt="Docusaurus logo" caption="Figure package smoke test" />\n\n<Contributors orgName="facebook" projectName="docusaurus" />\n\n<InlineDocs docFolder="generated" title="Generated documentation" />\n`;
  fs.writeFileSync(path.join(documentation, 'docs', 'package-smoke.mdx'), smokeDocument);
  const generatedStatic = path.join(documentation, 'static', 'generated');
  fs.mkdirSync(generatedStatic, {recursive: true});
  fs.writeFileSync(path.join(generatedStatic, 'index.html'), '<!doctype html><title>Generated documentation</title>\n');

  run(yarn, ['install'], documentation);
  run('npm', ['run', 'docs:add', 'requirements'], documentation);
  run(yarn, ['build'], documentation, {
    env: {
      ...process.env,
      ORG_NAME: 'test-organization',
      PROJECT_NAME: 'test-project',
      DISABLE_REVISION_HISTORY: '1',
    },
  });
} finally {
  fs.rmSync(temporaryRoot, {recursive: true, force: true});
}
