const path = require('path');

module.exports = function projectDocsPreset(context, options = {}) {
  const packageRoot = path.resolve(__dirname, '..', '..');
  const revisionHistory = options.revisionHistory === false
    ? []
    : [[
        require.resolve('../plugins/revision-history'),
        {
          cacheFile: '.cache/revision-history.json',
          pageSize: 5,
          organizationName: options.organizationName,
          projectName: options.projectName,
          repoRoot: options.repoRoot,
          contentSources: [{routeBasePath: 'docs', path: 'docs'}],
          ...(options.revisionHistory ?? {}),
        },
      ]];
  const tutorial = options.tutorial === false
    ? []
    : [[
        require.resolve('@docusaurus/plugin-content-docs'),
        {
          id: 'tutorial',
          path: path.join(packageRoot, 'tutorial'),
          routeBasePath: 'tutorial',
          showLastUpdateAuthor: false,
          sidebarPath: path.join(packageRoot, 'tutorialSidebars.js'),
          ...(options.tutorial ?? {}),
        },
      ]];

  return {
    plugins: [...revisionHistory, ...tutorial],
    themes: [
      require.resolve('@docusaurus/theme-live-codeblock'),
      require.resolve('@docusaurus/theme-mermaid'),
      [require.resolve('../themePlugin'), options.theme ?? {}],
    ],
  };
};
