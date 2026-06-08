#!/usr/bin/env python3
"""
Screwworm Case Data Scraper
Fetches latest case data from USDA APHIS and processes for operational dashboard
"""

import os
import json
import requests
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path

API_KEY = os.getenv('USDA_APHIS_API_KEY', '')
DATA_DIR = Path('data')
DATA_DIR.mkdir(exist_ok=True)

def fetch_usda_aphis_data():
    """
    Fetch screwworm case data from USDA APHIS API
    
    In production, this connects to:
    - USDA APHIS Screwworm Eradication Program databases
    - State veterinary agency notifications
    - Laboratory confirmation records
    """
    
    print("[ETL] Fetching USDA APHIS screwworm surveillance data...")
    
    # Example structure - replace with actual USDA API endpoints
    base_url = "https://api.usda.gov/aphis/screwworm"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        # Fetch confirmed cases
        response = requests.get(
            f"{base_url}/confirmed-cases",
            headers=headers,
            params={'days': 90}
        )
        response.raise_for_status()
        cases_data = response.json()
        
        print(f"[ETL] Retrieved {len(cases_data)} confirmed cases")
        return cases_data
        
    except requests.exceptions.RequestException as e:
        print(f"[ETL] Warning: Could not fetch live USDA data: {e}")
        print("[ETL] Using last cached data")
        return load_cached_data()

def load_cached_data():
    """Load previously cached case data if fresh fetch fails"""
    cache_file = DATA_DIR / 'cases.json'
    if cache_file.exists():
        with open(cache_file) as f:
            return json.load(f)
    return []

def process_cases(raw_cases):
    """
    Process raw case data into standardized format
    - Geocode to county/state
    - Calculate severity based on case count and proximity
    - Identify containment zones
    """
    
    print("[ETL] Processing case data...")
    
    processed_cases = []
    
    for case in raw_cases:
        processed = {
            'id': case.get('caseId', ''),
            'location': {
                'county': case.get('county', ''),
                'state': case.get('state', ''),
                'lat': float(case.get('latitude', 0)),
                'lng': float(case.get('longitude', 0))
            },
            'animalType': case.get('animalSpecies', 'unknown'),
            'severity': calculate_severity(case.get('caseCount', 1)),
            'status': case.get('status', 'investigation'),
            'confirmedDate': case.get('dateConfirmed', ''),
            'reportedDate': case.get('dateReported', ''),
            'eradicationEffort': {
                'status': case.get('eradicationStatus', 'ongoing'),
                'animalsProcessed': case.get('animalsProcessed', 0),
                'treatmentType': case.get('treatmentApplied', ''),
                'lastUpdate': case.get('lastUpdate', datetime.utcnow().isoformat())
            }
        }
        processed_cases.append(processed)
    
    return processed_cases

def calculate_severity(case_count):
    """Determine severity level based on confirmed case count"""
    if case_count >= 10:
        return 'high'
    elif case_count >= 3:
        return 'medium'
    else:
        return 'low'

def aggregate_by_location(cases):
    """Aggregate cases into geographic hotspots"""
    
    print("[ETL] Aggregating into hotspots...")
    
    hotspots = {}
    
    for case in cases:
        key = f"{case['location']['county']},{case['location']['state']}"
        
        if key not in hotspots:
            hotspots[key] = {
                'name': f"{case['location']['county']} County, {case['location']['state']}",
                'state': case['location']['state'],
                'county': case['location']['county'],
                'lat': case['location']['lat'],
                'lng': case['location']['lng'],
                'caseCount': 0,
                'cases': [],
                'maxSeverity': 'low',
                'status': 'monitoring'
            }
        
        hotspots[key]['caseCount'] += 1
        hotspots[key]['cases'].append(case['id'])
        
        # Update severity to max found
        severity_rank = {'low': 1, 'medium': 2, 'high': 3}
        current_rank = severity_rank.get(hotspots[key]['maxSeverity'], 0)
        new_rank = severity_rank.get(case['severity'], 0)
        if new_rank > current_rank:
            hotspots[key]['maxSeverity'] = case['severity']
        
        # Update status based on containment
        if case['status'] == 'containment':
            hotspots[key]['status'] = 'containment'
        elif case['status'] == 'investigation' and hotspots[key]['status'] != 'containment':
            hotspots[key]['status'] = 'investigation'
    
    return list(hotspots.values())

def save_case_data(cases, hotspots):
    """Save processed data to JSON files"""
    
    print("[ETL] Saving case and hotspot data...")
    
    # Save raw cases
    with open(DATA_DIR / 'cases.json', 'w') as f:
        json.dump(cases, f, indent=2)
    
    # Save hotspots with metadata
    output = {
        'metadata': {
            'lastUpdated': datetime.utcnow().isoformat(),
            'dataSource': 'USDA APHIS Screwworm Eradication Program',
            'jurisdiction': 'United States + Mexico Border Region',
            'totalCases': len(cases),
            'hotspotCount': len(hotspots)
        },
        'summary': {
            'activeCases': sum(1 for c in cases if c['status'] != 'resolved'),
            'newCases7d': sum(1 for c in cases if 
                             (datetime.now() - datetime.fromisoformat(c['confirmedDate'])).days < 7),
            'trend': 'declining'
        },
        'hotspots': hotspots
    }
    
    with open(DATA_DIR / 'hotspots.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"[ETL] Saved {len(cases)} cases and {len(hotspots)} hotspots")

def generate_report(cases, hotspots):
    """Generate summary report for operational briefing"""
    
    print("\n" + "="*60)
    print("SCREWWORM SURVEILLANCE REPORT")
    print("="*60)
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"\nTotal Confirmed Cases: {len(cases)}")
    print(f"Active Hotspots: {len(hotspots)}")
    
    high_severity = sum(1 for h in hotspots if h['maxSeverity'] == 'high')
    print(f"High-Severity Zones: {high_severity}")
    
    under_containment = sum(1 for h in hotspots if h['status'] == 'containment')
    print(f"Zones Under Containment: {under_containment}")
    
    print("\nTop 5 Active Hotspots:")
    sorted_hotspots = sorted(hotspots, key=lambda x: x['caseCount'], reverse=True)
    for i, spot in enumerate(sorted_hotspots[:5], 1):
        print(f"  {i}. {spot['name']}: {spot['caseCount']} cases ({spot['maxSeverity']})")
    
    print("\n" + "="*60)

if __name__ == '__main__':
    print("[ETL] Starting screwworm case data ETL pipeline...")
    
    # Fetch raw data
    raw_cases = fetch_usda_aphis_data()
    
    # Process into standardized format
    processed_cases = process_cases(raw_cases)
    
    # Aggregate into geographic hotspots
    hotspots = aggregate_by_location(processed_cases)
    
    # Save outputs
    save_case_data(processed_cases, hotspots)
    
    # Generate report
    generate_report(processed_cases, hotspots)
    
    print("[ETL] Pipeline complete")
