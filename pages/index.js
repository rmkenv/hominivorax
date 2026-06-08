import React from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';

// Dynamically import dashboard component to avoid maplibre SSR issues
const ScrewwormDashboard = dynamic(
  () => import('@/components/ScrewwormDashboard'),
  { ssr: false, loading: () => <LoadingScreen /> }
);

function LoadingScreen() {
  return (
    <div className="bg-gray-950 text-white h-screen flex flex-col items-center justify-center">
      <div className="space-y-4 text-center">
        <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-800 rounded-lg mx-auto flex items-center justify-center font-bold text-xl">
          S
        </div>
        <h1 className="text-2xl font-bold">Screwworm Watch</h1>
        <p className="text-gray-400">Loading operational dashboard...</p>
        <div className="flex justify-center gap-2">
          <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Head>
        <title>Screwworm Watch - USDA Operations Dashboard</title>
        <meta name="description" content="Real-time operational dashboard for USDA APHIS screwworm surveillance and eradication tracking" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23e63946' width='100' height='100'/><text x='50' y='75' font-size='80' font-weight='bold' fill='white' text-anchor='middle'>S</text></svg>" />
        <link href='https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css' rel='stylesheet' />
      </Head>
      <ScrewwormDashboard />
    </>
  );
}
