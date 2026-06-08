// pages/api/cattle.js
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // CORS headers
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
    // Try to load cattle census data
    const dataPath = path.join(process.cwd(), 'public/data/cattle-census.json');
    
    let data;
    if (fs.existsSync(dataPath)) {
      const fileContent = fs.readFileSync(dataPath, 'utf-8');
      data = JSON.parse(fileContent);
    } else {
      // Fallback to mock data
      data = {
        metadata: {
          source: 'USDA NASS - National Agricultural Statistics Service',
          year: 2023,
          unit: 'head of cattle per county',
          lastUpdated: new Date().toISOString(),
          dataUrl: 'https://quickstats.nass.usda.gov/',
          note: 'Using mock data - ETL pipeline not yet configured'
        },
        summary: {
          totalCounties: 6,
          states: ['TX', 'AZ', 'NM', 'CA', 'FL'],
          totalCattle: 324000
        },
        counties: [
          {
            state: 'TX',
            county: 'Willacy',
            cattle: 125000,
            dairy: 42000,
            feedlot: 58000,
            grazing: 25000,
            density: 'very-high',
            lat: 26.2234,
            lng: -97.5200
          },
          {
            state: 'TX',
            county: 'Cameron',
            cattle: 95000,
            dairy: 38000,
            feedlot: 42000,
            grazing: 15000,
            density: 'very-high',
            lat: 26.0500,
            lng: -97.1800
          },
          {
            state: 'AZ',
            county: 'Yuma',
            cattle: 48500,
            dairy: 18000,
            feedlot: 22000,
            grazing: 8500,
            density: 'high',
            lat: 32.7157,
            lng: -114.6294
          },
          {
            state: 'NM',
            county: 'Luna',
            cattle: 28200,
            dairy: 9500,
            feedlot: 12000,
            grazing: 6700,
            density: 'medium',
            lat: 32.3792,
            lng: -108.7139
          },
          {
            state: 'CA',
            county: 'Imperial',
            cattle: 15800,
            dairy: 6200,
            feedlot: 7000,
            grazing: 2600,
            density: 'medium',
            lat: 32.9088,
            lng: -115.5603
          },
          {
            state: 'FL',
            county: 'Miami-Dade',
            cattle: 8500,
            dairy: 0,
            feedlot: 2000,
            grazing: 6500,
            density: 'low',
            lat: 25.7617,
            lng: -80.1918
          }
        ]
      };
    }

    // Apply filters if requested
    const { state, density, minCattle } = req.query;
    
    if (state || density || minCattle) {
      data.counties = data.counties.filter(county => {
        if (state && county.state !== state) return false;
        if (density && county.density !== density) return false;
        if (minCattle && county.cattle < parseInt(minCattle)) return false;
        return true;
      });
    }

    // Cache for 24 hours on Vercel edge
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');
    
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error loading cattle census data:', error);
    return res.status(500).json({ 
      error: 'Failed to load cattle census data',
      message: error.message 
    });
  }
}
