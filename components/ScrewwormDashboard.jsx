import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, TrendingUp, MapPin, Clock } from 'lucide-react';

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
  return s === 'high'   ? 'border-l-4 border-red-600'
       : s === 'medium' ? 'border-l-4 border-orange-500'
       :                  'border-l-4 border-amber-400';
}
function severityBadge(s) {
  return s === 'high'   ? 'bg-red-600 text-white'
       : s === 'medium' ? 'bg-orange-500 text-white'
       :                  'bg-amber-400 text-black';
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
  const [caseData,     setCaseData]     = useState(null);
  const [mapReady,     setMapReady]     = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [activeTab,    setActiveTab]    = useState('cases');

  // ── Fetch live data ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/hotspots')
      .then(r => r.json())
      .then(setCaseData)
      .catch(err => console.error('hotspots load failed:', err));
  }, []);

  // ── Build map once data is ready ─────────────────────────────────────────────
  useEffect(() => {
    if (!caseData) return;
    let cancelled = false;

    const init = async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !mapContainer.current || mapRef.current) return;

      const m = new maplibregl.Map({
        container: mapContainer.current,
        style: MAP_STYLE,
        center: [-88, 28],
        zoom: 5,
      });

      m.addControl(new maplibregl.NavigationControl(), 'top-left');

      m.on('load', () => {
        if (cancelled) return;

        const hotspots = caseData.hotspots ?? [];

        // Case circles
        const caseFeatures = hotspots.map(h => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [h.lng, h.lat] },
          properties: { count: h.caseCount, severity: h.severity, id: h.id },
        }));

        m.addSource('cases', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: caseFeatures },
        });

        // Glow ring (outer)
        m.addLayer({
          id: 'case-glow',
          type: 'circle',
          source: 'cases',
          paint: {
            'circle-radius':        ['interpolate', ['linear'], ['get', 'count'], 1, 18, 20, 36],
            'circle-color':         ['match', ['get', 'severity'], 'high', '#e63946', 'medium', '#f77f00', '#fcbf49'],
            'circle-opacity':       0.15,
            'circle-stroke-width':  0,
          },
        });

        // Main dot
        m.addLayer({
          id: 'case-points',
          type: 'circle',
          source: 'cases',
          paint: {
            'circle-radius':        ['interpolate', ['linear'], ['get', 'count'], 1, 8, 20, 20],
            'circle-color':         ['match', ['get', 'severity'], 'high', '#e63946', 'medium', '#f77f00', '#fcbf49'],
            'circle-opacity':       0.92,
            'circle-stroke-width':  2.5,
            'circle-stroke-color':  '#fff',
          },
        });

        m.on('click', 'case-points', e => {
          const id = e.features[0].properties.id;
          setSelectedCase(hotspots.find(h => h.id === id) ?? null);
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
  }, [caseData]);

  if (!caseData) return <LoadingScreen />;

  const hotspots = caseData.hotspots ?? [];
  const summary  = caseData.summary  ?? {};
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
            <p className="text-xs text-gray-400">New World Screwworm Surveillance — USA</p>
          </div>
        </div>
        <div className="text-right text-xs text-gray-400">
          <p>Updated: {new Date(meta.lastUpdated).toLocaleString()}</p>
          <p className="text-green-400 font-semibold mt-0.5">● ACTIVE MONITORING</p>
        </div>
      </header>

      {/* KPI bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-2 flex gap-10 shrink-0">
        {[
          { icon: <AlertCircle className="w-4 h-4 text-red-500"   />, label: 'ACTIVE CASES',   value: summary.activeCases ?? 0 },
          { icon: <TrendingUp  className="w-4 h-4 text-amber-400" />, label: 'NEW (7 DAYS)',    value: summary.newCases7d  ?? 0 },
          { icon: <MapPin      className="w-4 h-4 text-blue-400"  />, label: 'HOTSPOT ZONES',  value: hotspots.length         },
          { icon: <Clock       className="w-4 h-4 text-gray-400"  />, label: 'TOTAL CONFIRMED', value: summary.totalCases ?? 0 },
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
          <div className="absolute top-3 right-3 z-10 bg-gray-900/95 border border-gray-700 rounded-lg shadow-xl p-3 text-xs w-44">
            <p className="font-semibold text-white mb-2">Case Severity</p>
            {[
              ['#e63946', 'High (≥8 cases)'],
              ['#f77f00', 'Medium (3–7)'],
              ['#fcbf49', 'Low (1–2)'],
            ].map(([color, label]) => (
              <div key={label} className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-gray-300">{label}</span>
              </div>
            ))}
            <p className="text-gray-500 mt-2 text-xs">Click a dot for details</p>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-gray-800 shrink-0">
            {[['cases', 'Cases'], ['timeline', 'Timeline']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === id
                    ? 'border-b-2 border-red-500 text-white bg-gray-800'
                    : 'text-gray-400 hover:text-white'
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

                {/* Selected case detail */}
                {selectedCase && (
                  <div className={`${severityBorder(selectedCase.severity)} bg-gray-800 p-3 rounded-lg mb-3`}>
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-sm">{selectedCase.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${severityBadge(selectedCase.severity)}`}>
                        {selectedCase.severity?.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-300 space-y-1">
                      <p><span className="text-gray-500">Cases:</span> {selectedCase.caseCount}</p>
                      <p><span className="text-gray-500">Status:</span>{' '}
                        <span className="capitalize text-blue-400">{selectedCase.status}</span>
                      </p>
                      <p><span className="text-gray-500">Confirmed:</span>{' '}
                        {new Date(selectedCase.confirmedDate).toLocaleDateString()}
                      </p>
                      {selectedCase.riskLevel && (
                        <p><span className="text-gray-500">Risk:</span>{' '}
                          <span className="capitalize text-red-400">{selectedCase.riskLevel}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide px-1">
                  All Hotspots ({hotspots.length})
                </p>

                {hotspots.map(spot => (
                  <div
                    key={spot.id}
                    onClick={() => setSelectedCase(spot)}
                    className={`${severityBorder(spot.severity)} bg-gray-800 p-3 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors ${
                      selectedCase?.id === spot.id ? 'ring-1 ring-red-500' : ''
                    }`}
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

            {/* Timeline tab */}
            {activeTab === 'timeline' && (
              <div className="p-3">
                {timeline.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center pt-6">No timeline events yet.</p>
                ) : (
                  timeline.map((item, i) => (
                    <div key={i} className="flex gap-3 pb-4">
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
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 underline hover:text-blue-300"
                          >
                            Source →
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
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
          <a
            href="https://www.aphis.usda.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-yellow-400 transition-colors"
          >
            aphis.usda.gov
          </a>.
        </p>
      </footer>
    </div>
  );
}
