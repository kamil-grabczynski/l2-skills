# Redesign: "modern L2"

These are mockups of a new look for the app. They are static HTML pages that use the real skill and class icons from `public/icons/`, and each page has a PNG export in `png/`. The app now uses the main direction (files 00–04); the alternative directions (05–07) are not used.

| File | Screen |
| --- | --- |
| `00-style-guide.html` | Colours, type, buttons, fields, skill slots, class crests, tags, bars, tooltip, rules |
| `01-class-picker.html` | Start page: race tiles, class tree with connector lines, class preview |
| `02-calculator.html` | SP calculator: character window, level range, SP total, skill list grouped by level |
| `03-skill.html` | Skill page: tooltip-style header, debuff land chance with a gauge, skill levels |
| `04-mobile.html` | Phone: skill list with a pinned SP bar, level range as a bottom sheet |
| `l2.css` | Shared tokens and components used by all mockups |

## Alternative directions

Each of these shows the SP calculator screen in a different style, so the directions can be compared side by side. Each page has its own styles and does not use `l2.css`.

| File | Direction |
| --- | --- |
| `05-variant-parchment.html` | **A: Parchment.** A light spell-book page with ink, red seals and Garamond type. It is the only light option. |
| `06-variant-classic.html` | **B: Classic HUD.** The app as game client windows from the Interlude era: grey see-through windows, a skill learn window like an NPC's, a status bar for the SP total, a quick-slot bar and a chat-style log. |
| `07-variant-crimson.html` | **C: Crimson launcher.** A modern game launcher look: a large class banner, crimson and violet, cut corners, number tiles and a grid of skill cards instead of a list. |

## Direction (main mockups)

- Night-blue glass windows with thin bronze frames and gold corner marks, like the game's UI windows.
- Cinzel for headings, class names and large numbers. Inter, with tabular figures, for everything else.
- Gold is used only for the SP total, the main button and the current class, chronicle or skill.
- Colours carry the game's meanings: MP is blue, debuffs are red and passive skills have steel slot frames.
- Skill icons sit in bevelled slots like the in-game skill bar, with the skill level in a badge.
- Dark theme only. The current app also has a light theme, and the redesign drops it.

## Notes for implementation

- The mockups load Cinzel and Inter from Google Fonts. The app bundles them from `@fontsource`, so it still makes no external requests.
- The tokens in `l2.css` (`:root`) can replace the variables at the top of `src/styles.css`.
- Some numbers and texts in the mockups are made up, such as the selected SP, the monster and the learn levels.

## Export PNGs

With the dev server running (`npm run dev`, port 5173):

```
chrome --headless=new --hide-scrollbars --window-size=1440,1221 --screenshot=design/png/02-calculator.png http://localhost:5173/design/02-calculator.html
```
