# Follow-up Calendar

A small Obsidian plugin that shows only Markdown tasks containing both a calendar date and the `#follow-up` tag.

`- [ ] Project · Follow-up action 📅 2026-09-13 #follow-up #project`

Open the generated `Follow-up Calendar.md` note from the ribbon. Its calendar block can be copied into any other note and stays live because the Markdown source remains the single source of truth.

## Development

```bash
npm install
npm test
npm run build
npm run deploy:local -- C:\path\to\vault
```
