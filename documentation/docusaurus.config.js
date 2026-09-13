// @ts-check

const path = require('path');
const {createProjectDocsConfig} = require('@tu-cis-courses/docusaurus-preset/config');

const repositoryRoot = path.resolve(__dirname, '..');
const contentRoot = path.join(repositoryRoot, 'packages', 'docs-content-template', 'content');
const templateStatic = path.join(
  repositoryRoot,
  'packages',
  'docusaurus-template',
  'scaffold',
  'documentation',
  'static',
);

module.exports = createProjectDocsConfig({
  siteDir: __dirname,
  repoRoot: repositoryRoot,
  docsPath: path.join(contentRoot, 'documentation', 'docs'),
  staticDirectories: [templateStatic],
  organizationName: process.env.ORG_NAME,
  projectName: process.env.PROJECT_NAME,
  tagline: 'Reusable documentation packages for CIS capstone projects',
  preset: {
    theme: {
      projectReadme: path.join(contentRoot, 'README.md'),
    },
  },
});
