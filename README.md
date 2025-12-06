# NeuroLogg Pro

A behavioral health tracking application designed for neurodivergent children (autism, ADHD, and other neurodevelopmental conditions). Built with React 19, TypeScript, and modern web technologies.

## Features

### Core Tracking
- **Daily Emotion Logging** - Track arousal (1-10), valence (mood), and energy levels
- **Trigger Documentation** - Record sensory triggers (auditory, visual, tactile, etc.) and context triggers (transitions, demands, social situations)
- **Strategy Tracking** - Log coping strategies used and their effectiveness
- **Crisis Response** - Timer-based crisis management with intensity tracking

### Analysis & Insights
- **AI-Powered Analysis** - Uses OpenRouter API for pattern detection and recommendations
- **Behavior Insights** - Heatmaps showing dysregulation patterns by time/day
- **Strategy Effectiveness** - Visual breakdown of which strategies work best
- **Correlation Detection** - AI-identified patterns between triggers and outcomes

### Planning & Goals
- **Visual Schedule** - Daily timeline with activity tracking and timers
- **IEP Goal Tracking** - Track progress toward individualized education goals
- **Report Generation** - Export data for school/clinic meetings

### Visualizations
- **Arousal Curves** - Time-based stress level charts
- **Energy Radar** - Spoon theory visualization
- **Sensory Profile** - Radar chart of sensory sensitivities

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Framework | React 19 + TypeScript |
| Routing | React Router v6 |
| State | React Context API |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion |
| Charts | Recharts |
| 3D/WebGL | Three.js, React Three Fiber |
| Icons | Lucide React |
| AI | OpenRouter API |
| Build | Vite |

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint
```

### Environment Variables

Create a `.env` file in the project root:

```env
# OpenRouter API key (optional - mock data used if not provided)
VITE_OPENROUTER_API_KEY=your_api_key_here
```

**Note:** The app works without an API key using mock data for development.

## Project Structure

```
neurolog-pro/
├── src/
│   ├── App.tsx              # Main app with routing
│   ├── main.tsx             # Entry point
│   ├── types.ts             # TypeScript interfaces and enums
│   ├── store.tsx            # React Context state management
│   │
│   ├── components/
│   │   ├── Home.tsx              # Landing page
│   │   ├── Dashboard.tsx         # Overview with AI analysis
│   │   ├── LogEntryForm.tsx      # Create emotion logs
│   │   ├── Analysis.tsx          # Analysis results display
│   │   ├── BehaviorInsights.tsx  # Behavioral patterns
│   │   ├── SensoryProfile.tsx    # Sensory sensitivities
│   │   ├── EnergyRegulation.tsx  # Energy/spoon tracking
│   │   ├── CrisisMode.tsx        # Crisis response timer
│   │   ├── VisualSchedule.tsx    # Daily schedule
│   │   ├── GoalTracking.tsx      # IEP goals
│   │   ├── Reports.tsx           # PDF generation
│   │   ├── BackgroundShader.tsx  # WebGL animated background
│   │   ├── Layout.tsx            # App layout wrapper
│   │   └── Navigation.tsx        # Bottom nav bar
│   │
│   ├── services/
│   │   └── ai.ts            # OpenRouter API integration
│   │
│   └── utils/
│       ├── generateMockData.ts  # Test data generator
│       └── exportData.ts        # Data export utility
│
├── public/                  # Static assets
├── dist/                    # Build output
└── package.json
```

## Data Storage

All data is stored locally in the browser using `localStorage`:
- `kreativium_logs` - Emotion/arousal log entries
- `kreativium_crisis_events` - Crisis event records
- `kreativium_schedule_entries` - Schedule completion data
- `kreativium_goals` - IEP goal progress

**Privacy:** Data is anonymized before being sent to AI analysis (names, emails, phone numbers removed).

## Available Routes

| Path | Description |
|------|-------------|
| `/` | Home page with quick access |
| `/dashboard` | Overview and AI analysis |
| `/log` | Create new log entry |
| `/analysis` | View analysis results |
| `/crisis` | Crisis mode timer |
| `/schedule` | Visual daily schedule |
| `/goals` | IEP goal tracking |
| `/behavior-insights` | Behavioral patterns |
| `/sensory-profile` | Sensory sensitivities |
| `/energy-regulation` | Energy tracking |
| `/reports` | Generate reports |

## Build Optimization

The app uses code splitting for optimal loading:
- **Vendor chunks** - React, Three.js, UI libraries separated
- **Lazy loading** - Secondary pages load on demand
- **Three.js deferred** - WebGL background loads asynchronously

## Norwegian Language

The UI is primarily in Norwegian, with terms from neurodevelopmental frameworks:
- **Sensory triggers**: Auditiv, Visuell, Taktil, Vestibulær, etc.
- **Context triggers**: Overgang, Krav, Sosialt, Uventet Hendelse, etc.
- **Strategies**: Hodetelefoner, Skjerming, Dypt Trykk, Samregulering, etc.

## Scripts

```bash
npm run dev      # Start development server
npm run build    # TypeScript check + Vite production build
npm run preview  # Preview production build locally
npm run lint     # Run ESLint
```

## License

Private project - All rights reserved.
