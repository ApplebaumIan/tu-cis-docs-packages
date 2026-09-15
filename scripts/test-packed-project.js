const assert = require('node:assert/strict');
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
  const cli = path.join(bootstrap, 'node_modules', '.bin', 'create-project-docs');
  run(cli, [
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

  run(cli, ['customize', 'all'], documentation);
  const customizationPath = path.join(documentation, 'project-docs.json');
  const customization = JSON.parse(fs.readFileSync(customizationPath, 'utf8'));
  assert.equal(customization.showTemplateHelp, false);
  customization.navbarItems.push({href: 'https://example.com/status', label: 'Project Status', position: 'left'});
  customization.footerColumns.push({
    title: 'Project',
    items: [{label: 'Status', href: 'https://example.com/status'}],
  });
  writeJson(customizationPath, customization);
  const customCssPath = path.join(documentation, 'src', 'css', 'custom.css');
  fs.writeFileSync(customCssPath, ':root { --student-customization-test: 1; }\n');
  const statePath = path.join(bootstrap, 'generated', '.tu-cis-docs', 'manifest.json');
  const managedState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  managedState.files['documentation/src/css/custom.css'] = {
    owner: 'template',
    sourceVersion: '1.0.0',
    sourceHash: 'legacy-placeholder',
  };
  managedState.conflicts['documentation/src/css/custom.css'] = {
    owner: 'template',
    targetVersion: '1.1.0',
  };
  writeJson(statePath, managedState);
  run(cli, ['customize', 'all'], documentation);
  assert.equal(fs.readFileSync(customCssPath, 'utf8'), ':root { --student-customization-test: 1; }\n');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  assert.equal(state.files['documentation/project-docs.json'], undefined);
  assert.equal(state.files['documentation/src/css/custom.css'], undefined);
  assert.equal(state.conflicts['documentation/src/css/custom.css'], undefined);
  run(cli, ['update', 'template'], documentation);
  assert.equal(fs.readFileSync(customCssPath, 'utf8'), ':root { --student-customization-test: 1; }\n');
  assert.deepEqual(JSON.parse(fs.readFileSync(customizationPath, 'utf8')), customization);

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
  const docusaurusConfig = require(path.join(documentation, 'docusaurus.config.js'));
  assert.equal(docusaurusConfig.themeConfig.navbar.items.some((item) => item.label === 'Template Help'), false);
  assert.equal(docusaurusConfig.themeConfig.navbar.items.some((item) => item.label === 'Project Status'), true);
  assert.equal(docusaurusConfig.themeConfig.footer.links.some((column) => (
    column.items.some((item) => item.label === 'Template Contributors')
  )), false);
  assert.equal(docusaurusConfig.themeConfig.footer.links.some((column) => column.title === 'Project'), true);
  assert.equal(
    fs.realpathSync(docusaurusConfig.presets[1][1].theme.customCss),
    fs.realpathSync(customCssPath),
  );
  const themeFactory = require(require.resolve('@tu-cis-courses/docusaurus-preset/theme', {
    paths: [documentation],
  }));
  const clientModules = themeFactory(
    {siteDir: documentation},
    docusaurusConfig.presets[1][1].theme,
  ).getClientModules();
  assert.equal(fs.realpathSync(clientModules.at(-1)), fs.realpathSync(customCssPath));
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
