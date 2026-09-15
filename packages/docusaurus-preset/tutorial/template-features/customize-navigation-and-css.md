---
sidebar_position: 1
---

# Customize Navigation and CSS

When your project no longer needs Template Help in its navigation, run this
command from the `documentation` directory:

```bash
npm run docs:customize -- navigation
```

This creates the student-owned `project-docs.json` file:

```json
{
  "showTemplateHelp": false,
  "navbarItems": [],
  "footerColumns": []
}
```

Setting `showTemplateHelp` to `false` removes Template Help from the navbar and
Template Contributors from the footer. The tutorial remains available through
direct links. Add standard Docusaurus navbar items and footer columns to the
corresponding arrays.

For project-specific styles, run:

```bash
npm run docs:customize -- css
```

Edit the generated `src/css/custom.css` file with ordinary CSS. The project
stylesheet loads in addition to the template's base styles. The customization
command preserves existing files, and future template upgrades do not replace
either customization file.

Create both files at once with:

```bash
npm run docs:customize -- all
```
