const fs = require('fs');
const path = require('path');

function resolveProjectReadme(siteDir, configuredPath) {
  const candidates = [
    configuredPath && path.resolve(siteDir, configuredPath),
    path.resolve(siteDir, '..', 'README.md'),
    path.resolve(siteDir, 'README.md'),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate))
    ?? path.resolve(__dirname, '..', 'fallbacks', 'ProjectReadme.mdx');
}

module.exports = function projectDocsTheme(context, options = {}) {
  return {
    name: '@tu-cis-courses/docusaurus-theme',

    getThemePath() {
      return path.resolve(__dirname, '..', 'theme');
    },

    getClientModules() {
      if (options.loadStyles === false) return [];
      return [
        path.resolve(__dirname, '..', '..', 'styles', 'custom.css'),
        ...(options.customCss ? [path.resolve(options.customCss)] : []),
      ];
    },

    configureWebpack() {
      return {
        resolve: {
          alias: {
            '@tu-cis-courses/project-readme-source': resolveProjectReadme(
              context.siteDir,
              options.projectReadme,
            ),
          },
        },
      };
    },
  };
};
