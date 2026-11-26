# Redesign: "modern L2"

These are mockups of a new look for the app. They are static HTML pages that use the real skill and class icons from `public/icons/`, and each page has a PNG export in `png/`. The app itself has not changed yet.

| File | Screen |
| --- | --- |
| `00-style-guide.html` | Colours, type, buttons, fields, skill slots, class crests, tags, bars, tooltip, rules |
| `01-class-picker.html` | Start page: race tiles, class tree with connector lines, class preview |
| `02-calculator.html` | SP calculator: character window, level range, SP total, skill list grouped by level |
| `03-skill.html` | Skill page: tooltip-style header, debuff land chance with a gauge, skill levels |
| `04-mobile.html` | Phone: skill list with a pinned SP bar, level range as a bottom sheet |
| `l2.css` | Shared tokens and components used by all mockups |

## Direction

- Night-blue glass windows with thin bronze frames and gold corner marks, like the game's UI windows.
- Cinzel for headings, class names and large numbers. Inter, with tabular figures, for everything else.
- Gold is used only for the SP total, the main button and the current class, chronicle or skill.
- Colours carry the game's meanings: MP is blue, debuffs are red and passive skills have steel slot frames.
- Skill icons sit in bevelled slots like the in-game skill bar, with the skill level in a badge.
- Dark theme only. The current app also has a light theme, and the redesign drops it.

## Notes for implementation

- The mockups load Cinzel and Inter from Google Fonts. The app should ship them as local woff2 files so it still makes no external requests.
- The tokens in `l2.css` (`:root`) can replace the variables at the top of `src/styles.css`.
- Some numbers and texts in the mockups are made up, such as the selected SP, the monster and the learn levels.

## Export PNGs

With the dev server running (`npm run dev`, port 5173):

```
chrome --headless=new --hide-scrollbars --window-size=1440,1221 --screenshot=design/png/02-calculator.png http://localhost:5173/design/02-calculator.html
```
