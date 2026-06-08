# Screwworm Watch

Esri-style operations dashboard for USDA APHIS screwworm surveillance tracking, with USDA NASS cattle census overlay.

Built with Next.js + Maplibre GL, deployed to Vercel, with nightly data ETL via GitHub Actions.

## Quick Start

```bash
cp .env.example .env.local   # add your API keys
npm install
npm run dev                  # http://localhost:3000
```

## Deploy

```bash
vercel --prod
```

## Map Layers

| Layer | Source | Color |
|-------|--------|-------|
| Screwworm Cases | USDA APHIS | Red / Orange / Amber |
| Cattle Density Heatmap | USDA NASS | Teal → Purple |
| Cattle Population Circles | USDA NASS | Blue |
| Combined Risk | Calculated | Dark Red |

## ETL Pipeline

Runs nightly at 2 AM UTC via `.github/workflows/etl.yml`:

1. `scripts/screwworm_scraper.py` — fetch USDA APHIS case data
2. `scripts/cattle_census_fetcher.py` — fetch USDA NASS cattle inventory
3. `scripts/analyze_hotspots.py` — aggregate + calculate risk scores
4. Commit updated JSON to `public/data/`

## Required Secrets (GitHub)

```
USDA_APHIS_API_KEY
NASS_QUICKSTATS_API_KEY
SLACK_WEBHOOK_URL        (optional)
```

## Docs

See `docs/` for deployment guide and cattle census integration details.
