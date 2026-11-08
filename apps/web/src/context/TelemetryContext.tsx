import React, { createContext, useContext, useState, useEffect } from 'react';
import { socketService } from '../services/socket.js';
import { useAuth } from './AuthContext.js';
import { api } from '../services/api.js';

export interface LiveTelemetryItem {
  machineId: string;
  assetId: string;
  name: string;
  state: string;
  lastTelemetryAt: string;
  goodCount: number;
  rejectCount: number;
  totalProcessedCount: number;
  rejectionRatePercent: number;
  cycleTimeSeconds: number;
  temperature?: number;
  vibration?: number;
  powerKw?: number;
  energyKwh?: number;
  voltageV?: number;
  currentA?: number;
  faultCode?: string;
  faultDescription?: string;
  oee?: {
    availability: number;
    performance: number;
    quality: number;
    oee: number;
  };
}

interface TelemetryContextType {
  telemetryMap: Record<string, LiveTelemetryItem>;
  latestAlert: any | null;
  activeAlertsCount: number;
  isConnected: boolean;
  isSimulatorActive: boolean;
  toggleSimulator: (forceState?: boolean) => Promise<void>;
  simulatorMode: 'SIMULATOR' | 'REAL_HARDWARE';
  lastHardwareNotification: string | null;
  dismissHardwareNotification: () => void;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [telemetryMap, setTelemetryMap] = useState<Record<string, LiveTelemetryItem>>({});
  const [latestAlert, setLatestAlert] = useState<any | null>(null);
  const [activeAlertsCount, setActiveAlertsCount] = useState<number>(2);
  const [isConnected, setIsConnected] = useState<boolean>(true);

  // Simulator Mode State: disabled, real hardware only
  const [isSimulatorActive, setIsSimulatorActive] = useState<boolean>(false);

  const [lastHardwareNotification, setLastHardwareNotification] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('fp_simulator_mode', 'off');
  }, []);

  const toggleSimulator = async (forceState?: boolean) => {
    const nextState = typeof forceState === 'boolean' ? forceState : !isSimulatorActive;
    setIsSimulatorActive(nextState);
    localStorage.setItem('fp_simulator_mode', nextState ? 'on' : 'off');

    try {
      const res = await api.toggleSimulator(nextState);
      if (res && res.connectedAssets) {
        setTelemetryMap(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(k => {
            const item = updated[k];
            if (nextState) {
              item.state = 'RUNNING';
            } else if (!res.connectedAssets.includes(item.assetId)) {
              item.state = 'OFFLINE';
              item.powerKw = 0;
            } else {
              item.state = 'RUNNING';
            }
          });
          return updated;
        });
      }
    } catch (err) {
      console.warn('Backend simulator toggle synced in local mode:', err);
    }

    if (!nextState) {
      setLastHardwareNotification(
        'Connected to Real Everything: Simulator disengaged. Only machines connected to real field hardware/PLCs are active; simulated assets set to OFFLINE.'
      );
    } else {
      setLastHardwareNotification(
        'Simulator Mode Active: Demo telemetry generation re-engaged.'
      );
    }
  };

  const dismissHardwareNotification = () => {
    setLastHardwareNotification(null);
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleTelemetryUpdate = (data: LiveTelemetryItem) => {
      setTelemetryMap(prev => ({
        ...prev,
        [data.machineId]: data
      }));
    };

    const handleWiseDiUpdate = (data: any) => {
      setTelemetryMap(prev => {
        const existing = prev[data.machineId];
        const good = data.goodCount ?? existing?.goodCount ?? 0;
        const reject = data.rejectCount ?? existing?.rejectCount ?? 0;
        const total = good + reject;
        const rate = total > 0 ? (reject / total) * 100 : 0;

        return {
          ...prev,
          [data.machineId]: {
            machineId: data.machineId,
            assetId: data.assetId || existing?.assetId || '',
            name: existing?.name || '',
            state: data.machineState || (data.connectionStatus === 'CONNECTED' ? 'RUNNING' : (existing?.state || 'OFFLINE')),
            lastTelemetryAt: data.timestamp || new Date().toISOString(),
            goodCount: good,
            rejectCount: reject,
            totalProcessedCount: total,
            rejectionRatePercent: Math.round(rate * 10) / 10,
            cycleTimeSeconds: existing?.cycleTimeSeconds || 10,
            temperature: existing?.temperature ?? 42.0,
            vibration: existing?.vibration ?? 1.1,
            powerKw: data.connectionStatus === 'CONNECTED' ? (existing?.powerKw || 24.5) : 0,
            energyKwh: existing?.energyKwh,
            voltageV: existing?.voltageV,
            currentA: existing?.currentA
          }
        };
      });
    };

    const handleNewAlert = (alert: any) => {
      setLatestAlert(alert);
      setActiveAlertsCount(prev => prev + 1);
    };

    const handleStateChanged = (payload: { machineId: string; state: string }) => {
      setTelemetryMap(prev => {
        const existing = prev[payload.machineId];
        if (!existing) return prev;
        return {
          ...prev,
          [payload.machineId]: {
            ...existing,
            state: payload.state,
            powerKw: payload.state === 'OFFLINE' ? 0 : existing.powerKw
          }
        };
      });
    };

    const handleSimulatorStatusChanged = (payload: { isSimulated: boolean; connectedMachineIds?: string[] }) => {
      setIsSimulatorActive(payload.isSimulated);
      localStorage.setItem('fp_simulator_mode', payload.isSimulated ? 'on' : 'off');

      if (!payload.isSimulated && payload.connectedMachineIds) {
        setTelemetryMap(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(k => {
            const item = updated[k];
            if (!payload.connectedMachineIds?.includes(item.assetId)) {
              item.state = 'OFFLINE';
              item.powerKw = 0;
            } else {
              item.state = 'RUNNING';
            }
          });
          return updated;
        });
      }
    };

    socketService.on('telemetry:update', handleTelemetryUpdate);
    socketService.on('wise:diUpdate', handleWiseDiUpdate);
    socketService.on('alert:new', handleNewAlert);
    socketService.on('machine:stateChanged', handleStateChanged);
    socketService.on('simulator:statusChanged', handleSimulatorStatusChanged);

    const interval = setInterval(() => {
      setIsConnected(socketService.getConnectionStatus());
    }, 2000);

    return () => {
      socketService.off('telemetry:update', handleTelemetryUpdate);
      socketService.off('wise:diUpdate', handleWiseDiUpdate);
      socketService.off('alert:new', handleNewAlert);
      socketService.off('machine:stateChanged', handleStateChanged);
      socketService.off('simulator:statusChanged', handleSimulatorStatusChanged);
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  return (
    <TelemetryContext.Provider
      value={{
        telemetryMap,
        latestAlert,
        activeAlertsCount,
        isConnected,
        isSimulatorActive,
        toggleSimulator,
        simulatorMode: isSimulatorActive ? 'SIMULATOR' : 'REAL_HARDWARE',
        lastHardwareNotification,
        dismissHardwareNotification
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
};

export const useTelemetry = () => {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
};
