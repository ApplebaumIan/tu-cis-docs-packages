const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const test = require('node:test');

const cli = path.resolve(__dirname, '..', 'bin.js');
const templateManifest = require('../../docusaurus-template/manifest.json');
const contentPackage = require('../../docs-content-template/package.json');

function run(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], {cwd, encoding: 'utf8'});
}

test('creates core content and adds sections on demand', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'create-project-docs-cli-test-'));
  const target = path.join(parent, 'project');
  const created = run(['new', target, '--skip-install'], parent);

  assert.equal(created.status, 0, created.stderr);
  assert.equal(fs.existsSync(path.join(target, 'README.md')), true);
  assert.equal(fs.existsSync(path.join(target, 'documentation', 'docs', 'intro.mdx')), true);
  assert.equal(fs.existsSync(path.join(target, 'documentation', 'docs', 'requirements')), false);

  const added = run(['section', 'add', 'requirements'], path.join(target, 'documentation'));
  assert.equal(added.status, 0, added.stderr);
  assert.equal(fs.existsSync(path.join(target, 'documentation', 'docs', 'requirements')), true);
});

test('migrates legacy documentation without replacing student content', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'create-project-docs-migrate-test-'));
  const documentation = path.join(target, 'documentation');
  const nested = path.join(documentation, 'docs', 'requirements');
  fs.mkdirSync(nested, {recursive: true});
  fs.writeFileSync(path.join(documentation, 'package.json'), JSON.stringify({
    name: 'legacy-docs',
    private: true,
    scripts: {start: 'docusaurus start'},
    dependencies: {'@docusaurus/core': '3.8.1'},
  }));
  const studentFile = path.join(nested, 'system-overview.md');
  fs.writeFileSync(studentFile, '# Student architecture\n');

  const migrated = run(['migrate', '--skip-install'], nested);
  assert.equal(migrated.status, 0, migrated.stderr);
  assert.equal(fs.readFileSync(studentFile, 'utf8'), '# Student architecture\n');

  const packageJson = JSON.parse(fs.readFileSync(path.join(documentation, 'package.json')));
  assert.equal(packageJson.dependencies['@docusaurus/core'], templateManifest.recommended.docusaurus);
  assert.equal(packageJson.scripts['docs:add'], 'create-project-docs section add');
  const state = JSON.parse(fs.readFileSync(path.join(target, '.tu-cis-docs', 'manifest.json')));
  assert.equal(state.sections.requirements.sourceVersion, contentPackage.version);
});
