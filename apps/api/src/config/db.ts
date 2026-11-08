import mysql from 'mysql2/promise';
import { config } from './index.js';
import { logger } from '../logger.js';

let pool: mysql.Pool | null = null;
let isConnected = false;

export const TABLE_DEFINITIONS = [
  `CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    plan VARCHAR(20) DEFAULT 'PROFESSIONAL',
    maxMachines INT DEFAULT 50,
    maxUsers INT DEFAULT 20,
    contactEmail VARCHAR(255) NOT NULL,
    contactPhone VARCHAR(50),
    features JSON,
    settings JSON,
    createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_tenants_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    tenantId VARCHAR(36),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    passwordHash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    isActive BOOLEAN DEFAULT TRUE,
    mfaEnabled BOOLEAN DEFAULT FALSE,
    mfaSecret VARCHAR(255),
    assignedMachines JSON,
    refreshToken TEXT,
    lastLoginAt DATETIME(3),
    createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_users_tenant_role (tenantId, role)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS plants (
    id VARCHAR(36) PRIMARY KEY,
    tenantId VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    location VARCHAR(255) NOT NULL,
    managerName VARCHAR(255),
    createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_plants_tenant_code (tenantId, code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS production_lines (
    id VARCHAR(36) PRIMARY KEY,
    tenantId VARCHAR(36) NOT NULL,
    plantId VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    targetRatePerHour FLOAT DEFAULT 300,
    createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_lines_tenant_plant_code (tenantId, plantId, code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS gateways (
    id VARCHAR(36) PRIMARY KEY,
    tenantId VARCHAR(36) NOT NULL,
    plantId VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    gatewayKey VARCHAR(100) NOT NULL UNIQUE,
    ipAddress VARCHAR(50) DEFAULT '192.168.10.1',
    version VARCHAR(50) DEFAULT 'v2.4.0',
    protocolSupport JSON,
    status VARCHAR(20) DEFAULT 'ONLINE',
    lastSeenAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    metrics JSON,
    createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_gateways_tenant_plant (tenantId, plantId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS machines (
    id VARCHAR(36) PRIMARY KEY,
    assetId VARCHAR(100) NOT NULL,
    tenantId VARCHAR(36) NOT NULL,
    plantId VARCHAR(36) NOT NULL,
    lineId VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(100) NOT NULL,
    modelNumber VARCHAR(100) NOT NULL,
    serialNumber VARCHAR(100) NOT NULL,
    protocol VARCHAR(50) DEFAULT 'SIMULATOR',
    gatewayId VARCHAR(36),
    ipAddress VARCHAR(50),
    port INT,
    tagMappings JSON,
    digitalInputConfigs JSON,
    wiseConnectionSettings JSON,
    wiseDeviceStatus JSON,
    expectedCycleTimeSeconds FLOAT DEFAULT 10,
    plannedCapacityPerHour FLOAT DEFAULT 300,
    targetGoodQuantityPerShift FLOAT DEFAULT 2000,
    targetRejectionPercentage FLOAT DEFAULT 3.0,
    state VARCHAR(50) DEFAULT 'IDLE',
    isMonitored BOOLEAN DEFAULT TRUE,
    isSimulated BOOLEAN DEFAULT TRUE,
    isDeviceConnected BOOLEAN DEFAULT FALSE,
    deviceConnectionStatus VARCHAR(50) DEFAULT 'DISCONNECTED',
    isRealDevice BOOLEAN DEFAULT FALSE,
    simulatedDefaultState VARCHAR(50) DEFAULT 'RUNNING',
    connectedDeviceInfo JSON,
    lastHeartbeat DATETIME(3),
    lastTelemetryAt DATETIME(3),
    currentFaultCode VARCHAR(100),
    currentFaultDescription TEXT,
    isArchived BOOLEAN DEFAULT FALSE,
    createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_machines_tenant_asset (tenantId, assetId),
    INDEX idx_machines_tenant_line (tenantId, lineId),
    INDEX idx_machines_tenant_state (tenantId, state),
    INDEX idx_machines_tenant_archived (tenantId, isArchived)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS shifts (
    id VARCHAR(36) PRIMARY KEY,
    tenantId VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    startTime VARCHAR(20) DEFAULT '06:00',
    endTime VARCHAR(20) DEFAULT '14:00',
    plannedDurationMinutes INT DEFAULT 480,
    breakDurationMinutes INT DEFAULT 45,
    isActive BOOLEAN DEFAULT TRUE,
    createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_shifts_tenant_code (tenantId, code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS telemetry_events (
    id VARCHAR(36) PRIMARY KEY,
    tenantId VARCHAR(36) NOT NULL,
    machineId VARCHAR(36) NOT NULL,
    gatewayId VARCHAR(36),
    timestamp DATETIME(3) NOT NULL,
    sequenceNumber BIGINT NOT NULL,
    state VARCHAR(50) NOT NULL,
    cumulativeGoodCount BIGINT NOT NULL,
    cumulativeRejectCount BIGINT NOT NULL,
    deltaGoodCount INT DEFAULT 0,
    deltaRejectCount INT DEFAULT 0,
    cycleTimeSeconds FLOAT DEFAULT 0,
    temperature FLOAT,
    vibration FLOAT,
    powerKw FLOAT,
    energyKwh FLOAT,
    voltageV FLOAT,
    currentA FLOAT,
    faultCode VARCHAR(100),
    faultDescription TEXT,
    rawPayload JSON,
    createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_telem_tenant_machine_ts (tenantId, machineId, timestamp),
    INDEX idx_telem_tenant_ts (tenantId, timestamp)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(36) PRIMARY KEY,
    tenantId VARCHAR(36) NOT NULL,
    machineId VARCHAR(36) NOT NULL,
    ruleId VARCHAR(36),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'OPERATION',
    severity VARCHAR(50) DEFAULT 'WARNING',
    status VARCHAR(50) DEFAULT 'ACTIVE',
    faultCode VARCHAR(100),
    acknowledgedBy JSON,
    resolvedBy JSON,
    createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_alerts_tenant_machine (tenantId, machineId),
    INDEX idx_alerts_tenant_status (tenantId, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS alert_rules (
    id VARCHAR(36) PRIMARY KEY,
    tenantId VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    machineId VARCHAR(36),
    metric VARCHAR(100) NOT NULL,
    condition VARCHAR(50) NOT NULL,
    thresholdValue JSON NOT NULL,
    severity VARCHAR(50) DEFAULT 'WARNING',
    cooldownMinutes INT DEFAULT 15,
    isEnabled BOOLEAN DEFAULT TRUE,
    lastTriggeredAt DATETIME(3),
    createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_alert_rules_tenant_enabled (tenantId, isEnabled)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS machine_commands (
    id VARCHAR(36) PRIMARY KEY,
    commandId VARCHAR(100) NOT NULL UNIQUE,
    tenantId VARCHAR(36) NOT NULL,
    machineId VARCHAR(36) NOT NULL,
    command VARCHAR(50) NOT NULL,
    requestedByUserId VARCHAR(36) NOT NULL,
    requestedByUserName VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    issuedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    acknowledgedAt DATETIME(3),
    observedAt DATETIME(3),
    responsePayload JSON,
    failureReason TEXT,
    createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_commands_tenant_machine_issued (tenantId, machineId, issuedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS maintenance_work_orders (
    id VARCHAR(36) PRIMARY KEY,
    workOrderNumber VARCHAR(100) NOT NULL UNIQUE,
    tenantId VARCHAR(36) NOT NULL,
    machineId VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'PREVENTIVE',
    priority VARCHAR(50) DEFAULT 'MEDIUM',
    status VARCHAR(50) DEFAULT 'OPEN',
    assignedToUserId VARCHAR(36),
    assignedToUserName VARCHAR(255),
    checklist JSON,
    sparePartsUsed JSON,
    downtimeMinutes FLOAT DEFAULT 0,
    serviceNotes TEXT,
    scheduledDate DATETIME(3) NOT NULL,
    startedAt DATETIME(3),
    completedAt DATETIME(3),
    verifiedAt DATETIME(3),
    createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_mwo_tenant_machine (tenantId, machineId),
    INDEX idx_mwo_tenant_status (tenantId, status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS production_summaries (
    id VARCHAR(36) PRIMARY KEY,
    tenantId VARCHAR(36) NOT NULL,
    machineId VARCHAR(36) NOT NULL,
    lineId VARCHAR(36) NOT NULL,
    plantId VARCHAR(36) NOT NULL,
    dateString VARCHAR(20) NOT NULL,
    shiftCode VARCHAR(50) NOT NULL DEFAULT 'SHIFT-1',
    goodCount BIGINT DEFAULT 0,
    rejectCount BIGINT DEFAULT 0,
    totalProcessedCount BIGINT DEFAULT 0,
    operatingTimeMinutes FLOAT DEFAULT 0,
    plannedTimeMinutes FLOAT DEFAULT 480,
    downtimeMinutes FLOAT DEFAULT 0,
    idealCycleTimeSeconds FLOAT DEFAULT 10,
    availability FLOAT DEFAULT 100,
    performance FLOAT DEFAULT 100,
    quality FLOAT DEFAULT 100,
    oee FLOAT DEFAULT 100,
    createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_prod_summary (tenantId, machineId, dateString, shiftCode),
    INDEX idx_prod_summary_tenant_date (tenantId, dateString)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    tenantId VARCHAR(36),
    actorId VARCHAR(36) NOT NULL,
    actorEmail VARCHAR(255) NOT NULL,
    actorRole VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resourceType VARCHAR(100) NOT NULL,
    resourceId VARCHAR(100) NOT NULL,
    ipAddress VARCHAR(50) DEFAULT '127.0.0.1',
    userAgent TEXT,
    details JSON,
    createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_audit_tenant_created (tenantId, createdAt),
    INDEX idx_audit_action (action)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
];

export function isDBConnected(): boolean {
  return isConnected;
}

export function getPool(): mysql.Pool | null {
  return isConnected ? pool : null;
}

export async function connectDB(): Promise<void> {
  if (pool && isConnected) {
    return;
  }

  const { host, port, user, password, database, uri } = config.mysql;

  try {
    logger.info({ host, port, database, user }, 'Connecting to MySQL database server...');

    // 1. Initial connection to verify server & create database if not present
    if (!uri) {
      try {
        const rootConn = await mysql.createConnection({
          host,
          port,
          user,
          password
        });
        await rootConn.query(
          `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
        );
        await rootConn.end();
      } catch (err: any) {
        const errMsg = err?.message || err?.code || String(err);
        logger.warn({ err: errMsg }, 'Could not run CREATE DATABASE step directly; connecting to configured database...');
      }
    }

    // 2. Create the production connection pool
    if (uri) {
      pool = mysql.createPool(uri);
    } else {
      pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 20,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        dateStrings: true
      });
    }

    // 3. Test ping
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    // 4. Initialize all tables
    for (const ddl of TABLE_DEFINITIONS) {
      await pool.query(ddl);
    }

    isConnected = true;
    logger.info({ host, port, database }, 'Successfully connected to MySQL database and verified all tables.');
  } catch (error: any) {
    if (pool) {
      try {
        await pool.end();
      } catch {
        // ignore close error
      }
      pool = null;
    }
    isConnected = false;
    const errorDetail = error?.message || error?.code || String(error);
    logger.error({ error: errorDetail, host, port, database }, 'Failed to connect to MySQL database.');
    if (config.env === 'test') {
      logger.warn('Running in test environment without live MySQL; in-memory repository store active.');
    } else {
      logger.warn('MySQL server is currently unreachable. FactoryPulse in-memory engine active while waiting for MySQL.');
    }
  }
}

export async function disconnectDB(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
    } catch {
      // Ignore errors on close
    }
    pool = null;
    isConnected = false;
    logger.info('MySQL pool closed.');
  }
}
