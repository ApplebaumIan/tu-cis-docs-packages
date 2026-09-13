const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {version: cliVersion} = require('../package.json');

const STATE_SCHEMA_VERSION = 1;
const STATE_DIRECTORY = '.tu-cis-docs';
const STATE_FILE = 'manifest.json';

function hashBuffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashFile(filePath) {
  return hashBuffer(fs.readFileSync(filePath));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  const temporaryPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {flag: 'wx'});
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath);
  }
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function findProjectRoot(startDirectory) {
  const start = path.resolve(startDirectory);
  let current = start;
  while (true) {
    if (fs.existsSync(path.join(current, 'documentation', 'package.json'))) return current;
    if (fs.existsSync(path.join(current, 'docusaurus.config.js'))) return path.dirname(current);
    const parent = path.dirname(current);
    if (parent === current) return start;
    current = parent;
  }
}

function statePath(projectRoot) {
  return managedPath(projectRoot, path.join(STATE_DIRECTORY, STATE_FILE));
}

function createState() {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    channel: cliVersion.includes('-') ? 'next' : 'latest',
    packages: {},
    packageTargets: {},
    sections: {},
    files: {},
    conflicts: {},
  };
}

function readState(projectRoot, required = true) {
  const filePath = statePath(projectRoot);
  if (!fs.existsSync(filePath)) {
    if (required) throw new Error('Project is not managed. Run create-project-docs migrate first.');
    return createState();
  }

  const state = readJson(filePath);
  if (state.schemaVersion !== STATE_SCHEMA_VERSION) {
    throw new Error(`Unsupported state schema ${state.schemaVersion}. Update create-project-docs.`);
  }
  return state;
}

function writeState(projectRoot, state) {
  writeJsonAtomic(statePath(projectRoot), state);
}

function relativePath(projectRoot, filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

function managedPath(projectRoot, relative) {
  if (!relative || path.isAbsolute(relative)) throw new Error(`Invalid managed path: ${relative}`);
  const root = path.resolve(projectRoot);
  const destination = path.resolve(root, relative);
  if (!destination.startsWith(`${root}${path.sep}`)) throw new Error(`Invalid managed path: ${relative}`);

  let current = root;
  for (const segment of path.relative(root, destination).split(path.sep)) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`Managed path cannot contain a symbolic link: ${relative}`);
    }
  }
  return destination;
}

function payloadEntries(sourceRoot, destinationRoot) {
  return walkFiles(sourceRoot).map((source) => ({
    source,
    destination: path.join(destinationRoot, path.relative(sourceRoot, source)),
  }));
}

function stageConflict(projectRoot, owner, version, entry) {
  const relative = relativePath(projectRoot, entry.destination);
  const stagedPath = managedPath(
    projectRoot,
    path.join(
    STATE_DIRECTORY,
    'updates',
    `${owner.replace(/[^a-z0-9-]/gi, '-')}-${String(version).replace(/[^a-z0-9-]/gi, '-')}`,
    relative,
    ),
  );
  fs.mkdirSync(path.dirname(stagedPath), {recursive: true});
  fs.copyFileSync(entry.source, stagedPath);
  return relativePath(projectRoot, stagedPath);
}

function applyEntries({projectRoot, entries, owner, version, state}) {
  const targetPaths = new Set(entries.map((entry) => relativePath(projectRoot, entry.destination)));
  const conflicts = [];
  const changed = [];

  for (const entry of entries) {
    const relative = relativePath(projectRoot, entry.destination);
    const destination = managedPath(projectRoot, relative);
    const previous = state.files[relative];
    const sourceHash = hashFile(entry.source);
    const destinationExists = fs.existsSync(destination);
    const destinationHash = destinationExists ? hashFile(destination) : null;
    const canWrite = !destinationExists
      ? !previous
      : destinationHash === sourceHash
        || (previous && destinationHash === previous.sourceHash);

    if (!canWrite) {
      const staged = stageConflict(projectRoot, owner, version, entry);
      conflicts.push({path: relative, staged});
      state.conflicts[relative] = {owner, targetVersion: version, staged};
      continue;
    }

    if (destinationHash !== sourceHash) {
      fs.mkdirSync(path.dirname(destination), {recursive: true});
      fs.copyFileSync(entry.source, destination);
      changed.push(relative);
    }
    state.files[relative] = {owner, sourceVersion: version, sourceHash};
    delete state.conflicts[relative];
  }

  for (const [relative, previous] of Object.entries(state.files)) {
    if (previous.owner !== owner || targetPaths.has(relative)) continue;
    const destination = managedPath(projectRoot, relative);
    if (!fs.existsSync(destination)) {
      delete state.files[relative];
      continue;
    }
    if (hashFile(destination) === previous.sourceHash) {
      fs.rmSync(destination);
      delete state.files[relative];
      changed.push(relative);
    } else {
      conflicts.push({path: relative, staged: null});
      state.conflicts[relative] = {owner, targetVersion: version, staged: null, removal: true};
    }
  }

  return {changed, conflicts};
}

function resolvePackageRoot(packageName, searchPaths = []) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`, {
    paths: [...searchPaths, __dirname],
  });
  return path.dirname(packageJsonPath);
}

function packageInfo(packageName, searchPaths = []) {
  const root = resolvePackageRoot(packageName, searchPaths);
  return {root, packageJson: readJson(path.join(root, 'package.json'))};
}

module.exports = {
  applyEntries,
  createState,
  findProjectRoot,
  hashFile,
  managedPath,
  packageInfo,
  payloadEntries,
  readJson,
  readState,
  statePath,
  walkFiles,
  writeJsonAtomic,
  writeState,
};
