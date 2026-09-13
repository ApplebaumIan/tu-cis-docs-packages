#!/usr/bin/env node

const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const semver = require('semver');
const {
  applyEntries,
  createState,
  findProjectRoot,
  hashFile,
  managedPath,
  packageInfo,
  payloadEntries,
  readJson,
  readState,
  writeJsonAtomic,
  writeState,
} = require('./src/project');

const TEMPLATE_PACKAGE = '@tu-cis-courses/docusaurus-template';
const CONTENT_PACKAGE = '@tu-cis-courses/docs-content-template';
const COMPONENTS_PACKAGE = '@tu-cis-courses/docusaurus-components';
const PRESET_PACKAGE = '@tu-cis-courses/docusaurus-preset';
const CLI_PACKAGE = '@tu-cis-courses/create-project-docs';
const args = process.argv.slice(2);

function usage() {
  console.log(`Usage:
  create-project-docs new <project-name> [--skip-install]
  create-project-docs add [--path <directory>] [--skip-install]
  create-project-docs section list
  create-project-docs section add <requirements|architecture|testing|api>
  create-project-docs section update [section]
  create-project-docs update <runtime|template|content|all>
  create-project-docs check [--startup]
  create-project-docs migrate
  create-project-docs doctor`);
}

function argumentValue(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1] ?? null;
}

function packageManagerInstall(documentationDir) {
  if (args.includes('--skip-install')) return;
  const command = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
  const result = spawnSync(command, ['install'], {cwd: documentationDir, stdio: 'inherit'});
  if (result.status !== 0) throw new Error('yarn install failed.');
}

function installTemplateRelease(documentationDir, channel) {
  const command = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
  const result = spawnSync(command, ['add', '--dev', '--exact', `${TEMPLATE_PACKAGE}@${channel}`], {
    cwd: documentationDir,
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`Unable to install the ${channel} documentation template.`);
}

function applyRecommendedVersions(packageJson, template) {
  const recommended = template.manifest.recommended;
  const scaffoldPackage = readJson(path.join(template.root, template.manifest.scaffold, 'documentation', 'package.json'));
  packageJson.dependencies ??= {};
  packageJson.devDependencies ??= {};
  packageJson.scripts ??= {};
  for (const [name, version] of Object.entries(scaffoldPackage.dependencies)) {
    if (name.startsWith('@docusaurus/')) packageJson.dependencies[name] = recommended.docusaurus;
    else packageJson.dependencies[name] ??= version;
  }
  for (const [name, version] of Object.entries(scaffoldPackage.devDependencies)) {
    packageJson.devDependencies[name] ??= version;
  }
  packageJson.dependencies[COMPONENTS_PACKAGE] = recommended.docusaurusComponents;
  packageJson.dependencies[PRESET_PACKAGE] = recommended.docusaurusPreset;
  packageJson.devDependencies[CLI_PACKAGE] = recommended.createProjectDocs;
  packageJson.devDependencies[CONTENT_PACKAGE] = recommended.docsContentTemplate;
  packageJson.devDependencies[TEMPLATE_PACKAGE] = template.packageJson.version;
  for (const name of Object.keys(packageJson.dependencies)) {
    if (name.startsWith('@docusaurus/')) packageJson.dependencies[name] = recommended.docusaurus;
  }
  packageJson.resolutions = {...packageJson.resolutions, ...scaffoldPackage.resolutions};
  packageJson.scripts.prestart ??= 'create-project-docs check --startup';
  packageJson.scripts['docs:list'] = 'create-project-docs section list';
  packageJson.scripts['docs:add'] = 'create-project-docs section add';
  packageJson.scripts['docs:update'] = 'create-project-docs section update';
  packageJson.scripts['docs:check'] = 'create-project-docs check';
  packageJson.scripts['docs:upgrade'] = 'create-project-docs update all';
  return recommended;
}

function resolveContent(projectRoot) {
  const documentationDir = path.join(projectRoot, 'documentation');
  const info = packageInfo(CONTENT_PACKAGE, [documentationDir, projectRoot]);
  return {...info, manifest: readJson(path.join(info.root, 'manifest.json'))};
}

function resolveTemplate(projectRoot) {
  const documentationDir = path.join(projectRoot, 'documentation');
  const info = packageInfo(TEMPLATE_PACKAGE, [documentationDir, projectRoot]);
  return {...info, manifest: readJson(path.join(info.root, 'manifest.json'))};
}

function templateEntries(template, projectRoot) {
  const sourceRoot = path.join(template.root, template.manifest.scaffold);
  return payloadEntries(sourceRoot, projectRoot).map((entry) => {
    const relative = path.relative(sourceRoot, entry.source).split(path.sep).join('/');
    const renamed = template.manifest.renames?.[relative];
    return renamed ? {...entry, destination: path.join(projectRoot, renamed)} : entry;
  });
}

function copyCore(projectRoot, state, content) {
  const entries = content.manifest.core.map(({source, destination}) => ({
    source: path.join(content.root, source),
    destination: path.join(projectRoot, destination),
  }));
  return applyEntries({
    projectRoot,
    entries,
    owner: 'content-core',
    version: content.packageJson.version,
    state,
  });
}

function scaffoldProject(projectRoot, allowProjectFiles = false, announce = true) {
  const template = resolveTemplate(projectRoot);
  const content = resolveContent(projectRoot);
  const state = createState();
  const scaffoldResult = applyEntries({
    projectRoot,
    entries: templateEntries(template, projectRoot),
    owner: 'template',
    version: template.packageJson.version,
    state,
  });
  if (scaffoldResult.conflicts.length && !allowProjectFiles) {
    throw new Error('Target contains files managed by template.');
  }
  const coreResult = copyCore(projectRoot, state, content);
  if (coreResult.conflicts.length && !allowProjectFiles) {
    throw new Error('Target contains files managed by content template.');
  }

  state.packages = {
    template: template.packageJson.version,
    content: content.packageJson.version,
    components: template.manifest.recommended.docusaurusComponents,
    preset: template.manifest.recommended.docusaurusPreset,
    cli: template.manifest.recommended.createProjectDocs,
  };
  writeState(projectRoot, state);
  packageManagerInstall(path.join(projectRoot, 'documentation'));
  if (announce) {
    console.log(`Created documentation project at ${projectRoot}`);
    if (scaffoldResult.conflicts.length + coreResult.conflicts.length > 0) {
      console.log('Existing project files were preserved. Review .tu-cis-docs/updates.');
    }
    console.log('Run: cd documentation && npm start');
  }
}

function sectionDefinition(manifest, requested) {
  return Object.entries(manifest.sections).find(([id, section]) => (
    id === requested || section.aliases?.includes(requested)
  ));
}

function assertContentCompatibility(projectRoot, content) {
  const documentationDir = path.join(projectRoot, 'documentation');
  const requirements = [
    [PRESET_PACKAGE, content.manifest.compatibility?.docusaurusPreset],
    [COMPONENTS_PACKAGE, content.manifest.compatibility?.docusaurusComponents],
  ];
  for (const [packageName, range] of requirements) {
    if (!range) continue;
    const installed = packageInfo(packageName, [documentationDir, projectRoot]).packageJson.version;
    if (!semver.satisfies(installed, range, {includePrerelease: true})) {
      throw new Error(`${CONTENT_PACKAGE} requires ${packageName} ${range}; found ${installed}.`);
    }
  }
}

function listSections(projectRoot) {
  const state = readState(projectRoot, false);
  const content = resolveContent(projectRoot);
  for (const [id, section] of Object.entries(content.manifest.sections)) {
    const status = state.sections[id] ? `installed ${state.sections[id].sourceVersion}` : 'available';
    console.log(`${id.padEnd(14)} ${status.padEnd(24)} ${section.title}`);
  }
}

function addSection(projectRoot, requested) {
  if (!requested) throw new Error('Missing section. Run npm run docs:list.');
  const state = readState(projectRoot);
  const content = resolveContent(projectRoot);
  assertContentCompatibility(projectRoot, content);
  const match = sectionDefinition(content.manifest, requested);
  if (!match) throw new Error(`Unknown section: ${requested}`);
  const [id, section] = match;
  if (state.sections[id]) throw new Error(`${section.title} is already installed.`);
  const destinationRoot = path.join(projectRoot, section.destination);
  if (fs.existsSync(destinationRoot)) {
    throw new Error(`${section.destination} already exists. Existing files were not changed.`);
  }
  const result = applyEntries({
    projectRoot,
    entries: payloadEntries(path.join(content.root, section.source), destinationRoot),
    owner: `section:${id}`,
    version: content.packageJson.version,
    state,
  });
  if (result.conflicts.length) throw new Error('Section contains conflicts. Existing files were not changed.');
  state.sections[id] = {sourceVersion: content.packageJson.version};
  state.packages.content = content.packageJson.version;
  writeState(projectRoot, state);
  console.log(`Added ${section.title}.`);
}

function updateSections(projectRoot, requested) {
  const state = readState(projectRoot);
  const content = resolveContent(projectRoot);
  assertContentCompatibility(projectRoot, content);
  const previousAppliedVersion = state.packages.content;
  const ids = requested
    ? [sectionDefinition(content.manifest, requested)?.[0]].filter(Boolean)
    : Object.keys(state.sections);
  if (requested && ids.length === 0) throw new Error(`Unknown section: ${requested}`);
  if (ids.length === 0) {
    console.log('No sections installed.');
    return {changed: 0, conflicts: 0};
  }
  let changed = 0;
  let conflicts = 0;
  for (const id of ids) {
    if (!state.sections[id]) throw new Error(`${id} is not installed.`);
    const section = content.manifest.sections[id];
    const result = applyEntries({
      projectRoot,
      entries: payloadEntries(
        path.join(content.root, section.source),
        path.join(projectRoot, section.destination),
      ),
      owner: `section:${id}`,
      version: content.packageJson.version,
      state,
    });
    changed += result.changed.length;
    conflicts += result.conflicts.length;
    if (result.conflicts.length === 0) {
      state.sections[id] = {sourceVersion: content.packageJson.version};
    } else {
      state.sections[id].targetVersion = content.packageJson.version;
    }
  }
  state.packageTargets ??= {};
  if (conflicts === 0) {
    state.packages.content = content.packageJson.version;
    delete state.packageTargets.content;
  } else {
    state.packages.content = previousAppliedVersion;
    state.packageTargets.content = content.packageJson.version;
  }
  writeState(projectRoot, state);
  console.log(`Updated ${changed} files. ${conflicts} conflicts preserved.`);
  if (conflicts) console.log('Review .tu-cis-docs/updates.');
  return {changed, conflicts};
}

function updateTemplate(projectRoot) {
  const state = readState(projectRoot);
  const template = resolveTemplate(projectRoot);
  const result = applyEntries({
    projectRoot,
    entries: templateEntries(template, projectRoot),
    owner: 'template',
    version: template.packageJson.version,
    state,
  });
  state.packageTargets ??= {};
  if (result.conflicts.length === 0) {
    state.packages.template = template.packageJson.version;
    delete state.packageTargets.template;
  } else {
    state.packageTargets.template = template.packageJson.version;
  }
  writeState(projectRoot, state);
  console.log(`Updated ${result.changed.length} template files. ${result.conflicts.length} conflicts preserved.`);
}

function updateRuntime(projectRoot) {
  const documentationDir = path.join(projectRoot, 'documentation');
  const packageJsonPath = managedPath(projectRoot, 'documentation/package.json');
  const state = readState(projectRoot);
  installTemplateRelease(documentationDir, state.channel ?? 'latest');
  const packageJson = readJson(packageJsonPath);
  const template = resolveTemplate(projectRoot);
  const recommended = applyRecommendedVersions(packageJson, template);
  writeJsonAtomic(packageJsonPath, packageJson);
  packageManagerInstall(documentationDir);
  state.packages = {
    ...state.packages,
    components: recommended.docusaurusComponents,
    preset: recommended.docusaurusPreset,
    cli: recommended.createProjectDocs,
  };
  writeState(projectRoot, state);
  console.log('Updated runtime package versions.');
}

function updateContent(projectRoot) {
  const state = readState(projectRoot);
  const content = resolveContent(projectRoot);
  assertContentCompatibility(projectRoot, content);
  const previousAppliedVersion = state.packages.content;
  const core = copyCore(projectRoot, state, content);
  writeState(projectRoot, state);
  const sections = updateSections(projectRoot);
  const finalState = readState(projectRoot);
  finalState.packageTargets ??= {};
  if (core.conflicts.length + sections.conflicts > 0) {
    finalState.packages.content = previousAppliedVersion;
    finalState.packageTargets.content = content.packageJson.version;
  } else {
    finalState.packages.content = content.packageJson.version;
    delete finalState.packageTargets.content;
  }
  writeState(projectRoot, finalState);
  console.log(`Updated ${core.changed.length} core files. ${core.conflicts.length} conflicts preserved.`);
  return {core, sections};
}

function doctor(projectRoot) {
  const documentationDir = path.join(projectRoot, 'documentation');
  const packageJsonPath = managedPath(projectRoot, 'documentation/package.json');
  const checks = [
    ['documentation application', fs.existsSync(packageJsonPath)],
    ['managed state', fs.existsSync(path.join(projectRoot, '.tu-cis-docs', 'manifest.json'))],
  ];
  const packageJson = fs.existsSync(packageJsonPath) ? readJson(packageJsonPath) : {};
  checks.push(['components package', Boolean(packageJson.dependencies?.[COMPONENTS_PACKAGE])]);
  checks.push(['preset package', Boolean(packageJson.dependencies?.[PRESET_PACKAGE])]);
  checks.push(['content template package', Boolean(packageJson.devDependencies?.[CONTENT_PACKAGE])]);
  let failed = false;
  for (const [label, passed] of checks) {
    console.log(`${passed ? 'ok' : 'missing'}\t${label}`);
    failed ||= !passed;
  }
  if (failed) process.exitCode = 1;
}

async function checkUpdates(projectRoot, startup) {
  const state = readState(projectRoot, false);
  const documentationDir = path.join(projectRoot, 'documentation');
  const packageJsonPath = path.join(documentationDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    if (!startup) console.log('No documentation application found.');
    return;
  }
  const packageJson = readJson(packageJsonPath);
  const installed = {
    template: packageJson.devDependencies?.[TEMPLATE_PACKAGE],
    content: packageJson.devDependencies?.[CONTENT_PACKAGE],
    components: packageJson.dependencies?.[COMPONENTS_PACKAGE],
    preset: packageJson.dependencies?.[PRESET_PACKAGE],
    cli: packageJson.devDependencies?.[CLI_PACKAGE],
  };
  if (!startup) {
    for (const [name, version] of Object.entries(installed)) {
      console.log(`${name.padEnd(12)} ${version ?? 'not installed'}${state.packages[name] ? ` (applied ${state.packages[name]})` : ''}`);
    }
  }
  if (process.env.CI || process.env.NO_UPDATE_NOTIFIER === '1') return;

  const cachePath = managedPath(projectRoot, 'documentation/.cache/tu-cis-docs-update.json');
  const maxAge = 24 * 60 * 60 * 1000;
  let cached = null;
  if (fs.existsSync(cachePath)) {
    try { cached = readJson(cachePath); } catch {}
  }
  if (cached && Date.now() - cached.checkedAt < maxAge) {
    if (cached.message) console.log(cached.message);
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const registryName = encodeURIComponent(TEMPLATE_PACKAGE).replace('%2F', '%2f');
    const tag = state.channel ?? 'latest';
    const response = await fetch(`https://registry.npmjs.org/${registryName}/${tag}`, {signal: controller.signal});
    clearTimeout(timeout);
    if (!response.ok) return;
    const latest = await response.json();
    const current = installed.template;
    const message = current && current !== latest.version
      ? `[tu-cis-docs] Template update available: ${current} -> ${latest.version}. Run npm run docs:upgrade.`
      : '';
    writeJsonAtomic(cachePath, {checkedAt: Date.now(), message});
    if (message) console.log(message);
  } catch {
    // Startup remains available offline.
  }
}

function migrate(projectRoot) {
  if (!fs.existsSync(path.join(projectRoot, 'documentation', 'package.json'))) {
    throw new Error('No legacy documentation application found.');
  }
  if (fs.existsSync(path.join(projectRoot, '.tu-cis-docs', 'manifest.json'))) {
    throw new Error('Project is already managed.');
  }
  const state = createState();
  const content = resolveContent(projectRoot);
  const template = resolveTemplate(projectRoot);
  for (const {source, destination} of content.manifest.core) {
    const sourcePath = path.join(content.root, source);
    const destinationPath = path.join(projectRoot, destination);
    if (!fs.existsSync(destinationPath)) continue;
    const relative = path.relative(projectRoot, destinationPath).split(path.sep).join('/');
    state.files[relative] = {
      owner: 'content-core',
      sourceVersion: content.packageJson.version,
      sourceHash: hashFile(sourcePath),
    };
  }
  for (const [id, section] of Object.entries(content.manifest.sections)) {
    const destinationRoot = path.join(projectRoot, section.destination);
    if (!fs.existsSync(destinationRoot)) continue;
    let recognized = false;
    for (const entry of payloadEntries(path.join(content.root, section.source), destinationRoot)) {
      const relative = path.relative(projectRoot, entry.destination).split(path.sep).join('/');
      if (fs.existsSync(entry.destination)) {
        recognized = true;
        state.files[relative] = {
          owner: `section:${id}`,
          sourceVersion: content.packageJson.version,
          sourceHash: hashFile(entry.source),
        };
      }
    }
    if (!recognized) continue;
    state.sections[id] = {sourceVersion: content.packageJson.version};
  }
  const documentationDir = path.join(projectRoot, 'documentation');
  const packageJsonPath = managedPath(projectRoot, 'documentation/package.json');
  const packageJson = readJson(packageJsonPath);
  const recommended = applyRecommendedVersions(packageJson, template);
  writeJsonAtomic(packageJsonPath, packageJson);
  packageManagerInstall(documentationDir);
  state.packages.components = recommended.docusaurusComponents;
  state.packages.preset = recommended.docusaurusPreset;
  state.packages.cli = recommended.createProjectDocs;
  state.packages.content = content.packageJson.version;
  writeState(projectRoot, state);
  console.log('Initialized managed state. Existing files preserved. Run create-project-docs update template next.');
}

async function main() {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    usage();
    return;
  }
  const command = args[0];
  if (command === 'new') {
    const name = args[1];
    if (!name || name.startsWith('-')) throw new Error('Missing project name.');
    const target = path.resolve(name);
    if (fs.existsSync(target)) throw new Error(`Target already exists: ${target}`);
    const parent = path.dirname(target);
    if (!fs.existsSync(parent)) throw new Error(`Parent directory does not exist: ${parent}`);
    const temporaryTarget = fs.mkdtempSync(path.join(parent, '.create-project-docs-'));
    try {
      scaffoldProject(temporaryTarget, false, false);
      fs.renameSync(temporaryTarget, target);
    } catch (error) {
      fs.rmSync(temporaryTarget, {recursive: true, force: true});
      throw error;
    }
    console.log(`Created documentation project at ${target}`);
    console.log('Run: cd documentation && npm start');
    return;
  }
  if (command === 'add') {
    const target = path.resolve(argumentValue('--path') ?? process.cwd());
    if (!fs.existsSync(target)) throw new Error(`Target does not exist: ${target}`);
    if (fs.existsSync(path.join(target, 'documentation'))) throw new Error('documentation already exists.');
    scaffoldProject(target, true);
    return;
  }

  const projectRoot = findProjectRoot(process.cwd());
  if (command === 'section' && args[1] === 'list') return listSections(projectRoot);
  if (command === 'section' && args[1] === 'add') return addSection(projectRoot, args[2]);
  if (command === 'section' && args[1] === 'update') return updateSections(projectRoot, args[2]);
  if (command === 'doctor') return doctor(projectRoot);
  if (command === 'migrate') return migrate(projectRoot);
  if (command === 'check') return checkUpdates(projectRoot, args.includes('--startup'));
  if (command === 'update') {
    const target = args[1];
    if (target === 'runtime') return updateRuntime(projectRoot);
    if (target === 'template') return updateTemplate(projectRoot);
    if (target === 'content') return updateContent(projectRoot);
    if (target === 'all') {
      updateRuntime(projectRoot);
      updateTemplate(projectRoot);
      return updateContent(projectRoot);
    }
  }
  usage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
