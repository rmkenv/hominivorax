# Screwworm Operations Dashboard - Deployment Guide

## Overview
Production-grade Esri-style operations dashboard for USDA screwworm surveillance tracking, deployed to Vercel with nightly ETL pipeline via GitHub Actions.

---

## Architecture

### Frontend
- **Framework**: Next.js 14 with React 18
- **Mapping**: Maplibre GL (ArcGIS basemap integration)
- **Styling**: Tailwind CSS with Esri operational design language
- **Deployment**: Vercel (serverless, automatic SSL, CDN)

### Backend/Data Pipeline
- **Data Source**: USDA APHIS API (screwworm.usda.gov, lab confirmation records)
- **ETL**: Python scripts via GitHub Actions (nightly @ 2 AM UTC)
- **Data Format**: JSON (cases.json, hotspots.geojson)
- **Storage**: GitHub repo + optional Vercel KV (Redis)

### Operational Features
- Real-time case hotspot mapping (county-level aggregation)
- Severity classification (high/medium/low based on case count)
- Timeline of confirmations and containment actions
- Recovery rate metrics and 7-day trend tracking
- Geographic heatmap visualization

---

## Quick Start (5 minutes)

### 1. Clone & Setup
```bash
git clone https://github.com/your-org/screwworm-watch.git
cd screwworm-watch
npm install
```

### 2. Local Development
```bash
npm run dev
# Opens http://localhost:3000
```

### 3. Deploy to Vercel
```bash
# Option A: Via Vercel CLI
npm install -g vercel
vercel

# Option B: Connect GitHub repo in Vercel dashboard
# https://vercel.com/new
```

---

## GitHub Actions Setup

### 1. Create Workflow File
Place the provided `screwworm-etl-workflow.yml` in `.github/workflows/`:
```bash
mkdir -p .github/workflows
cp screwworm-etl-workflow.yml .github/workflows/
```

### 2. Add Repository Secrets
In GitHub repo settings → Secrets and variables:

```
USDA_APHIS_API_KEY         # USDA API credentials
SLACK_WEBHOOK_URL          # For operational alerts (optional)
VERCEL_KV_REST_API_URL     # For Vercel KV caching (optional)
VERCEL_KV_REST_API_TOKEN   # Vercel KV token (optional)
```

### 3. Verify Workflow
- Go to Actions tab
- Select "Screwworm Data ETL"
- Trigger manually or wait for nightly run

---

## Data Pipeline Details

### Nightly ETL Flow (runs 2 AM UTC)
1. **Scrape**: Fetch USDA APHIS confirmed cases via API
2. **Geocode**: Map case locations to counties/coordinates
3. **Analyze**: Identify hotspots and calculate severity
4. **Publish**: Save as JSON and push to git repo
5. **Alert**: Send Slack notification with summary

### Python Dependencies
```bash
# scripts/requirements.txt
requests>=2.31.0
pandas>=2.1.0
geopandas>=0.14.0
shapely>=2.0.0
beautifulsoup4>=4.12.0
lxml>=4.9.0
python-dateutil>=2.8.2
pytz>=2023.3
```

### Data Structure (hotspots.json)
```json
{
  "metadata": {
    "lastUpdated": "2024-06-08T02:15:00Z",
    "dataSource": "USDA APHIS Screwworm Eradication Program",
    "jurisdiction": "United States + Mexico Border Region"
  },
  "summary": {
    "totalCases": 156,
    "activeCases": 23,
    "newCases7d": 8,
    "recoveryRate": 94.2,
    "trend": "declining"
  },
  "hotspots": [
    {
      "id": "tx-south-padre",
      "name": "South Padre Island, TX",
      "lat": 26.1155,
      "lng": -97.1670,
      "caseCount": 12,
      "severity": "high",
      "status": "containment",
      "confirmedDate": "2024-06-01"
    }
  ]
}
```

---

## Environment Variables

### Required
```bash
# .env.local (local development)
NEXT_PUBLIC_MAPLIBRE_API_KEY=your_key_here
```

### Optional (Vercel Deployment)
```bash
USDA_APHIS_API_KEY=your_api_key
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
VERCEL_KV_REST_API_URL=https://your-project.kv.vercel.sh
VERCEL_KV_REST_API_TOKEN=...
```

---

## Project Structure
```
screwworm-watch/
├── pages/
│   ├── api/
│   │   ├── cases.js          # Case data endpoint
│   │   └── hotspots.js       # Hotspot aggregation
│   └── index.js              # Dashboard component
├── scripts/
│   └── etl/
│       ├── screwworm_scraper.py    # USDA data fetch
│       ├── geocode_cases.py        # Geocoding logic
│       ├── analyze_hotspots.py     # Severity calculation
│       └── build_geojson.py        # GeoJSON output
├── data/
│   ├── cases.json            # Raw case records
│   └── hotspots.geojson      # Aggregated hotspots
├── .github/workflows/
│   └── screwworm-etl.yml     # Nightly ETL pipeline
├── package.json
├── next.config.js
└── vercel.json
```

---

## Design & Visual Language

### Esri Operational Aesthetics
- **Color Palette**: Dark theme (gray-950 background) with operational red (#e63946) accent
- **Severity Colors**: 
  - Red (#e63946): High severity / >10 cases
  - Orange (#f77f00): Medium / 3-10 cases
  - Amber (#fcbf49): Low / 1-2 cases
- **Typography**: Sans-serif system fonts for clarity
- **Layout**: Split-pane (map + details), mimics ArcGIS Ops Dashboard

### Key UI Components
1. **Summary Bar**: 4 operational KPIs (active cases, new 7d, hotspots, recovery rate)
2. **Interactive Map**: Maplibre GL with circle markers sized by case count
3. **Hotspot List**: Scrollable cards with severity indicators
4. **Timeline**: Chronological event log of confirmations/actions
5. **Case Detail Panel**: Expanded info on selected hotspot

---

## API Endpoints

### GET /api/cases
Returns raw case data
```bash
curl https://screwworm-watch.vercel.app/api/cases
```

### GET /api/hotspots
Returns aggregated hotspot data with metadata
```bash
curl https://screwworm-watch.vercel.app/api/hotspots?timeRange=30d
```

---

## Monitoring & Alerts

### Slack Integration
ETL pipeline sends alerts:
- ✅ Daily: ETL success + case count summary
- 🔴 High-severity zone detected
- 📊 Weekly summary with trend analysis

### Health Checks
- Vercel: Monitor dashboard uptime
- GitHub Actions: Check ETL logs for failures
- Data freshness: Last updated timestamp visible in UI

---

## Scaling Considerations

### For Higher Data Volume
1. **Switch to Vercel KV**: Redis backend for real-time caching
2. **Add Streaming**: WebSocket updates for live case confirmations
3. **Geo-spatial DB**: PostGIS for complex spatial queries
4. **Map Clusters**: Cluster circles at low zoom for performance

### For Multi-User Operations
1. Add authentication (Vercel Auth)
2. Role-based access (state vs federal vs USDA staff)
3. Audit logging
4. Real-time collaboration features

---

## Testing

### Local Testing
```bash
npm run dev
# Dashboard loads with mock data
# Test interactivity: click hotspots, switch tabs
```

### ETL Testing
```bash
cd scripts/etl
python screwworm_scraper.py --test
# Verify data structure without uploading
```

### Vercel Deployment
```bash
vercel --prod
# Sets NEXT_PUBLIC_* variables from vercel.json
```

---

## Troubleshooting

### Map Not Loading
- Verify Maplibre GL installed: `npm list maplibre-gl`
- Check browser console for Maplibre errors
- Ensure Maplibre CSS is imported in _app.js

### ETL Pipeline Failing
- Check GitHub Actions logs (Actions tab)
- Verify USDA_APHIS_API_KEY is set in repo secrets
- Test Python script locally: `python scripts/etl/screwworm_scraper.py`

### Data Not Updating
- Check `data/hotspots.json` timestamp
- Trigger workflow manually: Actions → Screwworm Data ETL → Run workflow
- Verify git push in ETL logs (git credentials configured)

---

## Real-world Integration Notes

### Connecting to Live USDA Data
Update `screwworm_scraper.py`:
1. Obtain USDA APHIS API credentials
2. Replace mock endpoints with real URLs:
   - `screwworm.usda.gov/api/cases`
   - `aphis.usda.gov/laboratory-results`
3. Handle authentication (OAuth2 or API key)
4. Parse XML/JSON responses to standard format

### State-Level Integration
Integrate with state veterinary agency systems:
- Texas Parks & Wildlife Department
- Arizona Department of Agriculture
- California Department of Food & Agriculture
- Local animal health authority feeds

---

## References
- [USDA APHIS Screwworm Info](https://www.aphis.usda.gov/aphis/resources/pests-diseases/exotic-pests/screwworm)
- [Maplibre GL Docs](https://maplibre.org/maplibre-gl-js/docs/)
- [Vercel Deployment](https://vercel.com/docs)
- [Next.js Guide](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## License & Attribution
Dashboard developed for USDA APHIS Screwworm Eradication Program.
Data sources: USDA APHIS, state veterinary agencies, laboratory confirmations.

Questions? Contact your USDA regional operations coordinator.
