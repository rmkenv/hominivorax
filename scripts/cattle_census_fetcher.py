#!/usr/bin/env python3
"""
USDA NASS Cattle Census Data Fetcher
Retrieves county-level cattle inventory from NASS QuickStats API
"""

import os
import json
import requests
from datetime import datetime
from pathlib import Path

# NASS QuickStats API endpoint
NASS_API_URL = "https://quickstats.nass.usda.gov/api/api_GET"
NASS_API_KEY = os.getenv('NASS_QUICKSTATS_API_KEY', '')

DATA_DIR = Path('data')
DATA_DIR.mkdir(exist_ok=True)

def fetch_cattle_inventory_by_county():
    """
    Fetch cattle inventory data from NASS QuickStats API
    
    Data retrieved:
    - Total cattle inventory (head)
    - Dairy cows
    - Feedlot cattle
    - Grazing cattle
    - At county level for border states
    """
    
    print("[ETL] Fetching USDA NASS cattle census data...")
    
    # Border states with high screwworm risk
    target_states = ['TX', 'AZ', 'NM', 'CA', 'FL']
    
    # NASS commodities to fetch
    commodities = {
        'total': 'CATTLE, INCL CALVES - INVENTORY',
        'dairy': 'COWS, DAIRY - INVENTORY',
        'feedlot': 'CATTLE, FEEDLOT - INVENTORY',
        'beef': 'CATTLE, BEEF, BREEDING - INVENTORY'
    }
    
    all_counties_data = {}
    
    try:
        for state in target_states:
            print(f"[ETL] Fetching cattle data for {state}...")
            
            # Query parameters for NASS API
            params = {
                'key': NASS_API_KEY,
                'commodity_desc': 'CATTLE',
                'state_alpha': state,
                'geographic_level': 'COUNTY',
                'year__GE': 2022,  # Recent data
                'agg_level_desc': 'COUNTY',
                'format': 'JSON'
            }
            
            try:
                response = requests.get(NASS_API_URL, params=params, timeout=30)
                response.raise_for_status()
                data = response.json()
                
                if 'data' in data:
                    for record in data['data']:
                        county_fips = record.get('county_code', '')
                        county_name = record.get('county_name', '')
                        value = record.get('Value', '0').replace(',', '')
                        
                        try:
                            value = int(value)
                        except ValueError:
                            value = 0
                        
                        key = f"{state}-{county_name}".lower()
                        
                        if key not in all_counties_data:
                            all_counties_data[key] = {
                                'state': state,
                                'county': county_name,
                                'county_code': county_fips,
                                'total': 0,
                                'dairy': 0,
                                'feedlot': 0,
                                'grazing': 0
                            }
                        
                        # Map data types
                        commodity = record.get('commodity_desc', '')
                        if 'CATTLE' in commodity and 'DAIRY' not in commodity and 'FEEDLOT' not in commodity:
                            all_counties_data[key]['total'] = value
                        elif 'DAIRY' in commodity:
                            all_counties_data[key]['dairy'] = value
                        elif 'FEEDLOT' in commodity:
                            all_counties_data[key]['feedlot'] = value
                        elif 'BEEF' in commodity or 'GRAZING' in commodity:
                            all_counties_data[key]['grazing'] = value
                
                print(f"[ETL] Retrieved {len(data.get('data', []))} records for {state}")
                
            except requests.exceptions.RequestException as e:
                print(f"[ETL] Warning: Could not fetch {state} data: {e}")
                continue
        
        return all_counties_data
        
    except Exception as e:
        print(f"[ETL] Error fetching cattle data: {e}")
        return None

def geocode_counties(counties_data):
    """
    Add geocoordinates to county data
    Uses county-to-coordinates mapping for mapping visualization
    """
    
    print("[ETL] Geocoding county centroids...")
    
    # County centroid coordinates (sample - in production, use full FIPS-to-coords mapping)
    county_coords = {
        'TX-Willacy': {'lat': 26.2234, 'lng': -97.5200},
        'TX-Cameron': {'lat': 26.0500, 'lng': -97.1800},
        'TX-Hidalgo': {'lat': 26.1252, 'lng': -97.6437},
        'AZ-Yuma': {'lat': 32.7157, 'lng': -114.6294},
        'NM-Luna': {'lat': 32.3792, 'lng': -108.7139},
        'NM-Hidalgo': {'lat': 32.3792, 'lng': -108.7139},
        'CA-Imperial': {'lat': 32.9088, 'lng': -115.5603},
        'FL-Miami-Dade': {'lat': 25.7617, 'lng': -80.1918},
    }
    
    geocoded = {}
    
    for key, data in counties_data.items():
        state = data['state']
        county = data['county']
        full_key = f"{state}-{county}"
        
        coords = county_coords.get(full_key, {'lat': 0, 'lng': 0})
        
        geocoded[key] = {
            **data,
            'lat': coords['lat'],
            'lng': coords['lng'],
            'density': calculate_density(data.get('total', 0))
        }
    
    return geocoded

def calculate_density(cattle_count):
    """Categorize cattle density"""
    if cattle_count > 100000:
        return 'very-high'
    elif cattle_count > 50000:
        return 'high'
    elif cattle_count > 10000:
        return 'medium'
    elif cattle_count > 0:
        return 'low'
    else:
        return 'none'

def merge_with_screwworm_data():
    """
    Load screwworm case data and merge with cattle census data
    Returns combined risk assessment
    """
    
    print("[ETL] Merging screwworm cases with cattle data...")
    
    try:
        with open(DATA_DIR / 'hotspots.json') as f:
            cases = json.load(f)
    except FileNotFoundError:
        print("[ETL] Warning: hotspots.json not found")
        return None
    
    # Risk calculation: (cases/max_cases) * 0.6 + (cattle/max_cattle) * 0.4
    max_cases = max(h.get('caseCount', 0) for h in cases.get('hotspots', []))
    
    enriched_hotspots = []
    
    for hotspot in cases.get('hotspots', []):
        state = hotspot.get('state', '')
        county = hotspot.get('name', '').split(',')[0]
        
        cattle_key = f"{state}-{county}".lower()
        
        # Find matching cattle data
        cattle_population = 0
        cattle_breakdown = {'dairy': 0, 'feedlot': 0, 'grazing': 0}
        
        # This would be replaced with actual lookup
        # cattle_data = cattle_by_county.get(cattle_key, {})
        # cattle_population = cattle_data.get('total', 0)
        
        case_count = hotspot.get('caseCount', 0)
        cattle_norm = cattle_population / 125000 if cattle_population > 0 else 0
        case_norm = case_count / max_cases if max_cases > 0 else 0
        
        risk_score = (case_norm * 0.6) + (cattle_norm * 0.4)
        
        enriched = {
            **hotspot,
            'cattlePopulation': cattle_population,
            'cattleBreakdown': cattle_breakdown,
            'riskScore': risk_score,
            'riskLevel': 'critical' if risk_score > 0.7 else 'high' if risk_score > 0.5 else 'moderate'
        }
        
        enriched_hotspots.append(enriched)
    
    return enriched_hotspots

def save_cattle_data(geocoded_counties):
    """Save processed cattle census data to JSON"""
    
    print("[ETL] Saving cattle census data...")
    
    output = {
        'metadata': {
            'source': 'USDA NASS - National Agricultural Statistics Service',
            'year': 2023,
            'unit': 'head of cattle per county',
            'lastUpdated': datetime.utcnow().isoformat(),
            'dataUrl': 'https://quickstats.nass.usda.gov/'
        },
        'summary': {
            'totalCounties': len(geocoded_counties),
            'states': list(set(c['state'] for c in geocoded_counties.values())),
            'totalCattle': sum(c.get('total', 0) for c in geocoded_counties.values())
        },
        'counties': list(geocoded_counties.values())
    }
    
    with open(DATA_DIR / 'cattle-census.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"[ETL] Saved cattle data for {len(geocoded_counties)} counties")

def generate_cattle_report(cattle_data):
    """Generate summary report of cattle census"""
    
    print("\n" + "="*60)
    print("USDA CATTLE CENSUS REPORT")
    print("="*60)
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"\nTotal Counties: {len(cattle_data)}")
    
    total_cattle = sum(c.get('total', 0) for c in cattle_data.values())
    print(f"Total Cattle Head: {total_cattle:,}")
    
    by_state = {}
    for county in cattle_data.values():
        state = county['state']
        if state not in by_state:
            by_state[state] = 0
        by_state[state] += county.get('total', 0)
    
    print("\nCattle by State:")
    for state, count in sorted(by_state.items(), key=lambda x: x[1], reverse=True):
        print(f"  {state}: {count:,}")
    
    print("\n" + "="*60)

if __name__ == '__main__':
    print("[ETL] Starting USDA cattle census ETL pipeline...")
    
    # Fetch raw data from NASS
    raw_cattle_data = fetch_cattle_inventory_by_county()
    
    if raw_cattle_data:
        # Geocode counties
        geocoded_counties = geocode_counties(raw_cattle_data)
        
        # Save to file
        save_cattle_data(geocoded_counties)
        
        # Generate report
        generate_cattle_report(geocoded_counties)
        
        # Merge with screwworm data (optional)
        # enriched_hotspots = merge_with_screwworm_data()
    else:
        print("[ETL] Failed to fetch cattle data")
    
    print("[ETL] Pipeline complete")
