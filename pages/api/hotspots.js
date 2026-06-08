// pages/api/hotspots.js
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Try to load from data directory first
    const dataPath = path.join(process.cwd(), 'public/data/hotspots.json');
    
    let data;
    if (fs.existsSync(dataPath)) {
      const fileContent = fs.readFileSync(dataPath, 'utf-8');
      data = JSON.parse(fileContent);
    } else {
      // Fallback to mock data if file doesn't exist
      data = {
        metadata: {
          lastUpdated: new Date().toISOString(),
          dataSource: 'USDA APHIS - Screwworm Eradication Program',
          jurisdiction: 'United States + Mexico Border Region',
          note: 'Using mock data - ETL pipeline not yet configured'
        },
        summary: {
          totalCases: 156,
          activeCases: 23,
          recoveryRate: 94.2,
          newCases7d: 8,
          trend: 'declining'
        },
        hotspots: [
          {
            id: 'tx-south-padre',
            name: 'South Padre Island, TX',
            lat: 26.1155,
            lng: -97.1670,
            caseCount: 12,
            severity: 'high',
            status: 'containment',
            confirmedDate: '2024-06-01'
          },
          {
            id: 'az-yuma',
            name: 'Yuma County, AZ',
            lat: 32.7157,
            lng: -114.6294,
            caseCount: 5,
            severity: 'medium',
            status: 'investigation',
            confirmedDate: '2024-05-28'
          },
          {
            id: 'nm-hidalgo',
            name: 'Hidalgo County, NM',
            lat: 32.3792,
            lng: -108.7139,
            caseCount: 3,
            severity: 'low',
            status: 'monitoring',
            confirmedDate: '2024-06-03'
          },
          {
            id: 'ca-imperial',
            name: 'Imperial County, CA',
            lat: 32.9088,
            lng: -115.5603,
            caseCount: 2,
            severity: 'low',
            status: 'monitoring',
            confirmedDate: '2024-05-30'
          },
          {
            id: 'fl-miami',
            name: 'Miami-Dade County, FL',
            lat: 25.7617,
            lng: -80.1918,
            caseCount: 1,
            severity: 'low',
            status: 'investigation',
            confirmedDate: '2024-06-02'
          }
        ]
      };
    }

    // Apply time range filter if requested
    const { timeRange } = req.query;
    if (timeRange) {
      data.summary.timeRange = timeRange;
    }

    // Cache for 1 hour on Vercel edge
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error loading hotspot data:', error);
    return res.status(500).json({ 
      error: 'Failed to load hotspot data',
      message: error.message 
    });
  }
}
