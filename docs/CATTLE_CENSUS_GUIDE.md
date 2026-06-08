# Cattle Census Integration - Screwworm Operations Dashboard

## Overview
The Screwworm Watch dashboard now includes USDA NASS cattle census data as an integrated map layer, enabling operational risk assessment by combining screwworm case density with cattle population concentration.

---

## Data Layers

### Layer 1: Cattle Density Heatmap
- **Source**: USDA NASS QuickStats API (2023 Census of Agriculture)
- **Type**: Background heatmap visualization
- **Data**: County-level total cattle inventory
- **Color Ramp**: Teal to purple (low to high density)
- **Units**: Head of cattle per county

### Layer 2: Cattle Population Circles
- **Size**: Scaled by total cattle population (8-18px radius)
- **Color**: Blue intensity based on density classification
- **Opacity**: 40% (subtle background layer)
- **Interactions**: Hover to highlight, click for details

### Layer 3: Combined Risk Assessment
- **Type**: Red/orange circles overlaying case locations
- **Calculation**: 60% case density + 40% cattle concentration
- **Severity**: Critical (>0.7 risk), High (0.5-0.7), Moderate (<0.5)
- **Use**: Identifies highest-impact eradication priorities

---

## Data Integration Points

### Frontend Map Layers
```javascript
// Layer order (bottom to top):
1. cattle-density-heatmap (background)
2. cattle-circles (population points)
3. risk-circles (combined assessment)
4. case-points (screwworm cases - foreground)

// Toggles in legend control all layers visibility
- "Screwworm Cases" → case-points
- "Cattle Density (NASS)" → cattle-density-heatmap + cattle-circles
- "Risk (Cases × Cattle)" → risk-circles
```

### Right Panel Tabs
- **Cases Tab**: Screwworm hotspot details (original)
- **Cattle Tab**: NEW - Population breakdown by location
  - Total cattle inventory
  - Breakdown: dairy, feedlot, grazing
  - Risk level indicator
  - Sortable by population
- **Timeline Tab**: Operational events (original)

---

## ETL Pipeline Integration

### New Step: Cattle Census Fetch
```yaml
# Added to .github/workflows/screwworm-etl.yml
- name: Fetch USDA NASS cattle census data
  env:
    NASS_QUICKSTATS_API_KEY: ${{ secrets.NASS_QUICKSTATS_API_KEY }}
  run: |
    python scripts/etl/cattle_census_fetcher.py
```

### Data Files Generated
```
data/
├── hotspots.json          # Screwworm hotspots (original)
├── cattle-census.json     # NEW - Cattle by county
└── cattle-risk-combined.json # NEW - Merged assessment
```

### Cattle Census Data Structure
```json
{
  "metadata": {
    "source": "USDA NASS - National Agricultural Statistics Service",
    "year": 2023,
    "lastUpdated": "2024-06-08T02:15:00Z",
    "dataUrl": "https://quickstats.nass.usda.gov/"
  },
  "summary": {
    "totalCounties": 6,
    "states": ["TX", "AZ", "NM", "CA", "FL"],
    "totalCattle": 324000
  },
  "counties": [
    {
      "state": "TX",
      "county": "Willacy",
      "cattle": 125000,
      "dairy": 42000,
      "feedlot": 58000,
      "grazing": 25000,
      "density": "very-high",
      "lat": 26.2234,
      "lng": -97.5200
    }
  ]
}
```

---

## API Endpoints

### GET /api/cattle
Returns cattle census data with optional filters

**Query Parameters:**
- `state`: Filter by state code (TX, AZ, NM, CA, FL)
- `density`: Filter by density level (very-high, high, medium, low)
- `minCattle`: Filter by minimum population (e.g., ?minCattle=50000)

**Example Requests:**
```bash
# All cattle data
curl https://screwworm-watch.vercel.app/api/cattle

# Texas counties only
curl https://screwworm-watch.vercel.app/api/cattle?state=TX

# High-density counties
curl https://screwworm-watch.vercel.app/api/cattle?density=very-high

# Large operations (>100k head)
curl https://screwworm-watch.vercel.app/api/cattle?minCattle=100000
```

**Response:**
```json
{
  "metadata": { ... },
  "summary": { ... },
  "counties": [ ... ]
}
```

### GET /api/hotspots
Enhanced to include cattle risk calculation

**Response now includes per-hotspot:**
```json
{
  "id": "tx-south-padre",
  "name": "South Padre Island, TX",
  "caseCount": 12,
  "cattlePopulation": 125000,
  "riskScore": 0.85,
  "riskLevel": "critical"
}
```

---

## Setup Instructions

### 1. Get NASS API Credentials
1. Visit https://quickstats.nass.usda.gov/
2. Register for API access
3. Generate API key
4. Add to GitHub repo secrets as `NASS_QUICKSTATS_API_KEY`

### 2. Update GitHub Secrets
```
NASS_QUICKSTATS_API_KEY=your_nass_api_key
```

### 3. Configure ETL Script
The `cattle_census_fetcher.py` script is ready to use:

```bash
# Local testing
export NASS_QUICKSTATS_API_KEY=your_key
python scripts/etl/cattle_census_fetcher.py
```

### 4. Deploy Updates
```bash
git add scripts/etl/cattle_census_fetcher.py
git add .github/workflows/screwworm-etl-workflow.yml
git commit -m "feat: add USDA cattle census layer"
git push
```

---

## Visual Design Notes

### Color Scheme
- **Cattle Density**: Teal (0) → Purple (1.0 intensity)
  - Represents population concentration
  - Subtle background layer (0.7 opacity)
  
- **Case Severity**: Red/Orange/Amber (existing)
  - High (red) overlays strong background signal
  - Medium/Low (orange/amber) more visible over cattle layer

- **Combined Risk**: Dark Red (critical) → Orange (moderate)
  - Darker red = higher priority for operations
  - Size indicates total impact (cases × population)

### Interaction Model
1. **Hover over cattle circle**: Shows population breakdown tooltip
2. **Click cattle circle**: Selects location, shows details in Cattle tab
3. **Click case circle**: Selects location, shows case details in Cases tab
4. **Toggle layers**: Quickly hide/show overlays for focus

---

## Operational Use Cases

### Use Case 1: High-Value Targets
_Identify where screwworm cases are near largest cattle operations_

```
Filter: Cattle Density = "very-high" + Risk Level = "critical"
→ South Padre Island, TX: 12 cases + 125,000 head
```

Actions: Prioritize intensive treatment, quarantine enforcement, press coordination

### Use Case 2: Outbreak Containment
_Assess spread risk based on cattle distribution_

```
Map view: Cattle density heatmap + risk circles
→ Identify isolated vs. dispersed cattle in containment zone
```

Actions: Determine quarantine feasibility, estimate eradication timeline

### Use Case 3: Resource Allocation
_Allocate veterinary staff and equipment by risk/volume intersection_

```
Dashboard metric: Sum of (cases × cattle) per state
→ Texas: 85% of total risk load
```

Actions: Station mobile labs, pre-position treatment supplies in high-risk counties

---

## Data Maintenance

### Update Frequency
- **Screwworm cases**: Nightly (via ETL)
- **Cattle census**: Weekly or monthly
  - NASS data updates quarterly
  - Can manually trigger full refresh via GitHub Actions

### Manual Refresh
```bash
# Trigger ETL manually
gh workflow run screwworm-etl-workflow.yml

# Or via GitHub UI:
# Actions → Screwworm + Cattle Census Data ETL → Run workflow
```

### Cache Invalidation
API responses are cached for:
- Hotspots: 1 hour (stale-while-revalidate: 2 hours)
- Cattle: 24 hours (stale-while-revalidate: 2 days)

To force refresh in development:
```javascript
// In browser console
caches.keys().then(names => {
  names.forEach(name => caches.delete(name));
});
```

---

## Real-World NASS Integration

### Current State
Dashboard uses mock cattle data (pre-populated for demo)

### Switching to Live NASS Data
1. Uncomment API calls in `cattle_census_fetcher.py`:
```python
# Line ~70: Uncomment NASS API fetch
response = requests.get(NASS_API_URL, params=params, timeout=30)
```

2. Handle API rate limits:
```python
# NASS QuickStats has rate limiting
# Implement with exponential backoff
```

3. Parse NASS response format:
```python
# NASS returns data with structure:
# {
#   "data": [
#     {"commodity_desc": "CATTLE, INCL CALVES", "Value": "125,000", ...}
#   ]
# }
```

4. County centroid geocoding:
- Use FIPS-to-coordinates lookup
- Or reverse-geocode from NASS coordinates

---

## Monitoring & Alerts

### ETL Success Notification
Slack alert includes:
```
✅ Cattle Census ETL Complete
- Counties updated: 6
- Total cattle: 324,000
- Risk areas: 3 critical, 2 high
- Last run: 2024-06-08 02:15 UTC
```

### Data Freshness Monitoring
Header displays:
```
Last updated: [timestamp from cattle-census.json]
Data source: USDA NASS 2023 Census of Agriculture
```

---

## Troubleshooting

### Cattle Layer Not Showing
1. Check layer visibility in legend (toggle "Cattle Density")
2. Verify `cattle-census.json` exists in `/data`
3. Check browser console for Maplibre errors
4. Inspect: `map.getStyle().layers` to see layer list

### Risk Calculation Off
- Verify case counts in hotspots.json
- Check cattle populations in cattle-census.json
- Risk formula: `(cases/max_cases)*0.6 + (cattle/125000)*0.4`

### NASS API Errors
- Verify `NASS_QUICKSTATS_API_KEY` is set in repo secrets
- Check NASS API status: https://quickstats.nass.usda.gov/
- Review ETL logs in GitHub Actions

---

## References
- [USDA NASS QuickStats API Docs](https://quickstats.nass.usda.gov/api)
- [2023 Census of Agriculture](https://www.nass.usda.gov/AgCensus/)
- [Maplibre GL Heatmap Layer](https://maplibre.org/maplibre-gl-js/docs/API/types/HeatmapLayer/)
- [Screwworm Operations Dashboard Guide](./DEPLOYMENT_GUIDE.md)

---

## Support
For issues integrating cattle census data, contact your operations coordinator or create an issue in the repository.
