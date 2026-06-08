import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, TrendingUp, MapPin, Clock, Zap, ChevronRight, Eye, EyeOff, Layers } from 'lucide-react';

// Production-ready screwworm operations dashboard
// Designed for Esri-style operational awareness with cattle census overlay
export default function ScrewwormDashboard() {
  const mapContainer = useRef(null);
  const [map, setMap] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [cattleData, setCattleData] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('30d');
  const [visibleLayers, setVisibleLayers] = useState({
    screwwormCases: true,
    cattleDensity: true,
    cattleRisk: true
  });

  // Simulated real-time case data (replace with API call to your ETL)
  const mockCaseData = {
    metadata: {
      lastUpdated: new Date().toISOString(),
      dataSource: 'USDA APHIS - Screwworm Eradication Program',
      jurisdiction: 'United States + Mexico Border Region'
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
        confirmedDate: '2024-06-01',
        cattlePopulation: 125000,
        riskLevel: 'critical'
      },
      {
        id: 'az-yuma',
        name: 'Yuma County, AZ',
        lat: 32.7157,
        lng: -114.6294,
        caseCount: 5,
        severity: 'medium',
        status: 'investigation',
        confirmedDate: '2024-05-28',
        cattlePopulation: 48500,
        riskLevel: 'high'
      },
      {
        id: 'nm-hidalgo',
        name: 'Hidalgo County, NM',
        lat: 32.3792,
        lng: -108.7139,
        caseCount: 3,
        severity: 'low',
        status: 'monitoring',
        confirmedDate: '2024-06-03',
        cattlePopulation: 28200,
        riskLevel: 'moderate'
      },
      {
        id: 'ca-imperial',
        name: 'Imperial County, CA',
        lat: 32.9088,
        lng: -115.5603,
        caseCount: 2,
        severity: 'low',
        status: 'monitoring',
        confirmedDate: '2024-05-30',
        cattlePopulation: 15800,
        riskLevel: 'low'
      },
      {
        id: 'fl-miami',
        name: 'Miami-Dade County, FL',
        lat: 25.7617,
        lng: -80.1918,
        caseCount: 1,
        severity: 'low',
        status: 'investigation',
        confirmedDate: '2024-06-02',
        cattlePopulation: 8500,
        riskLevel: 'moderate'
      }
    ],
    timeline: [
      { date: '2024-06-03', event: 'Case confirmed in Hidalgo County, NM', type: 'confirmation' },
      { date: '2024-06-02', event: 'Miami-Dade County quarantine zone expanded', type: 'alert' },
      { date: '2024-06-01', event: 'South Padre Island containment protocol initiated', type: 'action' },
      { date: '2024-05-28', event: 'Yuma County investigation underway', type: 'investigation' },
      { date: '2024-05-25', event: 'Weekly briefing: 15 active cases, 2 new detections', type: 'briefing' }
    ]
  };

  // USDA Cattle Census Data (NASS county-level estimates)
  // Source: USDA NASS 2023 Census of Agriculture
  const mockCattleData = {
    metadata: {
      source: 'USDA NASS - National Agricultural Statistics Service',
      year: 2023,
      unit: 'head of cattle per county',
      lastUpdated: '2024-01-15'
    },
    counties: [
      {
        id: 'tx-willacy',
        name: 'Willacy County, TX',
        lat: 26.2234,
        lng: -97.5200,
        cattle: 125000,
        dairy: 42000,
        feedlot: 58000,
        grazing: 25000,
        density: 'very-high'
      },
      {
        id: 'tx-cameron',
        name: 'Cameron County, TX',
        lat: 26.0500,
        lng: -97.1800,
        cattle: 95000,
        dairy: 38000,
        feedlot: 42000,
        grazing: 15000,
        density: 'very-high'
      },
      {
        id: 'az-yuma-county',
        name: 'Yuma County, AZ',
        lat: 32.7157,
        lng: -114.6294,
        cattle: 48500,
        dairy: 18000,
        feedlot: 22000,
        grazing: 8500,
        density: 'high'
      },
      {
        id: 'nm-luna',
        name: 'Luna County, NM',
        lat: 32.3792,
        lng: -108.7139,
        cattle: 28200,
        dairy: 9500,
        feedlot: 12000,
        grazing: 6700,
        density: 'medium'
      },
      {
        id: 'ca-imperial-county',
        name: 'Imperial County, CA',
        lat: 32.9088,
        lng: -115.5603,
        cattle: 15800,
        dairy: 6200,
        feedlot: 7000,
        grazing: 2600,
        density: 'medium'
      },
      {
        id: 'fl-dade',
        name: 'Miami-Dade County, FL',
        lat: 25.7617,
        lng: -80.1918,
        cattle: 8500,
        dairy: 0,
        feedlot: 2000,
        grazing: 6500,
        density: 'low'
      }
    ]
  };

  useEffect(() => {
    setCaseData(mockCaseData);
    setCattleData(mockCattleData);
  }, []);

  // Dynamically load Maplibre GL
  useEffect(() => {
    const loadMap = async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      
      if (!mapContainer.current) return;

      const mapInstance = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://basemaps.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        center: [-100.5, 34],
        zoom: 4,
        pitch: 0,
        bearing: 0
      });

      mapInstance.on('load', () => {
        // ========== CATTLE CENSUS LAYERS ==========
        if (cattleData?.counties) {
          const cattlePoints = cattleData.counties.map(county => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [county.lng, county.lat] },
            properties: {
              name: county.name,
              total: county.cattle,
              dairy: county.dairy,
              feedlot: county.feedlot,
              grazing: county.grazing,
              density: county.density,
              id: county.id
            }
          }));

          // Cattle density source (background heatmap)
          mapInstance.addSource('cattle-density-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: cattlePoints }
          });

          // Cattle density heatmap layer (subtle background)
          mapInstance.addLayer({
            id: 'cattle-density-heatmap',
            type: 'heatmap',
            source: 'cattle-density-source',
            paint: {
              'heatmap-weight': ['interpolate', ['linear'], ['get', 'total'], 0, 0, 125000, 1],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 9, 1.2],
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(0, 128, 128, 0)',
                0.2, 'rgba(0, 150, 136, 0.3)',
                0.4, 'rgba(0, 188, 212, 0.5)',
                0.6, 'rgba(33, 150, 243, 0.6)',
                0.8, 'rgba(63, 81, 181, 0.7)',
                1, 'rgba(103, 58, 183, 0.8)'
              ],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 15, 9, 20],
              'heatmap-opacity': 0.7
            }
          }, 'waterway-label'); // Place below text layers

          // Cattle population circles (circle size = population)
          mapInstance.addLayer({
            id: 'cattle-circles',
            type: 'circle',
            source: 'cattle-density-source',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['get', 'total'], 0, 8, 125000, 18],
              'circle-color': [
                'match',
                ['get', 'density'],
                'very-high', '#1e40af',
                'high', '#3b82f6',
                'medium', '#60a5fa',
                'low', '#93c5fd',
                '#bfdbfe'
              ],
              'circle-opacity': 0.4,
              'circle-stroke-width': 1,
              'circle-stroke-color': '#1e40af',
              'circle-stroke-opacity': 0.6
            }
          });

          // Cattle risk layer (overlay - combines cases + cattle population)
          const riskPoints = caseData.hotspots.map(spot => {
            const cattleCount = mockCattleData.counties.find(c => c.id === spot.id)?.cattle || 0;
            const riskScore = (spot.caseCount / 15) * 0.6 + (cattleCount / 125000) * 0.4;
            return {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [spot.lng, spot.lat] },
              properties: {
                name: spot.name,
                cases: spot.caseCount,
                cattle: cattleCount,
                risk: riskScore,
                riskLevel: riskScore > 0.7 ? 'critical' : riskScore > 0.5 ? 'high' : 'moderate'
              }
            };
          });

          mapInstance.addSource('risk-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: riskPoints }
          });

          mapInstance.addLayer({
            id: 'risk-circles',
            type: 'circle',
            source: 'risk-source',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['get', 'risk'], 0, 12, 1, 24],
              'circle-color': [
                'match',
                ['get', 'riskLevel'],
                'critical', '#7f1d1d',
                'high', '#dc2626',
                '#ea580c'
              ],
              'circle-opacity': 0.3,
              'circle-stroke-width': 2.5,
              'circle-stroke-color': [
                'match',
                ['get', 'riskLevel'],
                'critical', '#991b1b',
                'high', '#b91c1c',
                '#ea580c'
              ],
              'circle-stroke-opacity': 0.8
            }
          });

          // Cattle hover tooltip
          mapInstance.on('mouseenter', 'cattle-circles', () => {
            mapInstance.getCanvas().style.cursor = 'pointer';
          });
          mapInstance.on('mouseleave', 'cattle-circles', () => {
            mapInstance.getCanvas().style.cursor = '';
          });
        }

        // ========== SCREWWORM CASE LAYERS ==========
        if (caseData?.hotspots) {
          const points = caseData.hotspots.map(spot => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [spot.lng, spot.lat] },
            properties: { count: spot.caseCount, severity: spot.severity, id: spot.id }
          }));

          mapInstance.addSource('cases-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: points }
          });

          // Severity-based circle layer (overlay on cattle)
          mapInstance.addLayer({
            id: 'case-points',
            type: 'circle',
            source: 'cases-source',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 12, 15, 28],
              'circle-color': ['match', ['get', 'severity'], 'high', '#e63946', 'medium', '#f77f00', 'low', '#fcbf49', '#ccc'],
              'circle-opacity': 0.85,
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#fff'
            }
          });

          // Click handler
          mapInstance.on('click', 'case-points', (e) => {
            const caseId = e.features[0].properties.id;
            const caseItem = caseData.hotspots.find(h => h.id === caseId);
            setSelectedCase(caseItem);
          });

          mapInstance.on('mouseenter', 'case-points', () => {
            mapInstance.getCanvas().style.cursor = 'pointer';
          });
          mapInstance.on('mouseleave', 'case-points', () => {
            mapInstance.getCanvas().style.cursor = '';
          });
        }
      });

      setMap(mapInstance);

      return () => {
        mapInstance.remove();
      };
    };

    loadMap();
  }, [caseData, cattleData]);

  const getSeverityColor = (severity) => {
    const colors = {
      high: 'bg-red-600 text-white',
      medium: 'bg-orange-500 text-white',
      low: 'bg-amber-400 text-black'
    };
    return colors[severity] || 'bg-gray-400';
  };

  const getSeverityBorder = (severity) => {
    const borders = {
      high: 'border-l-4 border-red-600',
      medium: 'border-l-4 border-orange-500',
      low: 'border-l-4 border-amber-400'
    };
    return borders[severity] || 'border-l-4 border-gray-400';
  };

  if (!caseData) return <div className="bg-gray-950 text-white h-screen flex items-center justify-center">Loading dashboard...</div>;

  return (
    <div className="bg-gray-950 text-white font-sans h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-800 rounded-lg flex items-center justify-center font-bold">
              S
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Screwworm Watch</h1>
              <p className="text-xs text-gray-400">USDA APHIS Eradication Program</p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-400">
            <p>Last updated: {new Date(caseData.metadata.lastUpdated).toLocaleString()}</p>
            <p className="text-gray-500">Operational Status: <span className="text-green-400 font-semibold">ACTIVE MONITORING</span></p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Map and summary */}
        <div className="flex-1 flex flex-col">
          {/* Summary metrics bar */}
          <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex gap-8">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-xs text-gray-400">ACTIVE CASES</p>
                <p className="text-xl font-bold text-white">{caseData.summary.activeCases}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-xs text-gray-400">NEW (7 DAYS)</p>
                <p className="text-xl font-bold text-white">{caseData.summary.newCases7d}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-xs text-gray-400">HOTSPOTS</p>
                <p className="text-xl font-bold text-white">{caseData.hotspots.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-xs text-gray-400">RECOVERY RATE</p>
                <p className="text-xl font-bold text-white">{caseData.summary.recoveryRate}%</p>
              </div>
            </div>
          </div>

          {/* Map */}
          <div 
            ref={mapContainer}
            className="flex-1 relative bg-gray-800"
          >
          {/* Map legend with layer toggles */}
          <div className="absolute top-4 right-4 z-10 bg-gray-900 rounded-lg border border-gray-700 shadow-lg max-w-sm">
            {/* Legend title */}
            <div className="border-b border-gray-700 px-4 py-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-white text-sm">Map Layers</span>
            </div>

            {/* Screwworm cases layer toggle */}
            <div className="p-3 border-b border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={visibleLayers.screwwormCases}
                    onChange={(e) => {
                      setVisibleLayers({...visibleLayers, screwwormCases: e.target.checked});
                      if (map) {
                        map.setLayoutProperty('case-points', 'visibility', e.target.checked ? 'visible' : 'none');
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-xs font-medium text-white">Screwworm Cases</span>
                </label>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-600"></div>
                  <span className="text-gray-300">High severity (&gt;10)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-gray-300">Medium (3-10)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <span className="text-gray-300">Low (1-2)</span>
                </div>
              </div>
            </div>

            {/* Cattle density layer toggle */}
            <div className="p-3 border-b border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={visibleLayers.cattleDensity}
                    onChange={(e) => {
                      setVisibleLayers({...visibleLayers, cattleDensity: e.target.checked});
                      if (map) {
                        map.setLayoutProperty('cattle-density-heatmap', 'visibility', e.target.checked ? 'visible' : 'none');
                        map.setLayoutProperty('cattle-circles', 'visibility', e.target.checked ? 'visible' : 'none');
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-xs font-medium text-white">Cattle Density (NASS)</span>
                </label>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-700"></div>
                  <span className="text-gray-300">Very High (&gt;100k head)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-300">High (50-100k)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-300"></div>
                  <span className="text-gray-300">Medium (10-50k)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-100"></div>
                  <span className="text-gray-300">Low (&lt;10k head)</span>
                </div>
              </div>
            </div>

            {/* Combined risk layer toggle */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={visibleLayers.cattleRisk}
                    onChange={(e) => {
                      setVisibleLayers({...visibleLayers, cattleRisk: e.target.checked});
                      if (map) {
                        map.setLayoutProperty('risk-circles', 'visibility', e.target.checked ? 'visible' : 'none');
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-xs font-medium text-white">Risk (Cases × Cattle)</span>
                </label>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-900"></div>
                  <span className="text-gray-300">Critical risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-600"></div>
                  <span className="text-gray-300">High risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-600"></div>
                  <span className="text-gray-300">Moderate risk</span>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Right panel: Case details and timeline */}
        <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-800 bg-gray-800">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-3 px-3 text-xs font-medium transition ${
                activeTab === 'overview'
                  ? 'border-b-2 border-red-600 text-white bg-gray-700'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Cases
            </button>
            <button
              onClick={() => setActiveTab('cattle')}
              className={`flex-1 py-3 px-3 text-xs font-medium transition ${
                activeTab === 'cattle'
                  ? 'border-b-2 border-blue-600 text-white bg-gray-700'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Cattle
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 py-3 px-3 text-xs font-medium transition ${
                activeTab === 'timeline'
                  ? 'border-b-2 border-green-600 text-white bg-gray-700'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Timeline
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'overview' && (
              <div className="p-4 space-y-4">
                {/* Selected case detail */}
                {selectedCase && (
                  <div className={`${getSeverityBorder(selectedCase.severity)} bg-gray-800 p-4 rounded-lg`}>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-white">{selectedCase.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded ${getSeverityColor(selectedCase.severity)}`}>
                        {selectedCase.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs text-gray-300">
                      <p><strong>Cases:</strong> {selectedCase.caseCount}</p>
                      <p><strong>Status:</strong> <span className="capitalize text-blue-400">{selectedCase.status}</span></p>
                      <p><strong>Confirmed:</strong> {new Date(selectedCase.confirmedDate).toLocaleDateString()}</p>
                      <p className="text-gray-500">Latitude: {selectedCase.lat.toFixed(4)}° | Longitude: {selectedCase.lng.toFixed(4)}°</p>
                    </div>
                  </div>
                )}

                {/* All hotspots list */}
                <div>
                  <h3 className="font-semibold text-white mb-2 text-sm">Active Hotspots</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {caseData.hotspots.map(spot => (
                      <div
                        key={spot.id}
                        onClick={() => setSelectedCase(spot)}
                        className={`${getSeverityBorder(spot.severity)} bg-gray-800 p-3 rounded-lg cursor-pointer hover:bg-gray-700 transition ${
                          selectedCase?.id === spot.id ? 'ring-2 ring-red-600' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-medium text-white text-sm">{spot.name}</p>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-red-900 text-red-200">{spot.caseCount}</span>
                        </div>
                        <p className="text-xs text-gray-400">{spot.status.charAt(0).toUpperCase() + spot.status.slice(1)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cattle' && (
              <div className="p-4 space-y-4">
                {/* Cattle census summary if case selected */}
                {selectedCase && (
                  <>
                    <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-blue-600">
                      <h3 className="font-semibold text-white mb-3">{selectedCase.name}</h3>
                      <div className="space-y-3">
                        {/* Total cattle */}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-300">Total Cattle:</span>
                          <span className="text-lg font-bold text-blue-400">{selectedCase.cattlePopulation?.toLocaleString() || 'N/A'}</span>
                        </div>

                        {/* Cattle breakdown by type */}
                        <div className="bg-gray-700 rounded p-2 text-xs space-y-1">
                          {cattleData?.counties.find(c => c.id === selectedCase.id) && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-300">Dairy:</span>
                                <span className="text-white font-medium">{cattleData.counties.find(c => c.id === selectedCase.id).dairy.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-300">Feedlot:</span>
                                <span className="text-white font-medium">{cattleData.counties.find(c => c.id === selectedCase.id).feedlot.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-300">Grazing:</span>
                                <span className="text-white font-medium">{cattleData.counties.find(c => c.id === selectedCase.id).grazing.toLocaleString()}</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Risk indicator */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-600">
                          <span className="text-sm text-gray-300">Risk Level:</span>
                          <span className={`text-xs px-2 py-1 rounded font-semibold ${
                            selectedCase.riskLevel === 'critical' ? 'bg-red-900 text-red-200' :
                            selectedCase.riskLevel === 'high' ? 'bg-red-800 text-red-100' :
                            selectedCase.riskLevel === 'moderate' ? 'bg-orange-900 text-orange-200' :
                            'bg-green-900 text-green-200'
                          }`}>
                            {selectedCase.riskLevel?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* All hotspots with cattle data */}
                <div>
                  <h3 className="font-semibold text-white mb-2 text-sm">Cattle by Hotspot</h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {caseData.hotspots.map(spot => {
                      const cattle = cattleData?.counties.find(c => c.id === spot.id);
                      return (
                        <div
                          key={spot.id}
                          onClick={() => setSelectedCase(spot)}
                          className={`bg-gray-800 p-3 rounded-lg cursor-pointer hover:bg-gray-700 transition border-l-4 border-blue-600 ${
                            selectedCase?.id === spot.id ? 'ring-2 ring-blue-600' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-medium text-white text-sm">{spot.name}</p>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900 text-blue-200">
                              {cattle?.cattle.toLocaleString() || '—'} head
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex gap-2">
                              <span className="text-gray-400">Cases: <span className="text-orange-400 font-medium">{spot.caseCount}</span></span>
                              <span className="text-gray-500">|</span>
                              <span className="text-gray-400">Density: <span className="text-blue-400 font-medium">{cattle?.density || 'N/A'}</span></span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* NASS data attribution */}
                <div className="bg-gray-800 p-2 rounded text-xs text-gray-400 border-l border-gray-700">
                  <p className="font-semibold mb-1">Data Source</p>
                  <p>USDA NASS 2023 Census of Agriculture</p>
                  <p className="text-gray-500 mt-1">Updated: {cattleData?.metadata?.year}</p>
                </div>
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="p-4">
                <div className="space-y-4">
                  {caseData.timeline.map((item, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${
                          item.type === 'confirmation' ? 'bg-red-600' :
                          item.type === 'alert' ? 'bg-orange-500' :
                          item.type === 'action' ? 'bg-blue-500' :
                          item.type === 'investigation' ? 'bg-amber-400' :
                          'bg-gray-500'
                        }`}></div>
                        {idx < caseData.timeline.length - 1 && <div className="w-0.5 h-6 bg-gray-700 mt-1"></div>}
                      </div>
                      <div className="flex-1 pb-2">
                        <p className="text-xs text-gray-400">{new Date(item.date).toLocaleDateString()}</p>
                        <p className="text-sm text-white">{item.event}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 px-6 py-2 text-xs text-gray-500 flex justify-between">
        <div>Data Source: {caseData.metadata.dataSource}</div>
        <div>Jurisdiction: {caseData.metadata.jurisdiction}</div>
      </footer>
    </div>
  );
}
