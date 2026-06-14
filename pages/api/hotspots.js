const GITHUB_RAW = 'https://raw.githubusercontent.com/rmkenv/hominivorax/main/public/data/hotspots.json';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const upstream = await fetch(GITHUB_RAW);
    if (!upstream.ok) throw new Error(`GitHub returned ${upstream.status}`);
    const data = await upstream.json();

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (err) {
    console.error('hotspots fetch failed:', err);
    return res.status(500).json({ error: 'Failed to load hotspot data', message: err.message });
  }
}
