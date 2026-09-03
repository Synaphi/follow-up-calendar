# Follow-up Calendar

A focused Obsidian calendar for Markdown tasks containing both `📅 YYYY-MM-DD` and `#follow-up`.

```markdown
- [ ] Project · Send the follow-up email 📅 2026-09-13 #follow-up #project
```

The plugin adds a calendar icon to the left ribbon. It opens a live calendar and a newest-date-first list backed by the original Markdown tasks.

## Features

- Compact month calendar with a stable six-week layout
- Newest dates at the top of the list
- One-click completion that updates the source task
- Copyable `follow-up-calendar` block for any note
- Automatic Obsidian language detection plus manual English/한국어 selection
- Light and dark theme support using Obsidian theme variables

## Install manually

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Put them in `<vault>/.obsidian/plugins/follow-up-calendar/`.
3. Reload Obsidian, then enable **Follow-up Calendar** under Community plugins.

## Live blocks

````markdown
```follow-up-calendar
weekStart: monday
showCompleted: false
```
````

Use `follow-up-list` instead of `follow-up-calendar` for the list view.

## 한국어

`📅 YYYY-MM-DD`와 `#follow-up`이 같은 체크박스 줄에 있는 일정만 모아 달력과 목록으로 보여주는 간결한 Obsidian 플러그인입니다.

- 왼쪽 리본의 달력 아이콘으로 허브를 엽니다.
- 목록은 최신 날짜가 위에 표시됩니다.
- 체크박스를 누르면 원본 Markdown도 함께 바뀝니다.
- **복사** 버튼으로 실시간 달력 블록을 다른 노트에 붙여넣을 수 있습니다.
- Obsidian 언어를 자동 감지하며 설정에서 한국어 또는 English를 직접 선택할 수 있습니다.

## Development

```bash
npm install
npm test
npm run build
npm run deploy:local -- C:\path\to\vault
```

## License

MIT
