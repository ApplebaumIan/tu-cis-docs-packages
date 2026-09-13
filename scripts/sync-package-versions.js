const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const packages = {
  components: 'docusaurus-components',
  preset: 'docusaurus-preset',
  template: 'docusaurus-template',
  content: 'docs-content-template',
  cli: 'create-project-docs',
};

function read(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

function write(relative, value) {
  fs.writeFileSync(path.join(root, relative), `${JSON.stringify(value, null, 2)}\n`);
}

const versions = Object.fromEntries(Object.entries(packages).map(([key, directory]) => [
  key,
  read(`packages/${directory}/package.json`).version,
]));

const compatibilityPackage = read('packages/create-project-docs-compat/package.json');
compatibilityPackage.dependencies['@tu-cis-courses/create-project-docs'] = versions.cli;
write('packages/create-project-docs-compat/package.json', compatibilityPackage);

const manifest = read('packages/docusaurus-template/manifest.json');
const scaffoldPackage = read('packages/docusaurus-template/scaffold/documentation/package.json');
const embeddedVersionsChanged = (
  manifest.recommended.docusaurusComponents !== versions.components
  || manifest.recommended.docusaurusPreset !== versions.preset
  || manifest.recommended.docsContentTemplate !== versions.content
  || manifest.recommended.createProjectDocs !== versions.cli
  || scaffoldPackage.dependencies['@tu-cis-courses/docusaurus-components'] !== versions.components
  || scaffoldPackage.dependencies['@tu-cis-courses/docusaurus-preset'] !== versions.preset
  || scaffoldPackage.devDependencies['@tu-cis-courses/create-project-docs'] !== versions.cli
  || scaffoldPackage.devDependencies['@tu-cis-courses/docs-content-template'] !== versions.content
  || scaffoldPackage.devDependencies['@tu-cis-courses/docusaurus-template'] !== versions.template
);
if (embeddedVersionsChanged) {
  const previousTemplate = JSON.parse(execFileSync(
    'git',
    ['show', 'HEAD:packages/docusaurus-template/package.json'],
    {cwd: root, encoding: 'utf8'},
  ));
  if (previousTemplate.version === versions.template) {
    throw new Error('Embedded package versions changed without a docusaurus-template changeset.');
  }
}
manifest.recommended.docusaurusComponents = versions.components;
manifest.recommended.docusaurusPreset = versions.preset;
manifest.recommended.docsContentTemplate = versions.content;
manifest.recommended.createProjectDocs = versions.cli;
write('packages/docusaurus-template/manifest.json', manifest);

for (const relative of [
  'packages/docusaurus-template/scaffold/documentation/package.json',
  'documentation/package.json',
]) {
  const packageJson = read(relative);
  packageJson.dependencies['@tu-cis-courses/docusaurus-components'] = versions.components;
  packageJson.dependencies['@tu-cis-courses/docusaurus-preset'] = versions.preset;
  packageJson.devDependencies['@tu-cis-courses/create-project-docs'] = versions.cli;
  packageJson.devDependencies['@tu-cis-courses/docs-content-template'] = versions.content;
  packageJson.devDependencies['@tu-cis-courses/docusaurus-template'] = versions.template;
  write(relative, packageJson);
}
