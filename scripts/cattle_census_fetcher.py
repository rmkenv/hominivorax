#!/usr/bin/env python3
"""
USDA NASS Cattle Census ETL
Fetches county-level cattle inventory from NASS QuickStats API.
Geocodes county centroids via Census Bureau TIGER API.
"""
import os, json, time, requests
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path('public/data')
DATA_DIR.mkdir(parents=True, exist_ok=True)

NASS_URL    = 'https://quickstats.nass.usda.gov/api/api_GET'
NASS_KEY    = os.getenv('NASS_QUICKSTATS_API_KEY', '')
TIGER_URL   = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2023/MapServer/86/query'

TARGET_STATES = ['TX', 'AZ', 'NM', 'CA', 'FL']

STATE_FIPS = {'TX': '48', 'AZ': '04', 'NM': '35', 'CA': '06', 'FL': '12'}

def fetch_nass(state):
    params = {
        'key':               NASS_KEY,
        'commodity_desc':    'CATTLE',
        'short_desc':        'CATTLE, INCL CALVES - INVENTORY',
        'domain_desc':       'TOTAL',
        'agg_level_desc':    'COUNTY',
        'state_alpha':       state,
        'year':              2022,
        'format':            'JSON',
    }
    r = requests.get(NASS_URL, params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    if 'error' in data:
        raise ValueError(data['error'])
    return data.get('data', [])

def fetch_centroids(state_fips):
    """Get county centroids from Census TIGER for one state."""
    params = {
        'where':      f"STATE='{state_fips}'",
        'outFields':  'COUNTY,NAME,CENTLAT,CENTLON',
        'f':          'json',
        'resultRecordCount': 200,
    }
    try:
        r = requests.get(TIGER_URL, params=params, timeout=20)
        r.raise_for_status()
        features = r.json().get('features', [])
        return {
            f['attributes']['COUNTY']: {
                'lat': float(f['attributes']['CENTLAT']),
                'lng': float(f['attributes']['CENTLON']),
                'name': f['attributes']['NAME'],
            }
            for f in features
        }
    except Exception as e:
        print(f'[cattle] TIGER geocode failed for {state_fips}: {e}')
        return {}

def density(n):
    if n > 100000: return 'very-high'
    if n >  50000: return 'high'
    if n >  10000: return 'medium'
    if n >      0: return 'low'
    return 'none'

def main():
    print('[cattle] Starting NASS cattle census ETL...')

    if not NASS_KEY:
        print('[cattle] NASS_QUICKSTATS_API_KEY not set — skipping live fetch')
        return

    all_counties = []
    total = 0

    for state in TARGET_STATES:
        print(f'[cattle] Fetching {state}...')
        try:
            records = fetch_nass(state)
        except Exception as e:
            print(f'[cattle] NASS fetch failed for {state}: {e}')
            continue

        # Geocode all counties in this state
        centroids = fetch_centroids(STATE_FIPS[state])
        time.sleep(0.3)  # be polite to Census API

        # Aggregate by county_code
        by_county = {}
        for rec in records:
            fips   = rec.get('county_code', '').zfill(3)
            val    = rec.get('Value', '').replace(',', '').strip()
            if not fips or val in ('', '(D)', '(Z)', '(NA)'):
                continue
            try:
                head = int(val)
            except ValueError:
                continue
            if fips not in by_county:
                geo = centroids.get(fips, {})
                by_county[fips] = {
                    'id':      f"{state.lower()}-{fips}",
                    'state':   state,
                    'county':  rec.get('county_name', '').title(),
                    'fips':    STATE_FIPS[state] + fips,
                    'cattle':  0,
                    'lat':     geo.get('lat', 0),
                    'lng':     geo.get('lng', 0),
                }
            by_county[fips]['cattle'] += head

        state_counties = list(by_county.values())
        max_head = max((c['cattle'] for c in state_counties), default=1)
        for c in state_counties:
            c['density'] = density(c['cattle'])

        state_total = sum(c['cattle'] for c in state_counties)
        total += state_total
        all_counties.extend(state_counties)
        print(f'[cattle]   {state}: {len(state_counties)} counties, {state_total:,} head')

    output = {
        'metadata': {
            'source':      'USDA NASS QuickStats',
            'year':        2022,
            'unit':        'head of cattle per county',
            'lastUpdated': datetime.now(timezone.utc).isoformat(),
            'dataUrl':     'https://quickstats.nass.usda.gov/',
        },
        'summary': {
            'totalCounties': len(all_counties),
            'states':        TARGET_STATES,
            'totalCattle':   total,
        },
        'counties': all_counties,
    }

    out = DATA_DIR / 'cattle-census.json'
    with open(out, 'w') as f:
        json.dump(output, f, indent=2)

    print(f'[cattle] Done — {len(all_counties)} counties, {total:,} total head → {out}')

if __name__ == '__main__':
    main()
