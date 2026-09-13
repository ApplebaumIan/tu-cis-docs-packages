const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  applyEntries,
  createState,
  findProjectRoot,
  hashFile,
  writeState,
} = require('../src/project');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'create-project-docs-test-'));
  const source = path.join(root, 'source.txt');
  const destination = path.join(root, 'project', 'managed.txt');
  fs.writeFileSync(source, 'version one\n');
  return {root, source, destination, projectRoot: path.join(root, 'project')};
}

test('copies and records a new managed file', () => {
  const value = fixture();
  const state = createState();
  const result = applyEntries({
    projectRoot: value.projectRoot,
    entries: [{source: value.source, destination: value.destination}],
    owner: 'section:requirements',
    version: '1.0.0',
    state,
  });

  assert.deepEqual(result.conflicts, []);
  assert.equal(fs.readFileSync(value.destination, 'utf8'), 'version one\n');
  assert.equal(state.files['managed.txt'].sourceHash, hashFile(value.source));
});

test('preserves a modified managed file and stages replacement', () => {
  const value = fixture();
  const state = createState();
  applyEntries({
    projectRoot: value.projectRoot,
    entries: [{source: value.source, destination: value.destination}],
    owner: 'section:requirements',
    version: '1.0.0',
    state,
  });
  fs.writeFileSync(value.destination, 'student edit\n');
  fs.writeFileSync(value.source, 'version two\n');

  const result = applyEntries({
    projectRoot: value.projectRoot,
    entries: [{source: value.source, destination: value.destination}],
    owner: 'section:requirements',
    version: '1.1.0',
    state,
  });

  assert.equal(result.conflicts.length, 1);
  assert.equal(fs.readFileSync(value.destination, 'utf8'), 'student edit\n');
  assert.equal(fs.readFileSync(path.join(value.projectRoot, result.conflicts[0].staged), 'utf8'), 'version two\n');
});

test('removes retired files only when unchanged', () => {
  const value = fixture();
  const state = createState();
  applyEntries({
    projectRoot: value.projectRoot,
    entries: [{source: value.source, destination: value.destination}],
    owner: 'template',
    version: '1.0.0',
    state,
  });

  const result = applyEntries({
    projectRoot: value.projectRoot,
    entries: [],
    owner: 'template',
    version: '1.1.0',
    state,
  });

  assert.deepEqual(result.conflicts, []);
  assert.equal(fs.existsSync(value.destination), false);
});

test('finds project root from documentation application', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'create-project-docs-root-test-'));
  const documentation = path.join(root, 'documentation');
  fs.mkdirSync(documentation);
  fs.writeFileSync(path.join(documentation, 'docusaurus.config.js'), 'module.exports = {};\n');
  assert.equal(findProjectRoot(documentation), root);
  const nested = path.join(documentation, 'docs', 'requirements');
  fs.mkdirSync(nested, {recursive: true});
  assert.equal(findProjectRoot(nested), root);
});

test('rejects managed paths outside the project', () => {
  const value = fixture();
  assert.throws(() => applyEntries({
    projectRoot: value.projectRoot,
    entries: [{source: value.source, destination: path.join(value.projectRoot, '..', 'escaped.txt')}],
    owner: 'template',
    version: '1.0.0',
    state: createState(),
  }), /Invalid managed path/);
});

test('rejects symbolic links in managed paths', () => {
  const value = fixture();
  fs.mkdirSync(value.projectRoot, {recursive: true});
  fs.symlinkSync(value.root, path.join(value.projectRoot, 'linked'));
  assert.throws(() => applyEntries({
    projectRoot: value.projectRoot,
    entries: [{source: value.source, destination: path.join(value.projectRoot, 'linked', 'escaped.txt')}],
    owner: 'template',
    version: '1.0.0',
    state: createState(),
  }), /symbolic link/);
});

test('rejects a symbolic link used as the state directory', () => {
  const value = fixture();
  fs.mkdirSync(value.projectRoot, {recursive: true});
  fs.symlinkSync(value.root, path.join(value.projectRoot, '.tu-cis-docs'));
  assert.throws(() => writeState(value.projectRoot, createState()), /symbolic link/);
});
