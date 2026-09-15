# @tu-cis-courses/create-project-docs

Create a project:

```bash
npx @tu-cis-courses/create-project-docs@next new my-project
```

Inside a generated documentation application:

```bash
npm run docs:list
npm run docs:add requirements
npm run docs:add architecture
npm run docs:add testing
npm run docs:add api
npm run docs:customize -- navigation
npm run docs:customize -- css
npm run docs:upgrade
```

Navigation customization creates `documentation/project-docs.json`. It hides
template-help navigation by default and accepts additional `navbarItems` and
`footerColumns`. CSS customization creates or adopts
`documentation/src/css/custom.css`. Both files are student-owned and are not
replaced by template updates.

Run `create-project-docs migrate` in an existing project to adopt managed
updates without replacing student-authored documentation files.
