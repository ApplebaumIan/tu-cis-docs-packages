const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const DEFAULT_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/1/17/Temple_T_logo.svg';
const DEFAULT_PROJECT_NAME = 'docs-dev-mode';

function toTitle(value) {
  return String(value)
    .replaceAll('-', ' ')
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ');
}

function normalizeBaseUrl(value) {
  const normalized = String(value || DEFAULT_PROJECT_NAME).replace(/^\/+|\/+$/g, '');
  return `/${normalized}/`;
}

function mergeThemeConfig(base, override = {}) {
  return {
    ...base,
    ...override,
    navbar: {
      ...base.navbar,
      ...override.navbar,
      items: override.navbar?.items ?? base.navbar.items,
    },
    footer: {
      ...base.footer,
      ...override.footer,
      links: override.footer?.links ?? base.footer.links,
    },
  };
}

function isGitWorkTree(directory) {
  try {
    return execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() === 'true';
  } catch {
    return false;
  }
}

function createProjectDocsConfig(options = {}) {
  const siteDir = options.siteDir ?? process.cwd();
  const organizationName = options.organizationName ?? process.env.ORG_NAME;
  const projectName = options.projectName ?? process.env.PROJECT_NAME ?? DEFAULT_PROJECT_NAME;
  const title = options.title ?? toTitle(projectName);
  const logo = options.logo ?? DEFAULT_LOGO;
  const repositoryUrl = organizationName && projectName
    ? `https://github.com/${organizationName}/${projectName}`
    : undefined;
  const localCss = path.join(siteDir, 'src', 'css', 'custom.css');
  const docsPath = options.docsPath ?? path.join(siteDir, 'docs');
  const openapiSpec = options.openapiSpec
    ?? path.join(docsPath, 'api-specification', 'openapi', 'index.openapi.yaml');
  const hasOpenApi = options.openapi !== false && fs.existsSync(openapiSpec);
  const showLastUpdateAuthor = options.showLastUpdateAuthor ?? isGitWorkTree(siteDir);
  const baseThemeConfig = {
    ...(process.env.NODE_ENV === 'development'
      ? {
          announcementBar: {
            id: 'dev_mode',
            content: 'You are viewing a local development build. This is not the live documentation site.',
            backgroundColor: '#ffca00',
            textColor: '#091E42',
            isCloseable: false,
          },
        }
      : {}),
    navbar: {
      title,
      logo: {alt: 'Project logo', src: logo},
      items: [
        {type: 'doc', docId: 'intro', position: 'left', label: 'Documentation'},
        {to: '/tutorial/intro', label: 'Template Help', position: 'left', activeBaseRegex: '/tutorial/'},
        ...(repositoryUrl ? [{href: repositoryUrl, label: 'GitHub', position: 'right'}] : []),
      ],
    },
    footer: {
      logo: {alt: 'Project logo', src: logo},
      links: [
        {title: 'Docs', items: [{label: 'Documentation', to: '/docs/intro'}]},
        {
          title: 'More',
          items: [
            ...(repositoryUrl ? [{label: 'GitHub', href: repositoryUrl}] : []),
            {label: 'Template Contributors', to: '/tutorial/open-source-usage'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ${title}. Built with Docusaurus.`,
    },
  };
  const presets = [
    [
      require.resolve('@docusaurus/preset-classic'),
      {
        docs: {
          showLastUpdateAuthor,
          sidebarPath: options.sidebarPath ?? path.join(siteDir, 'sidebars.js'),
          routeBasePath: 'docs',
          path: docsPath,
          editUrl: options.editUrl ?? (repositoryUrl ? `${repositoryUrl}/edit/main/documentation/` : undefined),
          ...options.docs,
        },
        theme: {
          customCss: fs.existsSync(localCss) ? localCss : undefined,
          ...options.classicTheme,
        },
        ...options.classic,
      },
    ],
    ...(hasOpenApi
      ? [[
          require.resolve('redocusaurus'),
          {
            specs: [{id: 'project-api', spec: openapiSpec, route: '/api/'}],
            ...options.redocusaurus,
          },
        ]]
      : []),
    [
      require.resolve('../preset'),
      {
        organizationName,
        projectName,
        repoRoot: options.repoRoot,
        ...options.preset,
        revisionHistory: process.env.DISABLE_REVISION_HISTORY === '1' || options.preset?.revisionHistory === false
          ? false
          : {
              contentSources: [{routeBasePath: 'docs', path: docsPath}],
              ...options.preset?.revisionHistory,
            },
      },
    ],
    ...(options.presets ?? []),
  ];

  return {
    title,
    tagline: options.tagline ?? 'Project documentation',
    url: options.url ?? (organizationName ? `https://${organizationName}.github.io/` : 'https://example.com/'),
    baseUrl: options.baseUrl ?? normalizeBaseUrl(projectName),
    trailingSlash: false,
    onBrokenLinks: options.onBrokenLinks ?? 'warn',
    favicon: options.favicon ?? 'img/favicon.ico',
    organizationName,
    projectName,
    ...(options.staticDirectories ? {staticDirectories: options.staticDirectories} : {}),
    i18n: {defaultLocale: 'en', locales: ['en'], ...options.i18n},
    markdown: {
      ...options.markdown,
      mermaid: options.markdown?.mermaid ?? true,
      hooks: {
        onBrokenMarkdownLinks: options.onBrokenMarkdownLinks ?? 'warn',
        ...options.markdown?.hooks,
      },
    },
    presets,
    plugins: options.plugins ?? [],
    themes: options.themes ?? [],
    scripts: options.scripts ?? [],
    themeConfig: mergeThemeConfig(baseThemeConfig, options.themeConfig),
    future: options.future,
  };
}

module.exports = {
  createProjectDocsConfig,
  normalizeBaseUrl,
  toTitle,
};
