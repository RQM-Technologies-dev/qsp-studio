# QSP Studio

An interactive 3D platform for exploring **Quaternionic Signal Processing (QSP)**.

## Features

- **Complex Signal Mode** — Classical complex sinusoid tracing a circle in the XY plane
- **Polarized Signal Mode** — EM-style linear, circular, and elliptical polarization
- **Quaternionic Signal Mode** — Full 3D quaternionic signal with precessing axis
- Real-time animation with adjustable speed
- Interactive parameter controls (amplitude, frequency, ellipticity, orientation)
- Dark scientific-instrument aesthetic

## Tech Stack

- **Vite** + **React** + **TypeScript**
- **React Three Fiber** for 3D rendering
- **@react-three/drei** for Three.js helpers

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── app/           # Root App component
├── components/    # Reusable 3D components (AxisFrame, SignalVector, TrailPath, PhaseWheel)
├── features/      # Demo-specific scenes (Complex, Polarized, Quaternionic)
├── math/          # Pure math: quaternion algebra, signal computation, polarization
├── scenes/        # MainScene Canvas wrapper
├── ui/            # UI components (ControlPanel, ModeSelector, InfoOverlay)
└── styles/        # Global CSS
```

## License

Proprietary — © 2026 RQM Technologies LLC. All rights reserved.
See [LICENSE](./LICENSE) for details.
