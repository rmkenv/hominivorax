#!/usr/bin/env python3
"""
Hotspot risk analyzer.
Reads hotspots.json + cattle-census.json, scores combined risk, rewrites hotspots.json.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path('public/data')

def load_json(path, label):
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        print(f'[analyze] Warning: {path} not found — skipping {label}')
        return None

def score(case_count, cattle, max_cases, max_cattle):
    cn = case_count / max_cases   if max_cases   > 0 else 0
    ct = cattle     / max_cattle  if max_cattle  > 0 else 0
    s  = round(cn * 0.6 + ct * 0.4, 3)
    return s, ('critical' if s > 0.7 else 'high' if s > 0.4 else 'moderate')

def main():
    print('[analyze] Loading hotspots and cattle data...')

    hotspot_data = load_json(DATA_DIR / 'hotspots.json', 'hotspots')
    if not hotspot_data:
        print('[analyze] Nothing to process — hotspots.json missing')
        return

    hotspots = hotspot_data.get('hotspots', [])
    if not hotspots:
        print('[analyze] hotspots list is empty — nothing to score')
        return

    # Build cattle lookup by hotspot id
    cattle_lookup = {}
    cattle_data = load_json(DATA_DIR / 'cattle-census.json', 'cattle')
    if cattle_data:
        for county in cattle_data.get('counties', []):
            cid = county.get('id') or county.get('county_code')
            if cid:
                cattle_lookup[cid] = county.get('cattle', 0)

    max_cases  = max((h.get('caseCount', 0) for h in hotspots), default=1)
    max_cattle = max(cattle_lookup.values(), default=1) if cattle_lookup else 1

    for h in hotspots:
        cattle_count = cattle_lookup.get(h['id'], h.get('cattlePopulation', 0))
        risk_score, risk_level = score(h.get('caseCount', 0), cattle_count, max_cases, max_cattle)
        h['cattlePopulation'] = cattle_count
        h['riskScore']        = risk_score
        h['riskLevel']        = risk_level

    # Update summary and rewrite
    hotspot_data['metadata']['lastUpdated'] = datetime.now(timezone.utc).isoformat()
    hotspot_data['hotspots'] = hotspots

    out = DATA_DIR / 'hotspots.json'
    with open(out, 'w') as f:
        json.dump(hotspot_data, f, indent=2)

    print(f'[analyze] Scored {len(hotspots)} hotspots → {out}')
    for h in sorted(hotspots, key=lambda x: x.get('riskScore', 0), reverse=True)[:5]:
        print(f"  {h['name']}: cases={h.get('caseCount',0)}, cattle={h.get('cattlePopulation',0):,}, risk={h.get('riskLevel')}")

if __name__ == '__main__':
    main()
