# Lineage 2 skills SP

Live: https://l2-skills.vercel.app

SP calculator for Lineage II chronicles C1 – High Five. Pick a class, a character level range and the skills you want; the app sums the SP you need.

Skill data and icons are stored in `public/`, so the app makes no external requests at runtime.

## Run

```
npm install
npm run dev
```

`npm run build` writes the static site to `dist/`.

## Refresh data

```
npm run scrape
```

Runs `scraper/scrape.py` (Python 3), which rewrites `public/data/*.json` and downloads missing icons into `public/icons/`.
