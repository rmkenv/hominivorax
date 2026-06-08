# Cattle Census Integration Summary

## What's New

Your Screwworm Operations Dashboard now includes **three cattle-related map layers** that overlay USDA NASS census data with screwworm case hotspots.

---

## Key Features Added

### 1. **Cattle Density Heatmap** (Background Layer)
- Visualizes county-level cattle population density across the border region
- Color ramp: Teal → Purple (low → high concentration)
- Shows where cattle operations are clustered
- Source: USDA NASS 2023 Census of Agriculture

### 2. **Cattle Population Circles** (Mid Layer)
- Blue circles scaled by total cattle inventory
- Size ranges 8-18px based on head count
- Density classification: Very-high (>100k) → Low (<10k)
- Hover-friendly for interactive exploration

### 3. **Combined Risk Assessment** (Overlay)
- Red/orange circles calculate operational risk as:
  - **60% screwworm case density** + **40% cattle concentration**
- Size indicates total impact magnitude
- Color indicates criticality: Dark Red (critical) → Orange (moderate)
- Identifies highest-priority eradication targets

---

## UI Updates

### Map Legend (Top-Right Corner)
New interactive legend with **3 toggles**:
```
☑ Screwworm Cases
☑ Cattle Density (NASS)
☑ Risk (Cases × Cattle)
```

Each toggle controls visibility of corresponding layers.

### Right Panel - New "Cattle" Tab
Three tabs now in right panel:
1. **Cases** - Screwworm hotspot details (original)
2. **Cattle** - NEW Population breakdown by location
3. **Timeline** - Operational events (original)

#### Cattle Tab Contents:
- **Total cattle population** for selected location
- **Breakdown by type**: Dairy, Feedlot, Grazing
- **Risk level indicator**: Critical/High/Moderate/Low
- **Sortable county list** with cattle head count
- **NASS attribution** and data year

---

## Data Integration

### New Files
```
scripts/etl/cattle_census_fetcher.py    # Fetches NASS QuickStats data
pages/api/cattle.js                     # API endpoint for cattle data
data/cattle-census.json                 # Processed census data
```

### Updated Files
```
.github/workflows/screwworm-etl-workflow.yml  # Added cattle ETL step
screwworm-dashboard.jsx                       # Added 3 new layers + Cattle tab
```

### New Endpoint
```
GET /api/cattle?state=TX&density=very-high&minCattle=100000
```

---

## Map Layer Architecture

```
┌─────────────────────────────────────┐
│  Screwworm Case Points (foreground) │ ← Red/Orange/Amber circles
├─────────────────────────────────────┤
│  Combined Risk Circles (high z)      │ ← Dark red (critical risk)
├─────────────────────────────────────┤
│  Cattle Population Points (mid)      │ ← Blue circles, density-scaled
├─────────────────────────────────────┤
│  Cattle Density Heatmap (background) │ ← Teal→Purple gradient
├─────────────────────────────────────┤
│  Basemap (ArcGIS Imagery)            │ ← Base layer
└─────────────────────────────────────┘
```

Each layer has independent toggle control.

---

## Sample Data (Texas South Padre Island)

```json
{
  "name": "South Padre Island, TX",
  "screwwormCases": 12,
  "severity": "high",
  
  "cattlePopulation": 125000,
  "cattleBreakdown": {
    "dairy": 42000,
    "feedlot": 58000,
    "grazing": 25000
  },
  "density": "very-high",
  
  "riskScore": 0.85,
  "riskLevel": "critical"
}
```

---

## ETL Pipeline Changes

### GitHub Actions Workflow
New step added to nightly ETL:
```yaml
- name: Fetch USDA NASS cattle census data
  env:
    NASS_QUICKSTATS_API_KEY: ${{ secrets.NASS_QUICKSTATS_API_KEY }}
  run: python scripts/etl/cattle_census_fetcher.py
```

**Timing**: Nightly 2 AM UTC (same as screwworm ETL)

**Output**: `data/cattle-census.json` + auto-commit to repo

---

## Configuration Required

### GitHub Secrets to Add
```
NASS_QUICKSTATS_API_KEY=<your_nass_api_key>
```

Get API key from: https://quickstats.nass.usda.gov/

### Optional: Live Data Switch
Currently using mock data. To enable live NASS API calls:
1. Uncomment line 70 in `cattle_census_fetcher.py`
2. Ensure `NASS_QUICKSTATS_API_KEY` is in GitHub secrets
3. Redeploy

---

## Operational Use Cases

### Identify High-Value Targets
Filter: Cattle Density = "very-high" + Risk = "critical"
→ Prioritize these locations for intensive eradication efforts

### Assess Containment Feasibility
View cattle distribution + case locations
→ Determine if quarantine zones encompass all exposed livestock

### Allocate Resources
Sum risk scores by state
→ Station mobile labs and treatment supplies where impact is highest

---

## Files Provided

1. **screwworm-dashboard.jsx** - Enhanced component with 3 cattle layers
2. **cattle_census_fetcher.py** - ETL script for NASS data
3. **pages-api-cattle.js** - New `/api/cattle` endpoint
4. **screwworm-etl-workflow.yml** - Updated with cattle ETL step
5. **CATTLE_CENSUS_GUIDE.md** - Detailed integration guide
6. **DEPLOYMENT_GUIDE.md** - Original deployment guide (unchanged)

---

## Color Palette Reference

```
Cattle Density Heatmap:
  0%   → rgba(0, 128, 128, 0)      [Transparent teal]
  20%  → rgba(0, 150, 136, 0.3)    [Light teal]
  40%  → rgba(0, 188, 212, 0.5)    [Cyan]
  60%  → rgba(33, 150, 243, 0.6)   [Blue]
  80%  → rgba(63, 81, 181, 0.7)    [Indigo]
  100% → rgba(103, 58, 183, 0.8)   [Purple]

Cattle Density Circles:
  very-high → #1e40af (Blue-900)
  high      → #3b82f6 (Blue-500)
  medium    → #60a5fa (Blue-400)
  low       → #93c5fd (Blue-300)

Risk Assessment:
  critical → #7f1d1d (Red-900)
  high     → #dc2626 (Red-600)
  moderate → #ea580c (Orange-600)
```

---

## Testing Locally

```bash
# 1. Clone repo
git clone https://github.com/your-org/screwworm-watch.git
cd screwworm-watch

# 2. Install dependencies
npm install

# 3. Run development server
npm run dev
# Opens http://localhost:3000

# 4. Test map layers
# - Toggle "Cattle Density (NASS)" in legend
# - Click on blue circles to select locations
# - Switch to "Cattle" tab for population details
# - Click red/orange circles for risk details
```

---

## Next Steps

1. **Add NASS API Key**: Set `NASS_QUICKSTATS_API_KEY` in GitHub secrets
2. **Deploy**: `git push` triggers GitHub Actions ETL
3. **Monitor**: Check Actions tab for successful data fetch
4. **Review**: View cattle data on live dashboard
5. **Integrate**: Implement in your operations briefing workflow

---

## Support Resources

- **NASS QuickStats**: https://quickstats.nass.usda.gov/
- **Maplibre GL Docs**: https://maplibre.org/maplibre-gl-js/docs/
- **USDA APHIS**: https://www.aphis.usda.gov/aphis/resources/pests-diseases/exotic-pests/screwworm
- **GitHub Actions**: https://docs.github.com/en/actions

---

For detailed integration instructions, see **CATTLE_CENSUS_GUIDE.md**.
