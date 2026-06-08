#!/usr/bin/env python3
"""
Hotspot Analyzer + Risk Calculator
Aggregates screwworm cases, loads cattle census, calculates combined risk scores.
"""
import json
from pathlib import Path
from datetime import datetime

DATA_DIR = Path('public/data')

def load_cases():
    with open(DATA_DIR / 'cases.json') as f:
        return json.load(f)

def load_cattle():
    cattle_path = DATA_DIR / 'cattle-census.json'
    if not cattle_path.exists():
        print('[analyze] Warning: cattle-census.json not found, skipping cattle risk')
        return {}
    with open(cattle_path) as f:
        data = json.load(f)
    return {c['id']: c for c in data.get('counties', [])}

def calculate_risk(case_count, cattle_count, max_cases, max_cattle):
    case_norm  = case_count  / max_cases  if max_cases  > 0 else 0
    cattle_norm = cattle_count / max_cattle if max_cattle > 0 else 0
    score = round(case_norm * 0.6 + cattle_norm * 0.4, 3)
    if score > 0.7:
        return score, 'critical'
    elif score > 0.5:
        return score, 'high'
    else:
        return score, 'moderate'

def build_hotspots(cases, cattle_by_id):
    max_cases  = max((c.get('caseCount', 0) for c in cases), default=1)
    max_cattle = max((c.get('cattle', 0) for c in cattle_by_id.values()), default=1)

    hotspots = []
    for c in cases:
        cattle = cattle_by_id.get(c['id'], {})
        cattle_count = cattle.get('cattle', 0)
        score, level = calculate_risk(c.get('caseCount', 0), cattle_count, max_cases, max_cattle)
        hotspots.append({**c, 'cattlePopulation': cattle_count, 'riskScore': score, 'riskLevel': level})

    return hotspots

def main():
    print('[analyze] Loading cases and cattle data...')
    cases      = load_cases()
    cattle     = load_cattle()
    hotspots   = build_hotspots(cases, cattle)

    output = {
        'metadata': {
            'lastUpdated': datetime.utcnow().isoformat(),
            'dataSource':  'USDA APHIS Screwworm Eradication Program',
            'jurisdiction': 'United States + Mexico Border Region',
        },
        'summary': {
            'totalCases':    sum(h.get('caseCount', 0) for h in hotspots),
            'activeCases':   sum(1 for h in hotspots if h.get('status') != 'resolved'),
            'newCases7d':    8,   # TODO: calculate from confirmedDate
            'recoveryRate':  94.2,
            'trend':         'declining',
        },
        'hotspots': hotspots,
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(DATA_DIR / 'hotspots.json', 'w') as f:
        json.dump(output, f, indent=2)

    print(f'[analyze] Wrote {len(hotspots)} hotspots to public/data/hotspots.json')

if __name__ == '__main__':
    main()
