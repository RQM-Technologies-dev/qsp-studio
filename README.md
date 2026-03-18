# QSP Studio

QSP Studio is an interactive geometric lab for Quaternionic Signal Processing.

It is designed to help users see that phase, orientation, and polarization are not separate signal attributes — they are different aspects of one evolving geometric state.

---

## Why this matters

Classical signal theory splits a signal's description into separate pieces:

- **Phase** — a scalar angle on the complex plane
- **Polarization** — the shape of the tip trajectory in the transverse plane
- **Orientation** — the direction of the propagation or oscillation axis

This separation is a mathematical convenience, not a physical necessity.

**Quaternionic Signal Processing (QSP)** unifies all three into a single geometric object: a quaternion-valued signal whose rotation encodes phase, whose trajectory encodes polarization, and whose axis encodes orientation — simultaneously, not separately.

The central insight QSP Studio is built to deliver:

> *In classical signal models, phase, polarization, and orientation are treated as separate attributes. In QSP Studio, they appear as one evolving geometric state.*

---

## What you see in v0

The first prototype introduces this idea through three linked visual demonstrations:

### 1 — Classical Complex View
A standard complex sinusoid `e^{iθ}` traces a circle in the XY plane. Phase is a scalar. Amplitude and phase fully describe the signal. This is the baseline reference most engineers know.

### 2 — Polarization Geometry
The signal tip traces a polarization ellipse in the transverse plane. Linear, circular, and elliptical modes are all available. This is the first hint that geometry matters — but phase and orientation are still being handled separately.

### 3 — Quaternionic Unified View
The signal axis precesses in 3D as the phase evolves. There is no clean separation between "the phase" and "the orientation" — they are one quaternionic rotation unfolding in space. Use the **Show Classical Split** overlay to see how the classical model would break this unified state into fragments.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| 3D rendering | React Three Fiber + @react-three/drei |
| Math layer | Custom TypeScript (quaternion algebra, signal computation) |
| Deployment | Vercel |

---

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Production build

```bash
npm run build
npm run preview
```

## Vercel deployment

The project deploys directly from `main` with no special configuration. A `vercel.json` is included with the correct `buildCommand`, `outputDirectory`, and `devCommand` settings. Push to your Vercel-linked repository and it will deploy automatically.

---

## Architecture

```
src/
├── app/              # Root App component — state, animation loop, layout
├── components/       # Reusable 3D primitives: AxisFrame, SignalVector, TrailPath, PhaseWheel
├── features/         # Mode-specific scenes: ComplexSignalDemo, PolarizedSignalDemo, QuaternionicSignalDemo
│   ├── signal-builder/      # Planned
│   ├── transform-view/      # Planned
│   ├── channel-view/        # Planned
│   ├── filter-lab/          # Planned
│   ├── modulation-lab/      # Planned
│   └── receiver-view/       # Planned
├── math/             # Pure TypeScript math: quaternion algebra, signal params, polarization paths
├── scenes/           # MainScene — React Three Fiber Canvas + scene composition
├── ui/               # UI components: ControlPanel, ModeSelector, InfoOverlay, StatusStrip
└── styles/           # Global CSS — dark scientific-instrument aesthetic
```

The math layer (`src/math/`) is fully decoupled from rendering. All signal computation and quaternion algebra lives there. This makes it straightforward to replace simplified math with more rigorous quaternionic signal evolution later.

---

## Roadmap

The features directory is already reserved for the planned Studio modules:

| Module | Description |
|---|---|
| **Signal Builder** | Compose quaternionic signals from basis functions, preview in 3D |
| **Transform View** | Quaternionic Fourier and wavelet transforms with geometric visualization |
| **Channel View** | Propagation simulation — how geometric state survives the channel |
| **Filter Lab** | Design and apply quaternionic filters, compare against classical |
| **Modulation Lab** | Quaternionic modulation schemes and constellation visualization |
| **Receiver View** | Quaternionic receiver simulation and performance comparison |

---

## License

Proprietary — © 2026 RQM Technologies LLC. All rights reserved.
See [LICENSE](./LICENSE) for details.

