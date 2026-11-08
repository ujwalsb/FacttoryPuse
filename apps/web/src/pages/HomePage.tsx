import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { ThemeToggle } from '../components/common/ThemeToggle.js';
import { DEMO_CREDENTIALS } from '../constants/demoCredentials.js';
import { UserRole } from '@factorypulse/shared';
import {
  Layers,
  Activity,
  Cpu,
  Shield,
  Gauge,
  Zap,
  CheckCircle2,
  ArrowRight,
  Play,
  Pause,
  AlertOctagon,
  Sparkles,
  Server,
  Network,
  BarChart3,
  Wrench,
  Radio,
  Clock,
  TrendingUp,
  Sliders,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  Building2,
  Lock,
  Boxes,
  HelpCircle
} from 'lucide-react';

interface IndustrySpec {
  id: string;
  name: string;
  badge: string;
  tagline: string;
  description: string;
  activeEquipment: string[];
  protocols: string[];
  sampleOee: number;
  throughput: string;
  criticalFactor: string;
}

const INDUSTRIES: IndustrySpec[] = [
  {
    id: 'automotive',
    name: 'Automotive & EV Manufacturing',
    badge: 'High Throughput',
    tagline: 'Synchronized Robotic Welding & Battery Pack Assembly Cells',
    description: 'Real-time cycle time optimization and automated defect rejection for body-in-white stamping, robotic weld gantries, and lithium EV pack modules.',
    activeEquipment: ['ABB 6-Axis Spot Welder Gantry', 'Schuler 1600T Stamping Press', 'EV Battery Cell Laser Seam Welder'],
    protocols: ['PROFINET', 'EtherNet/IP', 'OPC UA', 'MQTT'],
    sampleOee: 91.8,
    throughput: '1,480 units/shift',
    criticalFactor: '18.4s Cycle Time Compliance'
  },
  {
    id: 'aerospace',
    name: 'Aerospace & Precision Defense',
    badge: 'Micro-Tolerance',
    tagline: 'Sub-Micron 5-Axis CNC Milling & Turbine Balancing',
    description: 'Digital thread traceability, spindle thermal vibration spectral analysis, and AS9100-compliant telemetry logging for aerospace alloys and composites.',
    activeEquipment: ['Hermle C62U 5-Axis Machining Center', 'DMG MORI Lasertec 125', 'Autoclave Composite Cure Skid'],
    protocols: ['OPC UA (Part 8)', 'Modbus TCP', 'MTConnect'],
    sampleOee: 88.4,
    throughput: '34 turbine disks/shift',
    criticalFactor: '±0.002mm Dimensional Accuracy'
  },
  {
    id: 'semiconductor',
    name: 'Semiconductor & High-Tech Electronics',
    badge: 'Zero Particle Cleanroom',
    tagline: 'High-Speed SMT Pick & Place & Wafer Dicing Skids',
    description: 'Sub-millisecond optical inspection feeds, cleanroom differential pressure monitoring, and SECS/GEM recipe management at extreme speeds.',
    activeEquipment: ['ASM SIPLACE SMT Gantry', 'Disco DAD3350 Automatic Dicing Saw', 'Cleanroom HEPA Scrubber Array'],
    protocols: ['SECS/GEM', 'OPC UA', 'REST Webhook', 'MQTT Sparkplug'],
    sampleOee: 94.6,
    throughput: '42,000 placements/hr',
    criticalFactor: '0.001% Component Rejection Rate'
  },
  {
    id: 'machinery',
    name: 'Heavy Machinery & Capital Equipment',
    badge: 'Extreme Vibration',
    tagline: 'Heavy Hydraulic Forging & Large Gantry Plasma Cutting',
    description: 'High-temperature hydraulic oil degradation tracking, pump cavitation vibration early detection, and automated preventive work orders.',
    activeEquipment: ['2500-Ton Hydraulic Forging Press', 'Esab CNC Plasma Cutting Bed', 'Continuous Induction Heat Treat Furnace'],
    protocols: ['Modbus TCP', 'EtherCAT', 'OPC UA'],
    sampleOee: 86.2,
    throughput: '19 tons/shift',
    criticalFactor: 'MTBF > 720 Hours'
  },
  {
    id: 'pharma',
    name: 'Pharma & Medical Device Assembly',
    badge: 'FDA 21 CFR Part 11',
    tagline: 'Continuous Tablet Compression & Sterile Filling Skids',
    description: 'Electronic batch record validation, environmental cleanroom telemetry, and tamper-proof audit trails for aseptic production.',
    activeEquipment: ['Fette Compacting Rotary Tablet Press', 'Bausch+Ströbel Sterile Vial Filler', 'Sterile CIP/SIP Clean Skid'],
    protocols: ['OPC UA', 'MQTT TLS 1.3', 'Modbus TCP'],
    sampleOee: 89.9,
    throughput: '220,000 tabs/hr',
    criticalFactor: '100% Audit Trail Integrity'
  },
  {
    id: 'energy',
    name: 'Energy, Smart Utilities & Power',
    badge: 'Continuous 24/7',
    tagline: 'Gas Turbine Cogeneration & High-Head Hydro Pumps',
    description: 'Active/reactive power factor analysis, heat rate efficiency calculation, and predictive bearing anomaly alerting on heavy rotating equipment.',
    activeEquipment: ['Solar Turbines Titan 130 Genset', 'Sulzer 4-Stage High-Head Pump', 'ABB 33kV Switchgear Gateway'],
    protocols: ['DNP3', 'IEC 60870-5-104', 'Modbus TCP', 'OPC UA'],
    sampleOee: 95.2,
    throughput: '14.8 MW Baseload',
    criticalFactor: '99.99% Availability'
  }
];

export const HomePage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Selected Industry Solution Tab
  const [selectedIndustry, setSelectedIndustry] = useState<IndustrySpec>(INDUSTRIES[0]);

  // Live Machine Simulator State
  const [simState, setSimState] = useState<'RUNNING' | 'IDLE' | 'FAULTED'>('RUNNING');
  const [simRpm, setSimRpm] = useState<number>(12450);
  const [simTemp, setSimTemp] = useState<number>(58.4);
  const [simVibration, setSimVibration] = useState<number>(0.38);
  const [simGoodParts, setSimGoodParts] = useState<number>(1428);
  const [simDefects, setSimDefects] = useState<number>(4);
  const [simOee, setSimOee] = useState<number>(89.4);

  // ROI Calculator State
  const [machinesCount, setMachinesCount] = useState<number>(36);
  const [downtimeCostPerHour, setDowntimeCostPerHour] = useState<number>(2400);
  const [shiftsPerDay, setShiftsPerDay] = useState<number>(2);

  // Live Telemetry Simulation Timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (simState === 'RUNNING') {
        setSimGoodParts(prev => prev + 1);
        setSimRpm(prev => {
          const delta = (Math.random() - 0.5) * 80;
          return Math.round(Math.min(12800, Math.max(12200, prev + delta)));
        });
        setSimTemp(prev => {
          const delta = (Math.random() - 0.5) * 0.4;
          return Number(Math.min(64, Math.max(54, prev + delta)).toFixed(1));
        });
        setSimVibration(prev => {
          const delta = (Math.random() - 0.5) * 0.04;
          return Number(Math.min(0.55, Math.max(0.32, prev + delta)).toFixed(2));
        });
      } else if (simState === 'IDLE') {
        setSimRpm(prev => Math.max(0, Math.round(prev * 0.85)));
        setSimTemp(prev => Math.max(30, Number((prev - 0.2).toFixed(1))));
        setSimVibration(0.08);
      } else if (simState === 'FAULTED') {
        setSimRpm(0);
        setSimVibration(0.92);
        setSimTemp(74.2);
      }
    }, 1800);

    return () => clearInterval(timer);
  }, [simState]);

  // Derived ROI calculations
  // Average benchmark: FactoryPulse saves ~42 hours of unplanned downtime per machine annually
  const annualDowntimeHoursSaved = Math.round(machinesCount * (shiftsPerDay === 3 ? 48 : shiftsPerDay === 2 ? 38 : 24));
  const annualSavingsDollars = annualDowntimeHoursSaved * downtimeCostPerHour;
  const scrapSavings = Math.round(machinesCount * 14500);
  const totalAnnualBenefit = annualSavingsDollars + scrapSavings;
  const paybackDays = Math.max(7, Math.round((machinesCount * 2800) / (totalAnnualBenefit / 365)));

  return (
    <div className="min-h-screen bg-industrial-950 text-industrial-100 selection:bg-brand-500 selection:text-white transition-colors duration-300">

      {/* ─── STICKY NAVIGATION BAR ─── */}
      <header className="sticky top-0 z-50 w-full border-b border-industrial-800 bg-industrial-950/90 backdrop-blur-md transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-md shadow-brand-500/25 transition-transform duration-300 group-hover:scale-105">
              <Layers className="h-5 w-5 text-white" />
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-industrial-950 beacon-running" />
            </div>
            <div>
              <div className="font-mono text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5">
                Factory<span className="text-brand-400">Pulse</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono ml-1 hidden sm:inline-block">
                  IIoT 4.0
                </span>
              </div>
              <span className="text-[10px] tracking-widest text-industrial-400 uppercase block -mt-1 font-mono">
                Industrial Intelligence SaaS
              </span>
            </div>
          </Link>

          {/* Nav Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-mono font-medium text-industrial-300">
            <a href="#simulator" className="hover:text-brand-400 transition-colors">
              Live Simulator
            </a>
            <a href="#industries" className="hover:text-brand-400 transition-colors">
              Industry Support
            </a>
            <a href="#pipeline" className="hover:text-brand-400 transition-colors">
              Data Pipeline
            </a>
            <a href="#roi" className="hover:text-brand-400 transition-colors">
              ROI Calculator
            </a>
            <a href="#architecture" className="hover:text-brand-400 transition-colors">
              Security & RBAC
            </a>
          </nav>

          {/* Right Action Controls: Theme Switcher & Auth */}
          <div className="flex items-center gap-3">

            {/* The user specifically asked for: "on dark bright button on up side" */}
            <div className="flex items-center">
              <ThemeToggle variant="pill" showLabel={true} />
            </div>

            {isAuthenticated ? (
              <button
                onClick={() => navigate(user?.role === UserRole.MASTER_ADMIN ? '/master-admin' : '/')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 hover:bg-brand-500 transition-all font-mono"
              >
                <span>Console</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="rounded-xl border border-industrial-700 bg-industrial-900/80 px-3 py-1.5 text-xs font-mono font-semibold text-industrial-200 hover:border-brand-500/60 hover:text-white transition-all"
                >
                  Sign In
                </Link>
                <Link
                  to="/login"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 hover:from-brand-500 hover:to-indigo-500 transition-all font-mono"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Launch Demo</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── HERO SECTION WITH INDUSTRIAL GLOW & REAL-TIME HUD ─── */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 border-b border-industrial-800">

        {/* Subtle Ambient Background Lighting */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[900px] rounded-full bg-gradient-to-b from-brand-600/20 via-indigo-600/10 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute top-1/4 -right-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            {/* Left Column: Hero Value Proposition */}
            <div className="lg:col-span-7 space-y-6 text-left">

              {/* High-tech Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-950/60 px-3.5 py-1 text-xs font-mono text-brand-300 shadow-sm backdrop-blur-md">
                <Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                <span className="font-semibold tracking-wide">Industry 4.0 Standard Telemetry</span>
                <span className="text-industrial-500">•</span>
                <span className="text-emerald-400 font-bold">1s Ingest Feed</span>
              </div>

              {/* Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight font-mono">
                Real-Time Neural Engine for{' '}
                <span className="bg-gradient-to-r from-brand-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
                  Smart Manufacturing
                </span>{' '}
                & CNC Fleet Automation
              </h1>

              {/* Subtitle */}
              <p className="text-sm sm:text-base text-industrial-300 font-sans leading-relaxed max-w-2xl">
                Bridge shop floor PLCs, CNC machines, and edge gateways with executive OEE intelligence.
                Instant machine discovery, ISO 22400 metrics, vibration anomaly alerting, and remote command governance across 6 key manufacturing sectors.
              </p>

              {/* Hero CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 font-mono">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-xl shadow-brand-600/30 hover:from-brand-500 hover:to-indigo-500 transition-all group text-center"
                >
                  <Zap className="h-4 w-4 text-amber-300" />
                  <span>Launch Live Control Center</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>

                <a
                  href="#simulator"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-industrial-700 bg-industrial-900/80 px-4 py-3 text-xs font-semibold text-industrial-200 hover:border-brand-500/60 hover:text-white hover:bg-industrial-850 transition-all text-center"
                >
                  <Cpu className="h-4 w-4 text-brand-400" />
                  <span>Test Machine HUD Simulator</span>
                </a>

                <a
                  href="#industries"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-transparent px-3 py-3 text-xs font-semibold text-industrial-400 hover:text-white transition-all text-center"
                >
                  <span>Explore 6 Industries ↓</span>
                </a>
              </div>

              {/* Key SLA Metric Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-industrial-800/80 font-mono">
                <div className="rounded-xl border border-industrial-800 bg-industrial-900/50 p-2.5">
                  <div className="text-lg font-bold text-emerald-400">99.98%</div>
                  <div className="text-[10px] text-industrial-400 uppercase tracking-wider">Gateway Uptime</div>
                </div>
                <div className="rounded-xl border border-industrial-800 bg-industrial-900/50 p-2.5">
                  <div className="text-lg font-bold text-white">42 ms</div>
                  <div className="text-[10px] text-industrial-400 uppercase tracking-wider">Sensor Ingest</div>
                </div>
                <div className="rounded-xl border border-industrial-800 bg-industrial-900/50 p-2.5">
                  <div className="text-lg font-bold text-brand-400">4,820+</div>
                  <div className="text-[10px] text-industrial-400 uppercase tracking-wider">Connected PLCs</div>
                </div>
                <div className="rounded-xl border border-industrial-800 bg-industrial-900/50 p-2.5">
                  <div className="text-lg font-bold text-amber-400">IEC 62443</div>
                  <div className="text-[10px] text-industrial-400 uppercase tracking-wider">Security Tier 3</div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Machine HUD & Telemetry Card */}
            <div className="lg:col-span-5" id="simulator">
              <div className="relative rounded-2xl border border-industrial-700 bg-industrial-900/90 p-5 backdrop-blur-xl shadow-2xl transition-all hover:border-brand-500/50 space-y-4">

                {/* HUD Header Bar */}
                <div className="flex items-center justify-between border-b border-industrial-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-950 border border-brand-500/40 text-brand-400 font-mono text-xs font-bold">
                      M1
                    </div>
                    <div>
                      <h3 className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                        CNC 5-Axis Milling Center #04
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 beacon-running" />
                      </h3>
                      <p className="font-mono text-[10px] text-industrial-400">
                        Siemens S7-1500 PLC • Modbus Port 502 • Plant 01
                      </p>
                    </div>
                  </div>

                  {/* Machine Status Badge */}
                  <span
                    className={`font-mono text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${simState === 'RUNNING'
                        ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-400'
                        : simState === 'IDLE'
                          ? 'bg-amber-950/80 border-amber-500/40 text-amber-400'
                          : 'bg-rose-950/80 border-rose-500/40 text-rose-400'
                      }`}
                  >
                    ● {simState}
                  </span>
                </div>

                {/* Simulated Telemetry Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono">

                  {/* Spindle RPM Gauge */}
                  <div className="rounded-xl border border-industrial-800 bg-industrial-950/80 p-2.5">
                    <div className="flex items-center justify-between text-industrial-400 text-[10px]">
                      <span>SPINDLE RPM</span>
                      <Gauge className="h-3 w-3 text-brand-400" />
                    </div>
                    <div className="text-base font-extrabold text-white mt-1">
                      {simRpm.toLocaleString()}
                    </div>
                    <div className="text-[9px] text-emerald-400 flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Nominal Target
                    </div>
                  </div>

                  {/* Temperature */}
                  <div className="rounded-xl border border-industrial-800 bg-industrial-950/80 p-2.5">
                    <div className="flex items-center justify-between text-industrial-400 text-[10px]">
                      <span>TEMPERATURE</span>
                      <Activity className="h-3 w-3 text-amber-400" />
                    </div>
                    <div className="text-base font-extrabold text-amber-300 mt-1">
                      {simTemp}°C
                    </div>
                    <div className="text-[9px] text-industrial-400">
                      Limit: 75°C
                    </div>
                  </div>

                  {/* OEE Metric */}
                  <div className="rounded-xl border border-industrial-800 bg-industrial-950/80 p-2.5">
                    <div className="flex items-center justify-between text-industrial-400 text-[10px]">
                      <span>LIVE OEE</span>
                      <TrendingUp className="h-3 w-3 text-indigo-400" />
                    </div>
                    <div className="text-base font-extrabold text-emerald-400 mt-1">
                      {simOee}%
                    </div>
                    <div className="text-[9px] text-emerald-400">
                      World Class (A)
                    </div>
                  </div>

                  {/* Vibration RMS */}
                  <div className="rounded-xl border border-industrial-800 bg-industrial-950/80 p-2.5">
                    <div className="flex items-center justify-between text-industrial-400 text-[10px]">
                      <span>VIBRATION RMS</span>
                      <Radio className="h-3 w-3 text-brand-400" />
                    </div>
                    <div className="text-base font-extrabold text-white mt-1">
                      {simVibration} mm/s
                    </div>
                    <div className="text-[9px] text-industrial-400">
                      ISO 10816 Zone A
                    </div>
                  </div>

                  {/* Good Parts Counter */}
                  <div className="rounded-xl border border-industrial-800 bg-industrial-950/80 p-2.5">
                    <div className="flex items-center justify-between text-industrial-400 text-[10px]">
                      <span>GOOD YIELD</span>
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    </div>
                    <div className="text-base font-extrabold text-emerald-300 mt-1">
                      {simGoodParts}
                    </div>
                    <div className="text-[9px] text-emerald-400">
                      +1 tick live feed
                    </div>
                  </div>

                  {/* Defect Counter */}
                  <div className="rounded-xl border border-industrial-800 bg-industrial-950/80 p-2.5">
                    <div className="flex items-center justify-between text-industrial-400 text-[10px]">
                      <span>DEFECT SCRAP</span>
                      <AlertOctagon className="h-3 w-3 text-rose-400" />
                    </div>
                    <div className="text-base font-extrabold text-rose-400 mt-1">
                      {simDefects}
                    </div>
                    <div className="text-[9px] text-industrial-400">
                      0.28% Defect Rate
                    </div>
                  </div>
                </div>

                {/* Animated Waveform Sparkline Simulation */}
                <div className="rounded-xl border border-industrial-800 bg-industrial-950 p-3 space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-[10px] text-industrial-400">
                    <span className="flex items-center gap-1">
                      <Radio className="h-2.5 w-2.5 text-emerald-400 animate-pulse" />
                      Live High-Frequency Waveform (100Hz Ingest)
                    </span>
                    <span className="text-emerald-400 font-bold">STABLE</span>
                  </div>

                  {/* Visual SVG Sparkline */}
                  <div className="h-12 w-full overflow-hidden flex items-end">
                    <svg className="h-full w-full" viewBox="0 0 300 50" preserveAspectRatio="none">
                      <path
                        d={
                          simState === 'RUNNING'
                            ? "M0,25 Q25,5 50,25 T100,25 T150,25 T200,10 T250,38 T300,25"
                            : simState === 'IDLE'
                              ? "M0,35 Q25,30 50,35 T100,35 T150,35 T200,35 T250,35 T300,35"
                              : "M0,25 L30,5 L60,45 L90,10 L120,40 L150,15 L180,42 L210,5 L240,45 L270,10 L300,25"
                        }
                        fill="none"
                        stroke={
                          simState === 'RUNNING'
                            ? "#10b981"
                            : simState === 'IDLE'
                              ? "#f59e0b"
                              : "#ef4444"
                        }
                        strokeWidth="2.5"
                        className="transition-all duration-500"
                      />
                    </svg>
                  </div>
                </div>

                {/* Interactive Machine Control Simulation Panel */}
                <div className="pt-2 border-t border-industrial-800 flex items-center justify-between gap-2 font-mono">
                  <span className="text-[11px] text-industrial-400 font-bold uppercase tracking-wider">
                    Interactive Controls:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSimState('RUNNING')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${simState === 'RUNNING'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                          : 'bg-industrial-800 text-industrial-300 hover:bg-emerald-950/60 hover:text-emerald-400'
                        }`}
                      title="Set Machine to Running state"
                    >
                      <Play className="h-3 w-3" />
                      Start
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimState('IDLE')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${simState === 'IDLE'
                          ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                          : 'bg-industrial-800 text-industrial-300 hover:bg-amber-950/60 hover:text-amber-400'
                        }`}
                      title="Set Machine to Idle state"
                    >
                      <Pause className="h-3 w-3" />
                      Pause
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimState('FAULTED')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${simState === 'FAULTED'
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                          : 'bg-industrial-800 text-industrial-300 hover:bg-rose-950/60 hover:text-rose-400'
                        }`}
                      title="Simulate Machine E-Stop / Fault"
                    >
                      <AlertOctagon className="h-3 w-3" />
                      E-Stop
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── MULTI-INDUSTRY SOLUTIONS MATRIX ("based on industry support") ─── */}
      <section className="py-20 border-b border-industrial-800 relative" id="industries">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-brand-400 bg-brand-950/80 border border-brand-500/30 px-3 py-1 rounded-full">
              Industrial Domain Specialization
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              Engineered for the Demands of High-Stakes Manufacturing
            </h2>
            <p className="text-xs sm:text-sm text-industrial-400 font-sans">
              From sub-micron semiconductor dicing to 2500-ton automotive hydraulic stamping, FactoryPulse adapts protocol drivers, telemetry buffers, and ISO compliance standards to each factory floor.
            </p>
          </div>

          {/* Interactive Industry Tab Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8 font-mono">
            {INDUSTRIES.map(industry => {
              const isSelected = selectedIndustry.id === industry.id;
              return (
                <button
                  key={industry.id}
                  type="button"
                  onClick={() => setSelectedIndustry(industry)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border ${isSelected
                      ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-600/30 scale-105'
                      : 'border-industrial-800 bg-industrial-900/60 text-industrial-400 hover:text-white hover:border-industrial-700'
                    }`}
                >
                  {industry.name}
                </button>
              );
            })}
          </div>

          {/* Active Industry Deep-Dive Display Card */}
          <div className="rounded-2xl border border-industrial-800 bg-industrial-900/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl transition-all">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

              {/* Left Column: Domain Specs & Operations */}
              <div className="lg:col-span-7 space-y-5">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                    {selectedIndustry.badge}
                  </span>
                  <span className="font-mono text-xs text-industrial-400">
                    Protocols: {selectedIndustry.protocols.join(', ')}
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-white font-mono">
                  {selectedIndustry.tagline}
                </h3>

                <p className="text-xs sm:text-sm text-industrial-300 leading-relaxed font-sans">
                  {selectedIndustry.description}
                </p>

                {/* Target Equipment List */}
                <div className="space-y-2 font-mono">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-industrial-400 block">
                    Supported Plant Floor Assets & Cells:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    {selectedIndustry.activeEquipment.map((eq, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl border border-industrial-800 bg-industrial-950/70 text-industrial-200 flex items-center gap-2"
                      >
                        <Cpu className="h-3.5 w-3.5 text-brand-400 shrink-0" />
                        <span className="truncate">{eq}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Critical Success Factor */}
                <div className="p-3 rounded-xl border border-brand-500/20 bg-brand-950/30 text-xs font-mono flex items-center justify-between text-brand-300">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Sparkles className="h-4 w-4 text-brand-400" />
                    Key Optimization Benchmark:
                  </span>
                  <span className="font-bold text-white">{selectedIndustry.criticalFactor}</span>
                </div>
              </div>

              {/* Right Column: Live Performance Benchmarks */}
              <div className="lg:col-span-5 rounded-xl border border-industrial-800 bg-industrial-950/80 p-5 space-y-4 font-mono">
                <div className="flex items-center justify-between border-b border-industrial-800 pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-industrial-300">
                    Live Sector Benchmarks
                  </span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <Activity className="h-3 w-3 animate-pulse" />
                    Real-Time Sample
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-industrial-400">Target OEE Performance:</span>
                      <span className="text-emerald-400 font-bold">{selectedIndustry.sampleOee}%</span>
                    </div>
                    <div className="h-2 w-full bg-industrial-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 rounded-full transition-all duration-700"
                        style={{ width: `${selectedIndustry.sampleOee}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-industrial-900 border border-industrial-800 flex items-center justify-between text-xs">
                    <span className="text-industrial-400">Line Throughput:</span>
                    <span className="text-white font-bold">{selectedIndustry.throughput}</span>
                  </div>

                  <div className="p-3 rounded-lg bg-industrial-900 border border-industrial-800 flex items-center justify-between text-xs">
                    <span className="text-industrial-400">Driver Compatibility:</span>
                    <span className="text-brand-300 font-bold">Native OPC UA & Modbus</span>
                  </div>
                </div>

                <Link
                  to="/login"
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-brand-600/30 hover:bg-brand-500 transition-all"
                >
                  <span>Deploy {selectedIndustry.name} Line</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── REAL-TIME PROTOCOL DATA PIPELINE ANIMATION ─── */}
      <section className="py-20 border-b border-industrial-800 relative bg-industrial-950" id="pipeline">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400 bg-indigo-950/80 border border-indigo-500/30 px-3 py-1 rounded-full">
              End-to-End Edge Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              From Millivolt Sensor Signals to Global Executive OEE
            </h2>
            <p className="text-xs sm:text-sm text-industrial-400 font-sans">
              Multi-protocol ingestion without downtime. We connect into existing Siemens, Allen-Bradley, Beckhoff, and Mitsubishi PLCs without stopping active lines.
            </p>
          </div>

          {/* 4-Stage Horizontal Pipeline Flow */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono relative">

            {/* Stage 1: Field Devices & PLCs */}
            <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-5 space-y-3 relative group hover:border-brand-500/50 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-industrial-950 border border-industrial-700 text-brand-400">
                <Boxes className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400 block">
                01 • Physical Shop Floor
              </span>
              <h4 className="font-bold text-white text-sm">
                CNC & PLC Field Devices
              </h4>
              <p className="text-xs text-industrial-400 font-sans">
                Siemens S7, Allen-Bradley GuardLogix, Beckhoff TwinCAT, Fanuc 31i CNC, Omron Sysmac.
              </p>
              <div className="text-[10px] text-emerald-400 font-mono pt-2 border-t border-industrial-800">
                ✓ 100Hz Vibration Sensors
              </div>
            </div>

            {/* Stage 2: Edge Gateways */}
            <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-5 space-y-3 relative group hover:border-brand-500/50 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-industrial-950 border border-industrial-700 text-indigo-400">
                <Network className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
                02 • Edge Translation
              </span>
              <h4 className="font-bold text-white text-sm">
                Industrial Edge Gateways
              </h4>
              <p className="text-xs text-industrial-400 font-sans">
                Modbus TCP/RTU polling, OPC UA node discovery, MQTT Sparkplug B normalization.
              </p>
              <div className="text-[10px] text-indigo-400 font-mono pt-2 border-t border-industrial-800">
                ✓ Local Ring Buffer (Store & Fwd)
              </div>
            </div>

            {/* Stage 3: Real-Time Broker Engine */}
            <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-5 space-y-3 relative group hover:border-brand-500/50 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-industrial-950 border border-industrial-700 text-emerald-400">
                <Server className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                03 • Ingest Engine
              </span>
              <h4 className="font-bold text-white text-sm">
                FactoryPulse Neural Core
              </h4>
              <p className="text-xs text-industrial-400 font-sans">
                WebSocket event streaming, sub-second anomaly detection, dynamic OEE aggregation.
              </p>
              <div className="text-[10px] text-emerald-400 font-mono pt-2 border-t border-industrial-800">
                ✓ 42ms Average Ingest Latency
              </div>
            </div>

            {/* Stage 4: Glass Dashboard & Operator HUD */}
            <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-5 space-y-3 relative group hover:border-brand-500/50 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-industrial-950 border border-industrial-700 text-amber-400">
                <BarChart3 className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                04 • Governance & Actions
              </span>
              <h4 className="font-bold text-white text-sm">
                Role-Scoped Glass HUD
              </h4>
              <p className="text-xs text-industrial-400 font-sans">
                Live OEE, shift handover reports, maintenance work orders, machine controls.
              </p>
              <div className="text-[10px] text-amber-400 font-mono pt-2 border-t border-industrial-800">
                ✓ 6 Tailored RBAC Views
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── INTERACTIVE ROI & DOWNTIME REDUCTION CALCULATOR ─── */}
      <section className="py-20 border-b border-industrial-800 bg-industrial-900/40 relative" id="roi">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 rounded-full">
              Financial Impact Analysis
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              Calculate Your Plant's Projected Downtime ROI
            </h2>
            <p className="text-xs sm:text-sm text-industrial-400 font-sans">
              Adjust parameters based on your shop floor fleet to estimate annual cost savings achieved through predictive micro-stoppage prevention and vibration alerts.
            </p>
          </div>

          <div className="rounded-2xl border border-industrial-800 bg-industrial-900/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

              {/* Sliders Input Column */}
              <div className="lg:col-span-7 space-y-6 font-mono">

                {/* Slider 1: Machine Count */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-industrial-300 font-semibold uppercase">
                      Number of CNC & Production Machines:
                    </span>
                    <span className="text-brand-400 font-bold text-sm">
                      {machinesCount} Machines
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="150"
                    step="1"
                    value={machinesCount}
                    onChange={e => setMachinesCount(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer h-2 bg-industrial-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-industrial-500">
                    <span>5 Machines (Cell)</span>
                    <span>75 Machines</span>
                    <span>150 Machines (Enterprise)</span>
                  </div>
                </div>

                {/* Slider 2: Hourly Downtime Cost */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-industrial-300 font-semibold uppercase">
                      Average Cost of Unplanned Downtime:
                    </span>
                    <span className="text-emerald-400 font-bold text-sm">
                      ${downtimeCostPerHour.toLocaleString()} / Hour
                    </span>
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="8000"
                    step="100"
                    value={downtimeCostPerHour}
                    onChange={e => setDowntimeCostPerHour(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-2 bg-industrial-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-industrial-500">
                    <span>$500/hr (Light CNC)</span>
                    <span>$4,000/hr</span>
                    <span>$8,000/hr (Automotive Assembly)</span>
                  </div>
                </div>

                {/* Slider 3: Operating Shifts */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-industrial-300 font-semibold uppercase">
                      Daily Operating Shifts:
                    </span>
                    <span className="text-amber-400 font-bold text-sm">
                      {shiftsPerDay} Shifts ({shiftsPerDay * 8} Hours/Day)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    {[1, 2, 3].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setShiftsPerDay(s)}
                        className={`py-2 rounded-xl border text-center transition-all ${shiftsPerDay === s
                            ? 'bg-brand-600 border-brand-500 text-white font-bold'
                            : 'bg-industrial-950 border-industrial-800 text-industrial-400 hover:text-white'
                          }`}
                      >
                        {s} {s === 1 ? 'Shift (8h)' : s === 2 ? 'Shifts (16h)' : 'Shifts (24h continuous)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Real-Time Calculated ROI Projection */}
              <div className="lg:col-span-5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 sm:p-6 space-y-4 font-mono text-center sm:text-left">
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                  <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4" />
                    Projected Annual Financial Impact
                  </span>
                  <span className="text-[10px] text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded">
                    ISO 22400 Model
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400">
                    ${(totalAnnualBenefit / 1000).toFixed(0)}k
                  </div>
                  <p className="text-xs text-industrial-300">
                    Estimated Net Annual Operational Savings
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2">
                  <div className="p-2.5 rounded-lg bg-industrial-900/80 border border-industrial-800">
                    <div className="text-[10px] text-industrial-400">DOWNTIME AVOIDED</div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      {annualDowntimeHoursSaved} hrs/year
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-industrial-900/80 border border-industrial-800">
                    <div className="text-[10px] text-industrial-400">PROJECTED PAYBACK</div>
                    <div className="text-sm font-bold text-amber-300 mt-0.5">
                      {paybackDays} Days
                    </div>
                  </div>
                </div>

                <Link
                  to="/login"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-600/20 hover:from-emerald-500 hover:to-teal-500 transition-all"
                >
                  <span>Verify Numbers in Live Demo</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ROLE-BASED ACCESS & IEC 62443 CYBERSECURITY ARCHITECTURE ─── */}
      <section className="py-20 border-b border-industrial-800" id="architecture">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-brand-400 bg-brand-950/80 border border-brand-500/30 px-3 py-1 rounded-full">
              Zero-Trust Industrial Security
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              Strict Multi-Tenant Database Isolation & Granular RBAC
            </h2>
            <p className="text-xs sm:text-sm text-industrial-400 font-sans">
              Our 6 distinct user roles ensure absolute separation between SaaS platform administration, plant IT/OT network discovery, and machinist floor controls.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">

            {/* Role 1: Master Admin */}
            <div className="p-5 rounded-2xl border border-industrial-800 bg-industrial-900/70 space-y-3 hover:border-brand-500/50 transition-all">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-brand-950 border border-brand-500/30 text-brand-400">
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="text-[10px] text-brand-400 font-bold">PLATFORM OWNER</span>
              </div>
              <h4 className="font-bold text-white text-sm">SaaS Platform Owner</h4>
              <p className="text-industrial-400 font-sans text-xs">
                Tenant company provisioning, quota enforcement, and broker health. Strictly isolated from plant telemetry.
              </p>
              <div className="text-[10px] text-industrial-500 border-t border-industrial-800 pt-2">
                Scope: Multi-Tenant Cloud Platform
              </div>
            </div>

            {/* Role 2: Company Admin */}
            <div className="p-5 rounded-2xl border border-industrial-800 bg-industrial-900/70 space-y-3 hover:border-brand-500/50 transition-all">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-indigo-950 border border-indigo-500/30 text-indigo-400">
                  <Shield className="h-4 w-4" />
                </span>
                <span className="text-[10px] text-indigo-400 font-bold">EXECUTIVE</span>
              </div>
              <h4 className="font-bold text-white text-sm">Company Admin (VP Ops)</h4>
              <p className="text-industrial-400 font-sans text-xs">
                Entire fleet governance, plant topology, shift calendars, company user invitations, and enterprise OEE.
              </p>
              <div className="text-[10px] text-industrial-500 border-t border-industrial-800 pt-2">
                Scope: Enterprise Manufacturing Fleet
              </div>
            </div>

            {/* Role 3: Plant IT / OT */}
            <div className="p-5 rounded-2xl border border-industrial-800 bg-industrial-900/70 space-y-3 hover:border-brand-500/50 transition-all">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-teal-950 border border-teal-500/30 text-teal-400">
                  <Network className="h-4 w-4" />
                </span>
                <span className="text-[10px] text-teal-400 font-bold">OT & NETWORKS</span>
              </div>
              <h4 className="font-bold text-white text-sm">Plant IT / OT Lead</h4>
              <p className="text-industrial-400 font-sans text-xs">
                Subnet IP machine discovery, Modbus register mapping, and edge gateway socket diagnostics.
              </p>
              <div className="text-[10px] text-industrial-500 border-t border-industrial-800 pt-2">
                Scope: Edge Gateways & Field Networks
              </div>
            </div>

            {/* Role 4: Production Manager */}
            <div className="p-5 rounded-2xl border border-industrial-800 bg-industrial-900/70 space-y-3 hover:border-brand-500/50 transition-all">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-amber-950 border border-amber-500/30 text-amber-400">
                  <BarChart3 className="h-4 w-4" />
                </span>
                <span className="text-[10px] text-amber-400 font-bold">PRODUCTION</span>
              </div>
              <h4 className="font-bold text-white text-sm">Production Supervisor</h4>
              <p className="text-industrial-400 font-sans text-xs">
                Hourly throughput vs target quotas, micro-stoppage pareto analysis, and line OEE shift handovers.
              </p>
              <div className="text-[10px] text-industrial-500 border-t border-industrial-800 pt-2">
                Scope: Plant Production Lines
              </div>
            </div>

            {/* Role 5: Machine Operator */}
            <div className="p-5 rounded-2xl border border-industrial-800 bg-industrial-900/70 space-y-3 hover:border-brand-500/50 transition-all">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-emerald-950 border border-emerald-500/30 text-emerald-400">
                  <Gauge className="h-4 w-4" />
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">MACHINIST</span>
              </div>
              <h4 className="font-bold text-white text-sm">Machine Operator</h4>
              <p className="text-industrial-400 font-sans text-xs">
                Assigned cell workstation, live good parts/reject counters, machine remote controls (Start/Stop/Reset).
              </p>
              <div className="text-[10px] text-industrial-500 border-t border-industrial-800 pt-2">
                Scope: Assigned Workstation Controls
              </div>
            </div>

            {/* Role 6: Maintenance Engineer */}
            <div className="p-5 rounded-2xl border border-industrial-800 bg-industrial-900/70 space-y-3 hover:border-brand-500/50 transition-all">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-purple-950 border border-purple-500/30 text-purple-400">
                  <Wrench className="h-4 w-4" />
                </span>
                <span className="text-[10px] text-purple-400 font-bold">RELIABILITY</span>
              </div>
              <h4 className="font-bold text-white text-sm">Maintenance Lead</h4>
              <p className="text-industrial-400 font-sans text-xs">
                Vibration anomaly alerts, MTBF & MTTR metrics, preventive work orders, and PLC diagnostic codes.
              </p>
              <div className="text-[10px] text-industrial-500 border-t border-industrial-800 pt-2">
                Scope: Asset Health & Maintenance
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER CTA & GLOBAL CONNECTIVITY BAR ─── */}
      <footer className="bg-industrial-950 border-t border-industrial-800 py-12 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-industrial-800">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-md">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-base font-extrabold text-white">FactoryPulse</span>
                <span className="text-[10px] text-industrial-500 uppercase block">
                  Industrial IIoT 4.0 Platform
                </span>
              </div>
            </div>

            {/* Quick Links */}
            <div className="flex flex-wrap items-center gap-6 text-industrial-400">
              <a href="#simulator" className="hover:text-white transition-colors">Simulator HUD</a>
              <a href="#industries" className="hover:text-white transition-colors">6 Industries</a>
              <a href="#pipeline" className="hover:text-white transition-colors">Data Pipeline</a>
              <a href="#roi" className="hover:text-white transition-colors">ROI Calculator</a>
              <Link to="/login" className="text-brand-400 hover:text-brand-300 font-bold">Sign In to Portal →</Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-industrial-500 text-[11px]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>IEC 62443-4-1 Certified • Argon2id Hashed • Multi-Tenant DB Isolated</span>
            </div>
            <div>
              © 2026 FactoryPulse IIoT Platform. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
