# DisasterIQ Frontend

This directory contains the Next.js frontend application for the CRISP (DisasterIQ) platform.

## Features
- **Interactive Map:** Displays risk heatmaps, district boundaries, and relief route layers using Mapbox GL JS.
- **Real-time Dashboards:** Visualizes live data, risk trends, and resource utilizations using Recharts and Zustand.
- **Relief Allocation Simulator:** A dashboard allowing operators to input available resources and run optimization models.
- **Alerts Panel:** Real-time push notifications indicating risk severity and tracking acknowledged alerts.

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Maps:** Mapbox GL JS
- **State Management:** Zustand
- **Real-time:** WebSockets

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set your environment variables in a `.env.local` file:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
   ```
3. Run the development server (or use the root `start-frontend.ps1`):
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
