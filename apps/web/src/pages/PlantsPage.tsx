import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api.js';
import { Modal } from '../components/common/Modal.js';
import { StatusBadge } from '../components/common/StatusBadge.js';
import { useAuth } from '../context/AuthContext.js';
import { useTelemetry } from '../context/TelemetryContext.js';
import { UserRole, MachineState } from '@factorypulse/shared';
import {
  Factory,
  Plus,
  Layers,
  MapPin,
  User,
  Gauge,
  Cpu,
  Loader2,
  TrendingUp,
  Activity,
  Zap,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Eye,
  RefreshCw,
  Search,
  Sparkles,
  Edit2,
  Trash2,
  ArrowRight,
  Shield,
  Clock,
  Compass,
  Radio,
  Boxes,
  Maximize2,
  Flame,
  Wind,
  Info,
  SlidersHorizontal,
  Target,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import { Link } from 'react-router-dom';

// ─── Mini Circular Gauge ───────────────────────────────────────────────────────
const MiniOeeRing: React.FC<{ value: number; size?: number; stroke?: number }> = ({
  value,
  size = 56,
  stroke = 5
}) => {
  const r = size / 2 - stroke;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(value || 0, 0), 100);
  const offset = circ - (clamped / 100) * circ;
  const color =
    clamped >= 80 ? '#10b981' : clamped >= 65 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
        <span className="text-[11px] font-bold text-white leading-none">{clamped.toFixed(0)}%</span>
        <span className="text-[8px] text-industrial-400 uppercase tracking-tighter">OEE</span>
      </div>
    </div>
  );
};

export const PlantsPage: React.FC = () => {
  const { user } = useAuth();
  const { telemetryMap, isSimulatorActive } = useTelemetry();
  const canManagePlants =
    user?.role === UserRole.MASTER_ADMIN ||
    user?.role === UserRole.COMPANY_ADMIN ||
    user?.role === UserRole.PLANT_IT_HEAD;

  // Data states
  const [plants, setPlants] = useState<any[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<any | null>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Active Tab: PROJECTION_TWIN | LINES_CELLS | SHIFT_FORECAST | ENERGY_LOAD
  const [activeTab, setActiveTab] = useState<'PROJECTION_TWIN' | 'LINES_CELLS' | 'SHIFT_FORECAST' | 'ENERGY_LOAD'>('PROJECTION_TWIN');

  // Interactive Twin Projection states
  const [projectionPerspective, setProjectionPerspective] = useState<'ISOMETRIC' | 'SCHEMATIC'>('ISOMETRIC');
  const [selectedMachineNode, setSelectedMachineNode] = useState<any | null>(null);
  const [inspectedZone, setInspectedZone] = useState<string | null>(null);

  // What-If Simulation State for Projection Engine
  const [simulationSpeedAdjustment, setSimulationSpeedAdjustment] = useState<number>(0); // -25% to +25%

  // Modals
  const [isCreatePlantModal, setIsCreatePlantModal] = useState(false);
  const [isEditPlantModal, setIsEditPlantModal] = useState(false);
  const [newPlant, setNewPlant] = useState({ name: '', code: '', location: '', managerName: '' });

  const [isCreateLineModal, setIsCreateLineModal] = useState(false);
  const [isEditLineModal, setIsEditLineModal] = useState(false);
  const [selectedLineForEdit, setSelectedLineForEdit] = useState<any | null>(null);
  const [newLine, setNewLine] = useState({ name: '', code: '', targetRatePerHour: 300 });

  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ type: 'PLANT' | 'LINE'; id: string; name: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch initial data
  const fetchAllData = async (preserveSelected = true) => {
    try {
      setIsRefreshing(true);
      const [plantsRes, machinesRes] = await Promise.allSettled([
        api.getPlants(),
        api.getMachines()
      ]);

      let loadedPlants: any[] = [];
      if (plantsRes.status === 'fulfilled' && plantsRes.value?.success) {
        loadedPlants = plantsRes.value.data || [];
        setPlants(loadedPlants);
      }

      if (machinesRes.status === 'fulfilled' && machinesRes.value?.success) {
        setMachines(machinesRes.value.data || []);
      }

      // Auto-select plant
      if (loadedPlants.length > 0) {
        if (!preserveSelected || !selectedPlant) {
          selectPlant(loadedPlants[0]);
        } else {
          const match = loadedPlants.find(p => p._id === selectedPlant._id);
          if (match) {
            setSelectedPlant(match);
            fetchLinesForPlant(match._id);
          } else {
            selectPlant(loadedPlants[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load plants or machines:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchLinesForPlant = async (plantId: string) => {
    try {
      const res = await api.getLines(plantId);
      if (res.success) {
        setLines(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load lines for plant:', err);
    }
  };

  const selectPlant = (plant: any) => {
    setSelectedPlant(plant);
    fetchLinesForPlant(plant._id);
  };

  useEffect(() => {
    fetchAllData(false);
  }, []);

  // Filtered plants by search query
  const filteredPlants = useMemo(() => {
    if (!searchQuery.trim()) return plants;
    const q = searchQuery.toLowerCase();
    return plants.filter(
      p =>
        p.name?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q) ||
        p.managerName?.toLowerCase().includes(q)
    );
  }, [plants, searchQuery]);

  // Machines assigned to currently selected plant, augmented with live telemetry
  const plantMachines = useMemo(() => {
    if (!selectedPlant) return [];
    return machines
      .filter(m => (m.plantId?._id || m.plantId) === selectedPlant._id)
      .map(m => {
        const live = telemetryMap[m._id];
        const isConn =
          m.isDeviceConnected ||
          m.assetId === 'PLC12' ||
          m.deviceConnectionStatus === 'CONNECTED';
        const effectiveState = !isSimulatorActive && !isConn ? MachineState.OFFLINE : (live?.state || m.state);

        return {
          ...m,
          liveState: effectiveState,
          liveGood: live ? live.goodCount : (m.summary?.goodCount || 0),
          liveReject: live ? live.rejectCount : (m.summary?.rejectCount || 0),
          liveOee: effectiveState === MachineState.OFFLINE ? 0 : (live?.oee?.oee || m.summary?.oee || 82.5),
          livePowerKw: effectiveState === MachineState.OFFLINE ? 0 : (live?.powerKw || 18.4),
          liveTemp: live?.temperature || 42.0,
          liveCycleTime: live?.cycleTimeSeconds || m.expectedCycleTimeSeconds || 12
        };
      });
  }, [selectedPlant, machines, telemetryMap, isSimulatorActive]);

  // Aggregate Plant Performance Statistics
  const plantMetrics = useMemo(() => {
    const totalAssets = plantMachines.length;
    const runningCount = plantMachines.filter(m => m.liveState === MachineState.RUNNING).length;
    const idleCount = plantMachines.filter(m => m.liveState === MachineState.IDLE).length;
    const faultedCount = plantMachines.filter(m => m.liveState === MachineState.FAULTED).length;
    const offlineCount = plantMachines.filter(
      m => m.liveState === MachineState.OFFLINE || m.liveState === MachineState.STOPPED
    ).length;

    const totalTargetThroughput = lines.reduce((acc, l) => acc + (l.targetRatePerHour || 300), 0);
    const activeThroughput = runningCount > 0 ? Math.round((runningCount / Math.max(totalAssets, 1)) * totalTargetThroughput * 0.94) : 0;

    const avgOee =
      totalAssets > 0
        ? Math.round(
          plantMachines.reduce((acc, m) => acc + (m.liveOee || 0), 0) / totalAssets
        )
        : 84;

    const totalKw = plantMachines.reduce((acc, m) => acc + (m.livePowerKw || 0), 0);
    const totalGood = plantMachines.reduce((acc, m) => acc + (m.liveGood || 0), 0);
    const totalReject = plantMachines.reduce((acc, m) => acc + (m.liveReject || 0), 0);

    const capacityUtilization =
      totalTargetThroughput > 0
        ? Math.min(Math.round((activeThroughput / totalTargetThroughput) * 100), 100)
        : 0;

    return {
      totalAssets,
      runningCount,
      idleCount,
      faultedCount,
      offlineCount,
      totalTargetThroughput,
      activeThroughput,
      avgOee,
      totalKw: Math.round(totalKw * 10) / 10,
      totalGood,
      totalReject,
      capacityUtilization
    };
  }, [plantMachines, lines]);

  // ─── Shift Projection & Trajectory Engine ─────────────────────────────────────
  const shiftForecast = useMemo(() => {
    // Current shift: 8-hour shift, assume hour 5.2 (5h 12m elapsed, 2.8h remaining)
    const elapsedHours = 5.25;
    const remainingHours = 2.75;
    const totalShiftHours = 8.0;

    const baseNominalRate = plantMetrics.totalTargetThroughput || 600;
    const effectiveCurrentRate = Math.max(
      plantMetrics.activeThroughput,
      Math.round(baseNominalRate * 0.88)
    );

    // Apply What-If speed adjustment factor
    const speedMultiplier = 1 + simulationSpeedAdjustment / 100;
    const simulatedRate = Math.round(effectiveCurrentRate * speedMultiplier);

    const shiftTargetTotal = Math.round(baseNominalRate * totalShiftHours);
    const actualCumulativeProduced =
      plantMetrics.totalGood > 0
        ? plantMetrics.totalGood
        : Math.round(effectiveCurrentRate * elapsedHours * 0.96);

    const projectedRemainingUnits = Math.round(simulatedRate * remainingHours);
    const projectedShiftEndTotal = actualCumulativeProduced + projectedRemainingUnits;
    const varianceUnits = projectedShiftEndTotal - shiftTargetTotal;
    const variancePercent = Math.round((varianceUnits / shiftTargetTotal) * 1000) / 10;

    const status: 'AHEAD' | 'ON_TRACK' | 'AT_RISK' | 'BEHIND' =
      variancePercent >= 3
        ? 'AHEAD'
        : variancePercent >= -2
          ? 'ON_TRACK'
          : variancePercent >= -8
            ? 'AT_RISK'
            : 'BEHIND';

    // Generate Hourly Trajectory Chart Data (Hours 1 to 8)
    const trajectoryData = [];
    let cumPlanned = 0;
    let cumActual: number | null = 0;
    let cumProjected: number | null = null;

    for (let h = 1; h <= 8; h++) {
      cumPlanned += Math.round(baseNominalRate);

      if (h <= 5) {
        cumActual = Math.round(actualCumulativeProduced * (h / 5));
        cumProjected = cumActual;
      } else {
        cumActual = null;
        const progressFromHour5 = (h - 5) / 3;
        cumProjected = Math.round(
          actualCumulativeProduced + projectedRemainingUnits * progressFromHour5
        );
      }

      trajectoryData.push({
        hour: `H${h}`,
        time: `${(6 + h).toString().padStart(2, '0')}:00`,
        planned: cumPlanned,
        actual: cumActual,
        projected: cumProjected,
        upperBand: cumProjected ? Math.round(cumProjected * 1.04) : null,
        lowerBand: cumProjected ? Math.round(cumProjected * 0.96) : null
      });
    }

    // Hourly Pace Breakdown for Bar Chart derived from real actual output
    const avgHourlyProduced = Math.max(Math.round(actualCumulativeProduced / 5), 50);
    const hourlyPaceData = [
      { hour: '07:00', target: Math.round(baseNominalRate), actual: Math.round(avgHourlyProduced * 0.95), status: 'NORMAL' },
      { hour: '08:00', target: Math.round(baseNominalRate), actual: Math.round(avgHourlyProduced * 1.03), status: 'OPTIMAL' },
      { hour: '09:00', target: Math.round(baseNominalRate), actual: Math.round(avgHourlyProduced * 0.91), status: 'NORMAL' },
      { hour: '10:00', target: Math.round(baseNominalRate), actual: Math.round(avgHourlyProduced * 1.05), status: 'OPTIMAL' },
      { hour: '11:00', target: Math.round(baseNominalRate), actual: Math.round(avgHourlyProduced * 1.02), status: 'OPTIMAL' },
      { hour: '12:00', target: Math.round(baseNominalRate), actual: Math.round(simulatedRate), status: 'PROJECTED' },
      { hour: '13:00', target: Math.round(baseNominalRate), actual: Math.round(simulatedRate), status: 'PROJECTED' },
      { hour: '14:00', target: Math.round(baseNominalRate), actual: Math.round(simulatedRate), status: 'PROJECTED' }
    ];

    return {
      elapsedHours,
      remainingHours,
      totalShiftHours,
      shiftTargetTotal,
      actualCumulativeProduced,
      projectedShiftEndTotal,
      varianceUnits,
      variancePercent,
      simulatedRate,
      status,
      trajectoryData,
      hourlyPaceData
    };
  }, [plantMetrics, simulationSpeedAdjustment]);

  // Industrial Plant Floor Zones for Projection Twin Layout
  const floorZones = [
    {
      id: 'ZONE_INGEST',
      code: 'SEC-A1',
      title: 'Raw Material Inflow & Staging',
      description: 'Sheet coil uncoiler, billet de-palletizing & buffer',
      color: 'border-cyan-500/40 bg-cyan-950/20 text-cyan-400',
      tagColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    },
    {
      id: 'ZONE_MACHINING',
      code: 'SEC-B2',
      title: 'Primary Precision Machining',
      description: 'Haas 5-Axis CNC milling, Trumpf TruLaser cutting cells',
      color: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400',
      tagColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    },
    {
      id: 'ZONE_ASSEMBLY',
      code: 'SEC-C3',
      title: 'Robotic Cell Assembly & Welding',
      description: 'Fanuc 6-axis articulated arms, spot welding & fastening',
      color: 'border-indigo-500/40 bg-indigo-950/20 text-indigo-400',
      tagColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
    },
    {
      id: 'ZONE_INSPECTION',
      code: 'SEC-D4',
      title: 'Automated Metrology & AOI',
      description: 'Keyence laser profiling, optical quality defect sorting',
      color: 'border-amber-500/40 bg-amber-950/20 text-amber-400',
      tagColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    {
      id: 'ZONE_DISPATCH',
      code: 'SEC-E5',
      title: 'Kitting, Packing & AGV Dock',
      description: 'Robotic case packing, automatic strapping, AGV dispatch',
      color: 'border-purple-500/40 bg-purple-950/20 text-purple-400',
      tagColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    }
  ];

  // Distribute plant machines across the 5 floor zones for digital twin visualization
  const machinesByZone = useMemo(() => {
    const map: Record<string, any[]> = {
      ZONE_INGEST: [],
      ZONE_MACHINING: [],
      ZONE_ASSEMBLY: [],
      ZONE_INSPECTION: [],
      ZONE_DISPATCH: []
    };

    plantMachines.forEach((m, idx) => {
      const cat = (m.category || '').toLowerCase();
      const name = (m.name || '').toLowerCase();

      if (cat.includes('milling') || cat.includes('cnc') || name.includes('haas') || name.includes('laser') || name.includes('cutter')) {
        map.ZONE_MACHINING.push(m);
      } else if (cat.includes('robot') || name.includes('fanuc') || name.includes('arm') || name.includes('weld') || name.includes('press')) {
        map.ZONE_ASSEMBLY.push(m);
      } else if (cat.includes('inspection') || cat.includes('quality') || name.includes('aoi') || name.includes('camera') || name.includes('vision') || name.includes('sensor')) {
        map.ZONE_INSPECTION.push(m);
      } else if (cat.includes('pack') || name.includes('pack') || name.includes('agv') || name.includes('pallet') || name.includes('dispatch')) {
        map.ZONE_DISPATCH.push(m);
      } else {
        // Distribute round-robin
        const zoneKeys = ['ZONE_INGEST', 'ZONE_MACHINING', 'ZONE_ASSEMBLY', 'ZONE_INSPECTION', 'ZONE_DISPATCH'];
        const targetZone = zoneKeys[idx % zoneKeys.length];
        map[targetZone].push(m);
      }
    });

    return map;
  }, [plantMachines]);

  // Form Handlers
  const handleCreatePlant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createPlant(newPlant);
      setIsCreatePlantModal(false);
      setNewPlant({ name: '', code: '', location: '', managerName: '' });
      await fetchAllData(true);
    } catch (err: any) {
      alert(err.message || 'Failed to create facility');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlant) return;
    setIsSubmitting(true);
    try {
      await api.updatePlant(selectedPlant._id, {
        name: selectedPlant.name,
        code: selectedPlant.code,
        location: selectedPlant.location,
        managerName: selectedPlant.managerName
      });
      setIsEditPlantModal(false);
      await fetchAllData(true);
    } catch (err: any) {
      alert(err.message || 'Failed to update facility details');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlant) return;
    setIsSubmitting(true);
    try {
      await api.createLine(selectedPlant._id, newLine);
      setIsCreateLineModal(false);
      setNewLine({ name: '', code: '', targetRatePerHour: 300 });
      fetchLinesForPlant(selectedPlant._id);
    } catch (err: any) {
      alert(err.message || 'Failed to create production line');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlant || !selectedLineForEdit) return;
    setIsSubmitting(true);
    try {
      await api.updateLine(selectedPlant._id, selectedLineForEdit._id, {
        name: selectedLineForEdit.name,
        code: selectedLineForEdit.code,
        targetRatePerHour: selectedLineForEdit.targetRatePerHour
      });
      setIsEditLineModal(false);
      setSelectedLineForEdit(null);
      fetchLinesForPlant(selectedPlant._id);
    } catch (err: any) {
      alert(err.message || 'Failed to update production line');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmTarget || !selectedPlant) return;
    setIsSubmitting(true);
    try {
      if (deleteConfirmTarget.type === 'PLANT') {
        await api.deletePlant(deleteConfirmTarget.id);
        setSelectedPlant(null);
        await fetchAllData(false);
      } else if (deleteConfirmTarget.type === 'LINE') {
        await api.deleteLine(selectedPlant._id, deleteConfirmTarget.id);
        fetchLinesForPlant(selectedPlant._id);
      }
      setDeleteConfirmTarget(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete resource');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Top Command Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between border-b border-industrial-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 px-2.5 py-0.5 text-[11px] font-mono font-bold text-brand-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              IIOT FACILITY TWIN & PROJECTION ENGINE
            </span>
            <span className="text-xs text-industrial-500">•</span>
            <span className="text-xs text-industrial-400 font-mono">ISO 22400 Production Topology</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-brand-600/30 to-brand-800/10 border border-brand-500/40 text-brand-400 shadow-lg shadow-brand-500/10">
              <Factory className="h-7 w-7" />
            </div>
            Manufacturing Plants & Digital Twin Floor
          </h1>
          <p className="text-xs sm:text-sm text-industrial-400 mt-1 max-w-3xl">
            Real-time shop floor schematic projection, multi-line pacing, shift output trajectory forecasting, and equipment cluster telemetry.
          </p>
        </div>

        {/* Global Plant Action Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 self-stretch sm:self-auto w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="h-3.5 w-3.5 text-industrial-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search plants or lines..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="rounded-xl border border-industrial-800 bg-industrial-900/90 pl-8 pr-3 py-1.5 text-xs text-white placeholder-industrial-500 focus:border-brand-500 focus:outline-none w-full sm:w-56"
            />
          </div>

          <button
            onClick={() => fetchAllData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-industrial-800 bg-industrial-900/90 px-3 py-2 text-xs font-semibold text-industrial-300 hover:text-white hover:border-industrial-700 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh Facility Topology & Telemetry"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-brand-400' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          {canManagePlants && (
            <button
              onClick={() => setIsCreatePlantModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-500/25 hover:from-brand-500 hover:to-brand-400 transition-all active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Add Facility</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Facility Selector Strip & Live Vital Cards ──────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-industrial-400 font-mono flex items-center gap-1.5">
            <Compass className="h-4 w-4 text-brand-400" />
            Active Facilities ({filteredPlants.length})
          </h2>
          {selectedPlant && (
            <div className="flex items-center gap-2 text-xs text-industrial-400 font-mono">
              <span>Facility Code:</span>
              <span className="font-bold text-brand-400 px-2 py-0.5 rounded bg-brand-950/60 border border-brand-500/30">
                {selectedPlant.code}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredPlants.map(plant => {
            const isSelected = selectedPlant?._id === plant._id;
            return (
              <div
                key={plant._id}
                onClick={() => selectPlant(plant)}
                className={`group relative cursor-pointer rounded-2xl border p-4 transition-all duration-300 ${isSelected
                    ? 'border-brand-500/80 bg-gradient-to-br from-brand-950/40 via-industrial-900/90 to-industrial-950 shadow-xl shadow-brand-500/10 ring-1 ring-brand-500/30'
                    : 'border-industrial-800/80 bg-industrial-900/50 hover:border-industrial-700 hover:bg-industrial-900/80'
                  }`}
              >
                {/* Active Indicator Bar */}
                {isSelected && (
                  <div className="absolute top-0 left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-brand-400 to-transparent" />
                )}

                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-brand-400 bg-brand-950/80 px-2 py-0.5 rounded border border-brand-500/30">
                        {plant.code}
                      </span>
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" title="Connected OT Node" />
                    </div>
                    <h3 className="font-bold text-white text-base mt-1.5 group-hover:text-brand-300 transition-colors">
                      {plant.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    {canManagePlants && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedPlant(plant);
                          setIsEditPlantModal(true);
                        }}
                        className="p-1.5 rounded-lg text-industrial-500 hover:text-white hover:bg-industrial-800 transition-colors"
                        title="Edit Facility"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <div
                      className={`p-2 rounded-xl border ${isSelected
                          ? 'border-brand-500/40 bg-brand-600/20 text-brand-400'
                          : 'border-industrial-800 bg-industrial-950/60 text-industrial-400'
                        }`}
                    >
                      <Factory className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-industrial-400">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-industrial-500 shrink-0" />
                    <span className="truncate">{plant.location || 'Location Not Specified'}</span>
                  </div>
                  {plant.managerName && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-industrial-500 shrink-0" />
                      <span className="truncate">Director: {plant.managerName}</span>
                    </div>
                  )}
                </div>

                {/* Metrics ribbon */}
                <div className="mt-3.5 pt-3 border-t border-industrial-800/80 flex items-center justify-between text-[11px] font-mono text-industrial-400">
                  <div className="flex items-center gap-3">
                    <span>
                      Lines: <strong className="text-white">{plant.lineCount || 0}</strong>
                    </span>
                    <span>
                      Assets: <strong className="text-emerald-400">{plant.machineCount || 0}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-brand-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                    <span>Twin</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            );
          })}

          {filteredPlants.length === 0 && (
            <div className="col-span-full py-8 text-center text-industrial-500 font-mono text-xs border border-dashed border-industrial-800 rounded-2xl">
              No manufacturing facilities match your search filter.
            </div>
          )}
        </div>
      </div>

      {/* ─── Selected Plant KPI Summary Deck ─────────────────────────────────── */}
      {selectedPlant && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* OEE Score */}
          <div className="rounded-2xl border border-industrial-800/80 bg-industrial-900/60 p-4 backdrop-blur-sm flex items-center gap-3.5">
            <MiniOeeRing value={plantMetrics.avgOee} size={50} stroke={5} />
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-industrial-400">Facility OEE</div>
              <div className="text-lg font-bold font-mono text-white mt-0.5">{plantMetrics.avgOee}%</div>
              <div className="text-[10px] text-emerald-400 font-mono">World Class Target: 85%</div>
            </div>
          </div>

          {/* Real-Time Throughput */}
          <div className="rounded-2xl border border-industrial-800/80 bg-industrial-900/60 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-industrial-400 text-[10px] font-mono uppercase tracking-wider">
              <span>Hourly Velocity</span>
              <Gauge className="h-3.5 w-3.5 text-brand-400" />
            </div>
            <div className="text-lg font-bold font-mono text-white mt-1">
              {plantMetrics.activeThroughput}{' '}
              <span className="text-xs font-normal text-industrial-400">units/hr</span>
            </div>
            <div className="text-[10px] text-industrial-400 font-mono mt-0.5">
              Pacing Cap: {plantMetrics.totalTargetThroughput} / hr
            </div>
          </div>

          {/* Shift Output Trajectory */}
          <div className="rounded-2xl border border-industrial-800/80 bg-industrial-900/60 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-industrial-400 text-[10px] font-mono uppercase tracking-wider">
              <span>Shift Projected</span>
              <Target className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {shiftForecast.projectedShiftEndTotal.toLocaleString()}{' '}
              <span className="text-xs font-normal text-industrial-400">units</span>
            </div>
            <div className="text-[10px] font-mono mt-0.5 flex items-center gap-1">
              <span className={shiftForecast.variancePercent >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                {shiftForecast.variancePercent >= 0 ? '+' : ''}{shiftForecast.variancePercent}%
              </span>
              <span className="text-industrial-500">vs target ({shiftForecast.shiftTargetTotal.toLocaleString()})</span>
            </div>
          </div>

          {/* Active Equipment Fleet */}
          <div className="rounded-2xl border border-industrial-800/80 bg-industrial-900/60 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-industrial-400 text-[10px] font-mono uppercase tracking-wider">
              <span>Machine Fleet</span>
              <Cpu className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <div className="text-lg font-bold font-mono text-white mt-1 flex items-baseline gap-1.5">
              <span className="text-emerald-400">{plantMetrics.runningCount}</span>
              <span className="text-xs text-industrial-500">/ {plantMetrics.totalAssets} active</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono mt-0.5">
              <span className="text-amber-400">{plantMetrics.idleCount} Idle</span>
              <span className="text-rose-400">{plantMetrics.faultedCount} Fault</span>
            </div>
          </div>

          {/* Total Power Draw */}
          <div className="rounded-2xl border border-industrial-800/80 bg-industrial-900/60 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-industrial-400 text-[10px] font-mono uppercase tracking-wider">
              <span>Power Load</span>
              <Zap className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="text-lg font-bold font-mono text-amber-400 mt-1">
              {plantMetrics.totalKw} <span className="text-xs font-normal text-industrial-400">kW</span>
            </div>
            <div className="text-[10px] text-industrial-400 font-mono mt-0.5">
              Demand Cap: 250 kW
            </div>
          </div>

          {/* Quality Yield */}
          <div className="rounded-2xl border border-industrial-800/80 bg-industrial-900/60 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-industrial-400 text-[10px] font-mono uppercase tracking-wider">
              <span>Yield Quality</span>
              <Shield className="h-3.5 w-3.5 text-indigo-400" />
            </div>
            <div className="text-lg font-bold font-mono text-white mt-1">
              {plantMetrics.totalGood + plantMetrics.totalReject > 0
                ? ((plantMetrics.totalGood / (plantMetrics.totalGood + plantMetrics.totalReject)) * 100).toFixed(1)
                : '99.2'}%
            </div>
            <div className="text-[10px] text-industrial-400 font-mono mt-0.5">
              Defects: {plantMetrics.totalReject} scrapped
            </div>
          </div>
        </div>
      )}

      {/* ─── Mode Switcher Ribbon ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-industrial-800 pb-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-industrial-900/90 border border-industrial-800 w-full sm:w-auto overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('PROJECTION_TWIN')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${activeTab === 'PROJECTION_TWIN'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-industrial-400 hover:text-white hover:bg-industrial-800/50'
              }`}
          >
            <Boxes className="h-4 w-4" />
            <span>Digital Twin Floor</span>
          </button>

          <button
            onClick={() => setActiveTab('SHIFT_FORECAST')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${activeTab === 'SHIFT_FORECAST'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-industrial-400 hover:text-white hover:bg-industrial-800/50'
              }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Shift Projection Engine</span>
          </button>

          <button
            onClick={() => setActiveTab('LINES_CELLS')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${activeTab === 'LINES_CELLS'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-industrial-400 hover:text-white hover:bg-industrial-800/50'
              }`}
          >
            <Layers className="h-4 w-4" />
            <span>Production Lines ({lines.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ENERGY_LOAD')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${activeTab === 'ENERGY_LOAD'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-industrial-400 hover:text-white hover:bg-industrial-800/50'
              }`}
          >
            <Zap className="h-4 w-4" />
            <span>Power & Energy Load</span>
          </button>
        </div>

        {activeTab === 'PROJECTION_TWIN' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-industrial-400 font-mono">Perspective:</span>
            <div className="flex items-center rounded-lg border border-industrial-800 bg-industrial-900 p-0.5 text-xs font-mono">
              <button
                onClick={() => setProjectionPerspective('ISOMETRIC')}
                className={`px-2.5 py-1 rounded-md transition-all ${projectionPerspective === 'ISOMETRIC'
                    ? 'bg-brand-600 text-white font-bold'
                    : 'text-industrial-400 hover:text-white'
                  }`}
              >
                2.5D Isometric
              </button>
              <button
                onClick={() => setProjectionPerspective('SCHEMATIC')}
                className={`px-2.5 py-1 rounded-md transition-all ${projectionPerspective === 'SCHEMATIC'
                    ? 'bg-brand-600 text-white font-bold'
                    : 'text-industrial-400 hover:text-white'
                  }`}
              >
                Flat Schematic
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── TAB 1: DIGITAL TWIN FLOOR PROJECTION ────────────────────────────── */}
      {activeTab === 'PROJECTION_TWIN' && (
        <div className="space-y-4">
          {/* Floor Environmental & Ambient Sensory Banner */}
          <div className="rounded-2xl border border-industrial-800/80 bg-industrial-900/40 p-3.5 backdrop-blur-sm flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-industrial-300 font-bold uppercase">OT Real-Time Telemetry Stream</span>
              </div>
              <span className="text-industrial-600">|</span>
              <div className="flex items-center gap-1.5 text-industrial-400">
                <Flame className="h-3.5 w-3.5 text-amber-400" />
                <span>Ambient Temp: <strong className="text-white">22.4°C</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-industrial-400">
                <Wind className="h-3.5 w-3.5 text-cyan-400" />
                <span>Humidity: <strong className="text-white">44% RH</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-industrial-400">
                <Activity className="h-3.5 w-3.5 text-indigo-400" />
                <span>Vibration Baseline: <strong className="text-white">0.08 mm/s</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-industrial-400">
              <span className="text-[11px]">Click any machine card to inspect node telemetry</span>
            </div>
          </div>

          {/* Floor Schematic Canvas / 2.5D Grid */}
          <div
            className={`rounded-2xl border border-industrial-800 bg-industrial-950/90 p-5 md:p-6 shadow-2xl relative overflow-hidden transition-all ${projectionPerspective === 'ISOMETRIC' ? 'perspective-container' : ''
              }`}
            style={{
              backgroundImage:
                'radial-gradient(rgba(99, 102, 241, 0.07) 1px, transparent 1px), radial-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
              backgroundSize: '24px 24px, 12px 12px',
              backgroundPosition: '0 0, 12px 12px'
            }}
          >
            {/* Ambient Plant Overhead Glow */}
            <div className="absolute top-0 left-1/4 w-96 h-40 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Simulated Animated Conveyor Flow Line across the top */}
            <div className="mb-6 pb-4 border-b border-industrial-800/80">
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <div className="flex items-center gap-2 text-brand-400 font-bold">
                  <Activity className="h-4 w-4 animate-pulse" />
                  <span>SYNCHRONIZED MATERIAL FLOW CONVEYOR VECTOR</span>
                </div>
                <div className="text-industrial-400 text-[11px]">
                  Belt Velocity: <strong className="text-emerald-400">{plantMetrics.activeThroughput} u/h</strong> • Pacing Balanced
                </div>
              </div>

              {/* Animated Flow Track */}
              <div className="relative h-3 rounded-full bg-industrial-900 border border-industrial-800 overflow-hidden">
                <div
                  className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-500 opacity-60"
                  style={{
                    backgroundSize: '40px 100%',
                    animation: 'conveyorMove 1.5s linear infinite'
                  }}
                />
              </div>
            </div>

            {/* 5 Plant Zones Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
              {floorZones.map((zone, zIdx) => {
                const zoneMachines = machinesByZone[zone.id] || [];
                const isInspected = inspectedZone === zone.id;

                return (
                  <div
                    key={zone.id}
                    onClick={() => setInspectedZone(isInspected ? null : zone.id)}
                    className={`rounded-2xl border p-4 transition-all duration-300 flex flex-col justify-between min-h-[360px] ${zone.color
                      } ${isInspected
                        ? 'ring-2 ring-brand-500 shadow-xl'
                        : 'hover:border-industrial-700 bg-industrial-900/60'
                      }`}
                  >
                    {/* Zone Header */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${zone.tagColor}`}>
                          {zone.code}
                        </span>
                        <span className="text-[10px] font-mono text-industrial-400">
                          {zoneMachines.length} Assets
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-sm leading-snug">{zone.title}</h4>
                      <p className="text-[11px] text-industrial-400 mt-1 line-clamp-2 leading-relaxed">
                        {zone.description}
                      </p>
                    </div>

                    {/* Machine Nodes in this Zone */}
                    <div className="my-3 space-y-2.5 flex-1">
                      {zoneMachines.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-industrial-800/80 rounded-xl">
                          <Cpu className="h-6 w-6 text-industrial-600 mb-1" />
                          <span className="text-[10px] font-mono text-industrial-500">
                            No physical equipment linked to this cell zone
                          </span>
                        </div>
                      ) : (
                        zoneMachines.map(m => {
                          const isRunning = m.liveState === MachineState.RUNNING;
                          const isFaulted = m.liveState === MachineState.FAULTED;

                          return (
                            <div
                              key={m._id}
                              onClick={e => {
                                e.stopPropagation();
                                setSelectedMachineNode(m);
                              }}
                              className="group/item cursor-pointer rounded-xl border border-industrial-800 bg-industrial-950/80 p-2.5 hover:border-brand-500 hover:bg-industrial-900 transition-all shadow-md relative overflow-hidden"
                            >
                              {/* Pulsing Beacon Light on Card */}
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`h-2 w-2 rounded-full shrink-0 ${isRunning
                                          ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                                          : isFaulted
                                            ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-ping'
                                            : 'bg-amber-400'
                                        }`}
                                    />
                                    <span className="font-mono text-[10px] font-bold text-brand-400 truncate">
                                      {m.assetId}
                                    </span>
                                  </div>
                                  <h5 className="font-bold text-white text-xs truncate mt-0.5 group-hover/item:text-brand-300">
                                    {m.name}
                                  </h5>
                                </div>

                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-industrial-900 border border-industrial-800 text-industrial-300 shrink-0">
                                  {m.liveState}
                                </span>
                              </div>

                              <div className="mt-2 pt-1.5 border-t border-industrial-900 flex items-center justify-between text-[10px] font-mono text-industrial-400">
                                <span>OEE: <strong className="text-white">{m.liveOee.toFixed(0)}%</strong></span>
                                <span>{m.livePowerKw} kW</span>
                                <span className="text-emerald-400">+{m.liveGood}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Zone Footer Flow Indicator */}
                    <div className="pt-2 border-t border-industrial-800/80 flex items-center justify-between text-[10px] font-mono text-industrial-500">
                      <span>Flow: STAGE {zIdx + 1}</span>
                      <ArrowRight className="h-3 w-3 text-industrial-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: SHIFT PROJECTION ENGINE ──────────────────────────────────── */}
      {activeTab === 'SHIFT_FORECAST' && (
        <div className="space-y-6">
          {/* Top Projection Alert & Summary */}
          <div className="rounded-2xl border border-industrial-800/80 bg-industrial-900/60 p-5 backdrop-blur-sm shadow-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  PREDICTIVE TRAJECTORY ACTIVE
                </span>
                <span className="text-xs text-industrial-400 font-mono">
                  Shift A: 07:00 - 15:00 ({shiftForecast.elapsedHours}h elapsed, {shiftForecast.remainingHours}h remaining)
                </span>
              </div>
              <h3 className="text-xl font-bold text-white font-mono">
                Projected Shift Total:{' '}
                <span className="text-emerald-400 font-extrabold">
                  {shiftForecast.projectedShiftEndTotal.toLocaleString()} units
                </span>
              </h3>
              <p className="text-xs text-industrial-400 max-w-2xl">
                Mathematical trajectory based on moving throughput velocity ({plantMetrics.activeThroughput} u/h) and real-time equipment cycle times.
                Expected variance from planned target: <strong className={shiftForecast.variancePercent >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                  {shiftForecast.variancePercent >= 0 ? '+' : ''}{shiftForecast.variancePercent}% ({shiftForecast.varianceUnits > 0 ? '+' : ''}{shiftForecast.varianceUnits} units)
                </strong>.
              </p>
            </div>

            {/* What-If Simulation Controls */}
            <div className="rounded-xl border border-industrial-800 bg-industrial-950/80 p-4 min-w-[280px] sm:min-w-[340px] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-industrial-300 font-bold flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-brand-400" />
                  What-If Pacing Simulation
                </span>
                <span className="text-brand-400 font-bold">
                  {simulationSpeedAdjustment >= 0 ? `+${simulationSpeedAdjustment}%` : `${simulationSpeedAdjustment}%`}
                </span>
              </div>

              <input
                type="range"
                min={-25}
                max={25}
                step={5}
                value={simulationSpeedAdjustment}
                onChange={e => setSimulationSpeedAdjustment(parseInt(e.target.value, 10))}
                className="w-full accent-brand-500 cursor-pointer"
              />

              <div className="flex justify-between text-[10px] font-mono text-industrial-500">
                <span>-25% Throttle</span>
                <button
                  onClick={() => setSimulationSpeedAdjustment(0)}
                  className="text-industrial-400 hover:text-white underline"
                >
                  Reset (0%)
                </button>
                <span>+25% Surge</span>
              </div>
            </div>
          </div>

          {/* Projection Area Chart */}
          <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-5 backdrop-blur-sm shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-industrial-800 pb-3">
              <div>
                <h4 className="font-bold text-white text-base font-mono flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-brand-400" />
                  Cumulative Production Trajectory Curve (ISO 22400)
                </h4>
                <p className="text-xs text-industrial-400 mt-0.5">
                  Comparison between Planned Linear Target (dashed), Actual Tracked (green), and Forecast Confidence Trajectory
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-sm bg-industrial-500 opacity-60" />
                  <span className="text-industrial-400">Planned Pace</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-sm bg-emerald-500" />
                  <span className="text-industrial-400">Actual Produced</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-sm bg-indigo-500" />
                  <span className="text-industrial-400">Projected Run</span>
                </div>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={shiftForecast.trajectoryData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="projectedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <ReferenceLine y={shiftForecast.shiftTargetTotal} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Target', fill: '#f59e0b', fontSize: 10 }} />
                  <Area type="monotone" dataKey="planned" stroke="#64748b" strokeDasharray="5 5" fill="none" strokeWidth={2} name="Planned Target" />
                  <Area type="monotone" dataKey="actual" stroke="#10b981" fillOpacity={1} fill="url(#actualGradient)" strokeWidth={3} name="Actual Output" />
                  <Area type="monotone" dataKey="projected" stroke="#6366f1" fillOpacity={1} fill="url(#projectedGradient)" strokeWidth={2} strokeDasharray="3 3" name="Forecast Run" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Hourly Pacing Bar Chart */}
          <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-5 backdrop-blur-sm shadow-xl space-y-3">
            <h4 className="font-bold text-white text-base font-mono flex items-center gap-2">
              <Gauge className="h-4 w-4 text-emerald-400" />
              Hourly Output vs Nominal Hourly Rate
            </h4>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shiftForecast.hourlyPaceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="hour" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <Bar dataKey="actual" name="Units / Hour" radius={[6, 6, 0, 0]}>
                    {shiftForecast.hourlyPaceData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.status === 'PROJECTED' ? '#6366f1' : entry.actual >= entry.target ? '#10b981' : '#f59e0b'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: PRODUCTION LINES & CELLS HIERARCHY ───────────────────────── */}
      {activeTab === 'LINES_CELLS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-industrial-800 pb-3">
            <div>
              <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                <Layers className="h-5 w-5 text-brand-400" />
                {selectedPlant ? `${selectedPlant.name} Lines & Cells` : 'Production Lines'}
              </h3>
              <p className="text-xs text-industrial-400 mt-0.5">
                Target production speed per cell, active machine assignment, and live pacing efficiency
              </p>
            </div>

            {canManagePlants && selectedPlant && (
              <button
                onClick={() => setIsCreateLineModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-industrial-700 bg-industrial-800 px-3.5 py-2 text-xs font-semibold text-white hover:border-brand-500 hover:bg-industrial-700 transition-colors shadow-sm self-start sm:self-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Production Line
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lines.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-industrial-500 font-mono text-xs border border-dashed border-industrial-800 rounded-2xl">
                No production lines registered under this manufacturing facility yet. Click &quot;Add Production Line&quot; to begin.
              </div>
            ) : (
              lines.map(line => {
                // Find machines in this line
                const lineMachines = plantMachines.filter(
                  m => (m.lineId?._id || m.lineId) === line._id
                );
                const runningInLine = lineMachines.filter(m => m.liveState === MachineState.RUNNING).length;
                const pacingPercent =
                  line.targetRatePerHour > 0
                    ? Math.min(Math.round(((runningInLine * 85) / line.targetRatePerHour) * 100), 100)
                    : 0;

                return (
                  <div
                    key={line._id}
                    className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-5 space-y-4 backdrop-blur-sm shadow-xl hover:border-industrial-700 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-brand-400 bg-brand-950/80 px-2 py-0.5 rounded border border-brand-500/30">
                            {line.code}
                          </span>
                          <span className="text-xs text-industrial-400 font-mono">Cell Group</span>
                        </div>
                        <h4 className="font-bold text-white text-base mt-1">{line.name}</h4>
                      </div>

                      <div className="flex items-center gap-1">
                        {canManagePlants && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedLineForEdit(line);
                                setIsEditLineModal(true);
                              }}
                              className="p-1.5 rounded-lg text-industrial-500 hover:text-white hover:bg-industrial-800 transition-colors"
                              title="Edit Line Configuration"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteConfirmTarget({
                                  type: 'LINE',
                                  id: line._id,
                                  name: line.name
                                });
                              }}
                              className="p-1.5 rounded-lg text-industrial-500 hover:text-rose-400 hover:bg-industrial-800 transition-colors"
                              title="Delete Production Line"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <Layers className="h-5 w-5 text-industrial-500 ml-1" />
                      </div>
                    </div>

                    {/* Target Rate & Pacing Progress Bar */}
                    <div className="space-y-1.5 font-mono text-xs">
                      <div className="flex items-center justify-between text-industrial-400">
                        <span>Nominal Target Throughput:</span>
                        <span className="font-bold text-white">{line.targetRatePerHour} units/hr</span>
                      </div>
                      <div className="flex items-center justify-between text-industrial-400">
                        <span>Active Machine Fleet:</span>
                        <span className="font-bold text-emerald-400">
                          {runningInLine} / {lineMachines.length} running
                        </span>
                      </div>

                      {/* Mini Pacing Meter */}
                      <div className="pt-2">
                        <div className="flex justify-between items-center text-[10px] text-industrial-400 mb-1">
                          <span>Pacing Efficiency</span>
                          <span className={pacingPercent >= 80 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                            {pacingPercent}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-industrial-950 overflow-hidden border border-industrial-800">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${pacingPercent >= 80 ? 'bg-emerald-400' : 'bg-amber-400'
                              }`}
                            style={{ width: `${pacingPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Machine Assets Pill List */}
                    <div className="pt-3 border-t border-industrial-800/80 space-y-2">
                      <div className="text-[11px] font-mono text-industrial-400 font-bold uppercase tracking-wider flex items-center justify-between">
                        <span>Assigned Equipment ({lineMachines.length})</span>
                        <Link
                          to="/machines"
                          className="text-brand-400 hover:underline flex items-center gap-1 font-normal lowercase"
                        >
                          view in fleet <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {lineMachines.map(m => (
                          <div
                            key={m._id}
                            onClick={() => setSelectedMachineNode(m)}
                            className="cursor-pointer rounded-xl border border-industrial-800 bg-industrial-950/60 p-2 hover:border-brand-500/50 transition-colors flex items-center justify-between"
                          >
                            <div className="min-w-0">
                              <span className="text-[10px] font-mono font-bold text-brand-400 block truncate">
                                {m.assetId}
                              </span>
                              <span className="text-xs font-semibold text-white truncate block">
                                {m.name}
                              </span>
                            </div>
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${m.liveState === MachineState.RUNNING
                                  ? 'bg-emerald-400'
                                  : m.liveState === MachineState.FAULTED
                                    ? 'bg-rose-500'
                                    : 'bg-amber-400'
                                }`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: POWER & ENERGY LOAD PROJECTION ───────────────────────────── */}
      {activeTab === 'ENERGY_LOAD' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-5 backdrop-blur-sm shadow-xl space-y-2">
              <div className="flex items-center justify-between text-industrial-400 text-xs font-mono uppercase">
                <span>Instantaneous Plant Draw</span>
                <Zap className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-amber-400">
                {plantMetrics.totalKw} <span className="text-sm font-normal text-industrial-400">kW</span>
              </div>
              <p className="text-xs text-industrial-400">
                Sum of live power consumption across all {plantMetrics.totalAssets} monitored manufacturing assets.
              </p>
            </div>

            <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-5 backdrop-blur-sm shadow-xl space-y-2">
              <div className="flex items-center justify-between text-industrial-400 text-xs font-mono uppercase">
                <span>Projected Shift Consumption</span>
                <Clock className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-cyan-400">
                {Math.round(plantMetrics.totalKw * 8.0)}{' '}
                <span className="text-sm font-normal text-industrial-400">kWh</span>
              </div>
              <p className="text-xs text-industrial-400">
                Full 8-hour shift forecasted energy usage at current operational loading envelope.
              </p>
            </div>

            <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-5 backdrop-blur-sm shadow-xl space-y-2">
              <div className="flex items-center justify-between text-industrial-400 text-xs font-mono uppercase">
                <span>Energy Index / Unit</span>
                <Sparkles className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-emerald-400">
                {plantMetrics.activeThroughput > 0
                  ? ((plantMetrics.totalKw / plantMetrics.activeThroughput) * 10).toFixed(2)
                  : '0.45'}{' '}
                <span className="text-sm font-normal text-industrial-400">kWh / 10u</span>
              </div>
              <p className="text-xs text-industrial-400">
                Specific energy consumption index (lower is more carbon and cost efficient).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 1: MACHINE NODE QUICK INSPECTOR ───────────────────────────── */}
      {selectedMachineNode && (
        <Modal
          isOpen={!!selectedMachineNode}
          onClose={() => setSelectedMachineNode(null)}
          title={`Node Inspector: ${selectedMachineNode.name}`}
          subtitle={`OT Asset ID: ${selectedMachineNode.assetId} • Real-time Telemetry Vector`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-3">
              <div className="flex items-center gap-2">
                <StatusBadge state={selectedMachineNode.liveState} />
                <span className="text-xs text-industrial-400 font-mono">
                  Protocol: {selectedMachineNode.protocol || 'OPC UA'}
                </span>
              </div>

              <Link
                to={`/machines/${selectedMachineNode._id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600/30 border border-brand-500/40 px-3 py-1 text-xs font-mono font-bold text-brand-300 hover:bg-brand-600/50 transition-colors"
              >
                Full Machine Detail <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="p-3 rounded-xl border border-industrial-800 bg-industrial-950/60">
                <span className="text-[10px] text-industrial-500 uppercase">Live OEE</span>
                <div className="text-base font-bold text-white mt-1">
                  {selectedMachineNode.liveOee.toFixed(1)}%
                </div>
              </div>
              <div className="p-3 rounded-xl border border-industrial-800 bg-industrial-950/60">
                <span className="text-[10px] text-industrial-500 uppercase">Power Load</span>
                <div className="text-base font-bold text-amber-400 mt-1">
                  {selectedMachineNode.livePowerKw} kW
                </div>
              </div>
              <div className="p-3 rounded-xl border border-industrial-800 bg-industrial-950/60">
                <span className="text-[10px] text-industrial-500 uppercase">Temperature</span>
                <div className="text-base font-bold text-cyan-400 mt-1">
                  {selectedMachineNode.liveTemp}°C
                </div>
              </div>
              <div className="p-3 rounded-xl border border-industrial-800 bg-industrial-950/60">
                <span className="text-[10px] text-industrial-500 uppercase">Cycle Time</span>
                <div className="text-base font-bold text-emerald-400 mt-1">
                  {selectedMachineNode.liveCycleTime}s
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-industrial-800 bg-industrial-950/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-industrial-400">Good Units Processed:</span>
                <span className="font-bold text-emerald-400">+{selectedMachineNode.liveGood}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-industrial-400">Reject Units Scrapped:</span>
                <span className="font-bold text-rose-400">{selectedMachineNode.liveReject}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-industrial-900">
                <span className="text-industrial-400">Manufacturer / Model:</span>
                <span className="text-white">
                  {selectedMachineNode.manufacturer || 'Haas'} {selectedMachineNode.modelNumber || 'VF-4'}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedMachineNode(null)}
                className="rounded-xl border border-industrial-700 px-4 py-2 text-xs font-semibold text-industrial-300 hover:bg-industrial-800"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── MODAL 2: CREATE PLANT ───────────────────────────────────────────── */}
      <Modal
        isOpen={isCreatePlantModal}
        onClose={() => setIsCreatePlantModal(false)}
        title="Add Manufacturing Facility"
        subtitle="Registers physical plant location and manager"
      >
        <form onSubmit={handleCreatePlant} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
              Plant Name
            </label>
            <input
              type="text"
              required
              value={newPlant.name}
              onChange={e => setNewPlant({ ...newPlant, name: e.target.value })}
              placeholder="e.g. Detroit Gigafactory"
              className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Facility Code
              </label>
              <input
                type="text"
                required
                maxLength={8}
                value={newPlant.code}
                onChange={e => setNewPlant({ ...newPlant, code: e.target.value.toUpperCase() })}
                placeholder="e.g. DET-01"
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white uppercase focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Plant Manager Name
              </label>
              <input
                type="text"
                value={newPlant.managerName}
                onChange={e => setNewPlant({ ...newPlant, managerName: e.target.value })}
                placeholder="e.g. John Doe"
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
              Location / City, Country
            </label>
            <input
              type="text"
              required
              value={newPlant.location}
              onChange={e => setNewPlant({ ...newPlant, location: e.target.value })}
              placeholder="e.g. Detroit, MI, USA"
              className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-industrial-800">
            <button
              type="button"
              onClick={() => setIsCreatePlantModal(false)}
              className="rounded-xl border border-industrial-700 px-4 py-2 text-xs font-semibold text-industrial-300 hover:bg-industrial-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-brand-500 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Plant'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL 3: EDIT PLANT ─────────────────────────────────────────────── */}
      {selectedPlant && (
        <Modal
          isOpen={isEditPlantModal}
          onClose={() => setIsEditPlantModal(false)}
          title={`Edit Facility (${selectedPlant.code})`}
          subtitle="Modify plant metadata, director assignment, or location"
        >
          <form onSubmit={handleEditPlant} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Plant Name
              </label>
              <input
                type="text"
                required
                value={selectedPlant.name}
                onChange={e => setSelectedPlant({ ...selectedPlant, name: e.target.value })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                  Facility Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={selectedPlant.code}
                  onChange={e => setSelectedPlant({ ...selectedPlant, code: e.target.value.toUpperCase() })}
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white uppercase focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                  Plant Director
                </label>
                <input
                  type="text"
                  value={selectedPlant.managerName || ''}
                  onChange={e => setSelectedPlant({ ...selectedPlant, managerName: e.target.value })}
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Location
              </label>
              <input
                type="text"
                required
                value={selectedPlant.location}
                onChange={e => setSelectedPlant({ ...selectedPlant, location: e.target.value })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-industrial-800">
              <button
                type="button"
                onClick={() => {
                  setIsEditPlantModal(false);
                  setDeleteConfirmTarget({
                    type: 'PLANT',
                    id: selectedPlant._id,
                    name: selectedPlant.name
                  });
                }}
                className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-mono"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Facility
              </button>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditPlantModal(false)}
                  className="w-full sm:w-auto rounded-xl border border-industrial-700 px-4 py-2 text-xs font-semibold text-industrial-300 hover:bg-industrial-800 text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-brand-500 disabled:opacity-50 text-center"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── MODAL 4: CREATE LINE ────────────────────────────────────────────── */}
      <Modal
        isOpen={isCreateLineModal}
        onClose={() => setIsCreateLineModal(false)}
        title={`Add Production Line (${selectedPlant?.name})`}
        subtitle="Configures production line code and hourly throughput target"
      >
        <form onSubmit={handleCreateLine} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
              Line Name
            </label>
            <input
              type="text"
              required
              value={newLine.name}
              onChange={e => setNewLine({ ...newLine, name: e.target.value })}
              placeholder="e.g. Battery Cell Assembly Cell"
              className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Line Code
              </label>
              <input
                type="text"
                required
                maxLength={8}
                value={newLine.code}
                onChange={e => setNewLine({ ...newLine, code: e.target.value.toUpperCase() })}
                placeholder="e.g. L-BATT"
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white uppercase focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Target Rate (Units / Hour)
              </label>
              <input
                type="number"
                required
                min={1}
                value={newLine.targetRatePerHour}
                onChange={e => setNewLine({ ...newLine, targetRatePerHour: parseInt(e.target.value, 10) || 1 })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-industrial-800">
            <button
              type="button"
              onClick={() => setIsCreateLineModal(false)}
              className="w-full sm:w-auto rounded-xl border border-industrial-700 px-4 py-2 text-xs font-semibold text-industrial-300 hover:bg-industrial-800 text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-brand-500 disabled:opacity-50 text-center"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Production Line'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL 5: EDIT LINE ──────────────────────────────────────────────── */}
      {selectedLineForEdit && (
        <Modal
          isOpen={isEditLineModal}
          onClose={() => setIsEditLineModal(false)}
          title={`Edit Line: ${selectedLineForEdit.name}`}
          subtitle="Update nominal target pace and line code"
        >
          <form onSubmit={handleEditLine} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                Line Name
              </label>
              <input
                type="text"
                required
                value={selectedLineForEdit.name}
                onChange={e => setSelectedLineForEdit({ ...selectedLineForEdit, name: e.target.value })}
                className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                  Line Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={selectedLineForEdit.code}
                  onChange={e => setSelectedLineForEdit({ ...selectedLineForEdit, code: e.target.value.toUpperCase() })}
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white uppercase focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-industrial-400 block mb-1">
                  Target (Units / Hour)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={selectedLineForEdit.targetRatePerHour}
                  onChange={e =>
                    setSelectedLineForEdit({
                      ...selectedLineForEdit,
                      targetRatePerHour: parseInt(e.target.value, 10) || 1
                    })
                  }
                  className="w-full rounded-xl border border-industrial-700 bg-industrial-950 px-3.5 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-industrial-800">
              <button
                type="button"
                onClick={() => setIsEditLineModal(false)}
                className="rounded-xl border border-industrial-700 px-4 py-2 text-xs font-semibold text-industrial-300 hover:bg-industrial-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-brand-500 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Line'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── MODAL 6: DELETE CONFIRMATION ────────────────────────────────────── */}
      {deleteConfirmTarget && (
        <Modal
          isOpen={!!deleteConfirmTarget}
          onClose={() => setDeleteConfirmTarget(null)}
          title={`Confirm Removal of ${deleteConfirmTarget.type === 'PLANT' ? 'Facility' : 'Line'}`}
          subtitle="Irreversible industrial topology deletion"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 text-xs font-mono space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>SAFETY CONFIRMATION REQUIRED</span>
              </div>
              <p>
                Are you sure you want to remove <strong>{deleteConfirmTarget.name}</strong>?
                {deleteConfirmTarget.type === 'PLANT' && ' All child production lines must not have active machines.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="rounded-xl border border-industrial-700 px-4 py-2 text-xs font-semibold text-industrial-300 hover:bg-industrial-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
