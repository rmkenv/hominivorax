import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, TrendingUp, MapPin, Zap, Layers } from 'lucide-react';

const MAP_STYLE = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm-tiles' }],
};

function severityBorder(s) {
  return s === 'high' ? 'border-l-4 border-red-600' : s === 'medium' ? 'border-l-4 border-orange-500' : 'border-l-4 border-amber-400';
}
function severityBadge(s) {
  return s === 'high' ? 'bg-red-600 text-white' : s === 'medium' ? 'bg-orange-500 text-white' : 'bg-amber-400 text-black';
}

function LoadingScreen() {
  return (
    <div className="bg-gray-950 text-white h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-800 rounded-lg mx-auto flex items-center justify-center font-bold text-xl">S</div>
        <p className="text-gray-400 text-sm">Loading surveillance data...</p>
      </div>
    </div>
  );
}

export default function ScrewwormDashboard() {
  const mapContainer = useRef(null);
  const mapRef       = useRef(null);
  const [caseData,   setCaseData]   = useState(null);
  const [cattleData, setCattleData] = useState(null);
  const [mapReady,   setMapReady]   = useState(false);
  const [selectedCase,  setSelectedCase]  = useState(null);
  const [activeTab,     setActiveTab]     = useState('cases');
  const [layers,        setLayers]        = useState({ cases: true, cattle: true, risk: true });

  // ── Fetch live data from API routes ─────────────────────────────────────────
  useEffect(() => {
    fetch('/api/hotspots')
      .then(r => r.json())
      .then(setCaseData)
      .catch(err => console.error('hotspots load failed:', err));

    fetch('/api/cattle')
      .then(r => r.json())
      .then(setCattleData)
      .catch(err => console.error('cattle load failed:', err));
  }, []);

  // ── Build map once ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!caseData || !cattleData) return;
    let cancelled = false;

    const init = async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !mapContainer.current || mapRef.current) return;

      const m = new maplibregl.Map({
        container: mapContainer.current,
        style: MAP_STYLE,
        center: [-90, 30],
        zoom: 4,
      });

      m.addControl(new maplibregl.NavigationControl(), 'top-left');

      m.on('load', () => {
        if (cancelled) return;

        // ── Cattle heatmap ─────────────────────────────────────────────────
        const counties = cattleData.counties ?? [];
        const cattleFeatures = counties
          .filter(c => c.lat && c.lng)
          .map(c => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
            properties: { total: c.cattle ?? 0, density: c.density, id: c.id },
          }));

        m.addSource('cattle', { type: 'geojson', data: { type: 'FeatureCollection', features: cattleFeatures } });

        m.addLayer({
          id: 'cattle-heat',
          type: 'heatmap',
          source: 'cattle',
          paint: {
            'heatmap-weight':    ['interpolate', ['linear'], ['get', 'total'], 0, 0, 125000, 1],
            'heatmap-intensity': 0.8,
            'heatmap-radius':    40,
            'heatmap-opacity':   0.55,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0,   'rgba(0,0,0,0)',
              0.2, 'rgba(0,150,136,0.4)',
              0.5, 'rgba(33,150,243,0.6)',
              0.8, 'rgba(63,81,181,0.7)',
              1,   'rgba(103,58,183,0.85)',
            ],
          },
        });

        m.addLayer({
          id: 'cattle-circles',
          type: 'circle',
          source: 'cattle',
          paint: {
            'circle-radius':       ['interpolate', ['linear'], ['get', 'total'], 0, 6, 125000, 18],
            'circle-color':        '#1d4ed8',
            'circle-opacity':      0.35,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#3b82f6',
          },
        });

        // ── Risk rings ─────────────────────────────────────────────────────
        const hotspots = caseData.hotspots ?? [];
        const maxCases = Math.max(...hotspots.map(h => h.caseCount ?? 0), 1);
        const maxCattle = Math.max(...counties.map(c => c.cattle ?? 0), 1);

        const riskFeatures = hotspots.map(h => {
          const cattle = counties.find(c => c.id === h.id)?.cattle ?? h.cattlePopulation ?? 0;
          const score  = (h.caseCount / maxCases) * 0.6 + (cattle / maxCattle) * 0.4;
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [h.lng, h.lat] },
            properties: { score, level: score > 0.7 ? 'critical' : score > 0.4 ? 'high' : 'moderate' },
          };
        });

        m.addSource('risk', { type: 'geojson', data: { type: 'FeatureCollection', features: riskFeatures } });

        m.addLayer({
          id: 'risk-rings',
          type: 'circle',
          source: 'risk',
          paint: {
            'circle-radius':         ['interpolate', ['linear'], ['get', 'score'], 0, 14, 1, 30],
            'circle-color':          ['match', ['get', 'level'], 'critical', '#7f1d1d', 'high', '#b91c1c', '#ea580c'],
            'circle-opacity':        0.22,
            'circle-stroke-width':   2,
            'circle-stroke-color':   ['match', ['get', 'level'], 'critical', '#991b1b', 'high', '#dc2626', '#f97316'],
            'circle-stroke-opacity': 0.75,
          },
        });

        // ── Case points ────────────────────────────────────────────────────
        const caseFeatures = hotspots.map(h => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [h.lng, h.lat] },
          properties: { count: h.caseCount, severity: h.severity, id: h.id },
        }));

        m.addSource('cases', { type: 'geojson', data: { type: 'FeatureCollection', features: caseFeatures } });

        m.addLayer({
          id: 'case-points',
          type: 'circle',
          source: 'cases',
          paint: {
            'circle-radius':       ['interpolate', ['linear'], ['get', 'count'], 1, 10, 15, 24],
            'circle-color':        ['match', ['get', 'severity'], 'high', '#e63946', 'medium', '#f77f00', '#fcbf49'],
            'circle-opacity':      0.9,
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#fff',
          },
        });

        m.on('click', 'case-points', e => {
          const id = e.features[0].properties.id;
          setSelectedCase((caseData.hotspots ?? []).find(h => h.id === id) ?? null);
          setActiveTab('cases');
        });
        m.on('mouseenter', 'case-points', () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', 'case-points', () => { m.getCanvas().style.cursor = ''; });

        mapRef.current = m;
        setMapReady(true);
      });
    };

    init();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [caseData, cattleData]);

  // ── Sync layer visibility ────────────────────────────────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !mapReady) return;
    const vis = v => v ? 'visible' : 'none';
    m.setLayoutProperty('case-points',    'visibility', vis(layers.cases));
    m.setLayoutProperty('cattle-heat',    'visibility', vis(layers.cattle));
    m.setLayoutProperty('cattle-circles', 'visibility', vis(layers.cattle));
    m.setLayoutProperty('risk-rings',     'visibility', vis(layers.risk));
  }, [layers, mapReady]);

  const toggle = key => setLayers(prev => ({ ...prev, [key]: !prev[key] }));

  if (!caseData || !cattleData) return <LoadingScreen />;

  const hotspots = caseData.hotspots ?? [];
  const counties = cattleData.counties ?? [];
  const summary  = caseData.summary ?? {};
  const timeline = caseData.timeline ?? [];
  const meta     = caseData.metadata ?? {};

  return (
    <div className="bg-gray-950 text-white font-sans h-screen flex flex-col">

      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-red-600 to-red-800 rounded-lg flex items-center justify-center font-bold text-lg">S</div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Screwworm Watch</h1>
            <p className="text-xs text-gray-400">USDA APHIS Eradication Program</p>
          </div>
        </div>
        <div className="text-right text-xs text-gray-400">
          <p>Updated: {new Date(meta.lastUpdated).toLocaleString()}</p>
          <p className="text-green-400 font-semibold mt-0.5">● ACTIVE MONITORING</p>
        </div>
      </header>

      {/* KPI bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-2 flex gap-8 shrink-0">
        {[
          { icon: <AlertCircle className="w-4 h-4 text-red-500" />,   label: 'ACTIVE CASES', value: summary.activeCases  ?? 0 },
          { icon: <TrendingUp  className="w-4 h-4 text-amber-400" />, label: 'NEW (7 DAYS)',  value: summary.newCases7d   ?? 0 },
          { icon: <MapPin      className="w-4 h-4 text-blue-400"  />, label: 'HOTSPOTS',     value: hotspots.length          },
          { icon: <Zap         className="w-4 h-4 text-green-400" />, label: 'COUNTIES',     value: counties.length          },
        ].map(({ icon, label, value }) => (
          <div key={label} className="flex items-center gap-2">
            {icon}
            <div>
              <p className="text-xs text-gray-400 leading-none">{label}</p>
              <p className="text-xl font-bold leading-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapContainer} className="absolute inset-0" />

          {/* Legend */}
          <div className="absolute top-3 right-3 z-10 bg-gray-900/95 border border-gray-700 rounded-lg shadow-xl w-52 text-xs">
            <div className="px-3 py-2 border-b border-gray-700 flex items-center gap-2 font-semibold">
              <Layers className="w-3.5 h-3.5 text-blue-400" /> Map Layers
            </div>
            {[
              { key: 'cases',  label: 'Screwworm Cases',      items: [['#e63946','High (≥8)'], ['#f77f00','Medium (3-7)'], ['#fcbf49','Low (1-2)']] },
              { key: 'cattle', label: 'Cattle Density (NASS)', items: [['#1e3a8a','Very High (>100k)'], ['#3b82f6','High (50-100k)'], ['#93c5fd','Medium/Low']] },
              { key: 'risk',   label: 'Risk (Cases × Cattle)', items: [['#7f1d1d','Critical'], ['#dc2626','High'], ['#f97316','Moderate']] },
            ].map(({ key, label, items }) => (
              <div key={key} className="px-3 py-2 border-b border-gray-800 last:border-0">
                <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                  <input type="checkbox" checked={layers[key]} onChange={() => toggle(key)} className="w-3.5 h-3.5 accent-blue-500" />
                  <span className="font-medium text-white">{label}</span>
                </label>
                <div className="space-y-0.5 pl-5">
                  {items.map(([color, text]) => (
                    <div key={text} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-gray-400">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-gray-800 shrink-0">
            {[['cases','Cases'], ['cattle','Cattle'], ['timeline','Timeline']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === id ? 'border-b-2 border-red-500 text-white bg-gray-800' : 'text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* Cases tab */}
            {activeTab === 'cases' && (
              <div className="p-3 space-y-2">
                {selectedCase && (
                  <div className={`${severityBorder(selectedCase.severity)} bg-gray-800 p-3 rounded-lg mb-3`}>
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-sm">{selectedCase.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${severityBadge(selectedCase.severity)}`}>
                        {selectedCase.severity?.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-300 space-y-1">
                      <p><span className="text-gray-500">Cases:</span> {selectedCase.caseCount}</p>
                      <p><span className="text-gray-500">Status:</span> <span className="capitalize text-blue-400">{selectedCase.status}</span></p>
                      <p><span className="text-gray-500">Confirmed:</span> {new Date(selectedCase.confirmedDate).toLocaleDateString()}</p>
                      <p><span className="text-gray-500">Risk:</span> <span className="capitalize text-red-400">{selectedCase.riskLevel}</span></p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide px-1">All Hotspots</p>
                {hotspots.map(spot => (
                  <div
                    key={spot.id}
                    onClick={() => setSelectedCase(spot)}
                    className={`${severityBorder(spot.severity)} bg-gray-800 p-3 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors ${selectedCase?.id === spot.id ? 'ring-1 ring-red-500' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{spot.name}</p>
                      <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded font-mono">{spot.caseCount}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{spot.status}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Cattle tab */}
            {activeTab === 'cattle' && (
              <div className="p-3 space-y-2">
                {selectedCase && (() => {
                  const c = counties.find(c => c.id === selectedCase.id);
                  return c ? (
                    <div className="bg-gray-800 border-l-4 border-blue-600 p-3 rounded-lg mb-3">
                      <p className="font-semibold text-sm mb-2">{c.name ?? c.county}</p>
                      <p className="text-lg font-bold text-blue-400 mb-2">{(c.cattle ?? 0).toLocaleString()} head</p>
                      {(c.dairy != null || c.feedlot != null || c.grazing != null) && (
                        <div className="text-xs space-y-1 bg-gray-700 rounded p-2">
                          {[['Dairy', c.dairy], ['Feedlot', c.feedlot], ['Grazing', c.grazing]].map(([k, v]) => v != null && (
                            <div key={k} className="flex justify-between">
                              <span className="text-gray-400">{k}</span>
                              <span className="font-medium">{v.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-gray-400">Risk</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          selectedCase.riskLevel === 'critical' ? 'bg-red-900 text-red-200' :
                          selectedCase.riskLevel === 'high'     ? 'bg-orange-900 text-orange-200' :
                          'bg-yellow-900 text-yellow-200'
                        }`}>{selectedCase.riskLevel?.toUpperCase()}</span>
                      </div>
                    </div>
                  ) : null;
                })()}
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide px-1">
                  All Counties ({counties.length})
                </p>
                {counties.slice(0, 50).map(c => {
                  const spot = hotspots.find(h => h.id === c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => { setSelectedCase(spot ?? null); }}
                      className={`bg-gray-800 border-l-4 border-blue-600 p-3 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors ${selectedCase?.id === c.id ? 'ring-1 ring-blue-500' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{c.name ?? `${c.county}, ${c.state}`}</p>
                        <span className="text-xs bg-blue-900 text-blue-200 px-1.5 py-0.5 rounded font-mono">
                          {((c.cattle ?? 0) / 1000).toFixed(0)}k
                        </span>
                      </div>
                      <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                        <span>Cases: <span className="text-orange-400">{spot?.caseCount ?? 0}</span></span>
                        <span>Density: <span className="text-blue-400 capitalize">{c.density}</span></span>
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-gray-600 px-1 pt-1">Source: USDA NASS 2022 Census of Agriculture</p>
              </div>
            )}

            {/* Timeline tab */}
            {activeTab === 'timeline' && (
              <div className="p-3">
                {timeline.length === 0 && (
                  <p className="text-xs text-gray-500 text-center pt-4">No timeline events yet.</p>
                )}
                {timeline.map((item, i) => (
                  <div key={i} className="flex gap-3 pb-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        item.type === 'confirmation'  ? 'bg-red-500'    :
                        item.type === 'alert'         ? 'bg-orange-500' :
                        item.type === 'action'        ? 'bg-blue-500'   :
                        item.type === 'investigation' ? 'bg-amber-400'  : 'bg-gray-500'
                      }`} />
                      {i < timeline.length - 1 && <div className="w-px flex-1 bg-gray-700 mt-1" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">{item.date}</p>
                      <p className="text-sm text-gray-200 leading-snug">{item.event}</p>
                      {item.link && (
                        <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 underline hover:text-blue-300">
                          Source →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 px-4 py-2 shrink-0 space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>{meta.dataSource}</span>
          <span>{meta.jurisdiction}</span>
        </div>
        <p className="text-xs text-yellow-500/80 text-center">
          ⚠ This tool is not endorsed by, produced by, affiliated with, or monitored by the USDA or any government agency.
          For official information visit{' '}
          <a href="https://www.aphis.usda.gov" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-400 transition-colors">
            aphis.usda.gov
          </a>.
        </p>
      </footer>
    </div>
  );
}
