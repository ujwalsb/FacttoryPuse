# FactoryPulse — Industrial Production Monitoring SaaS

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6-purple.svg)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-blue.svg)](https://www.mysql.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-black.svg)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/Compliance-IEC_62443_/_ISO_22400-emerald.svg)]()

> **FactoryPulse** is an enterprise-grade, multi-tenant Industrial IoT (IIoT) and Production Monitoring SaaS platform built on Node.js, Express, MySQL, and React. Designed for modern manufacturing execution systems (MES), FactoryPulse enables SaaS platform owners to govern multiple manufacturing enterprises while providing each tenant with real-time machine telemetry, Overall Equipment Effectiveness (OEE) analytics, preventive maintenance workflows, anomaly alerts, controlled equipment command dispatch, and cryptographic auditability.

---

## 1. Executive Architecture Overview

```
                                      SHOP FLOOR INDUSTRIAL NETWORK (OT)
                               ┌───────────────────────────────────────────────┐
                               │  [HAAS VF-4 CNC]  [Fanuc Robot]  [Trumpf Laser] │
                               │        ▲                ▲             ▲       │
                               │   Modbus TCP         OPC UA       Sim Driver  │
                               └────────┴────────────────┴─────────────┴───────┘
                                                         │
                                          ┌──────────────▼──────────────┐
                                          │ FactoryPulse Edge Gateway   │
                                          │ (Local Outbound TLS Tunnel) │
                                          └──────────────┬──────────────┘
                                                         │ MQTT over TLS (Port 8883)
                                                         ▼
───────────────────────────────────────────── CLOUD PLATFORM BOUNDARY ──────────────────────────────────────────
           ┌─────────────────────────────────────────────────────────────────────────────┐
           │                             FactoryPulse API                                │
           │                                                                             │
           │  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────┐  │
           │  │ Telemetry Ingest &    │  │  Alert Engine &       │  │ OEE Aggregator  │  │
           │  │ Delta Counter Engine  │  │  Cooldown Throttling  │  │ (ISO 22400)     │  │
           │  └───────────┬───────────┘  └───────────┬───────────┘  └────────┬────────┘  │
           │              │                          │                       │           │
           │              ▼                          ▼                       ▼           │
           │        ┌───────────┐              ┌───────────┐           ┌───────────┐     │
           │        │ MySQL     │              │ Socket.IO │           │ Audit Log │     │
           │        │ Multi-    │              │ Tenant    │           │ Ledger    │     │
           │        │ Tenant DB │              │ Rooms     │           │ (Immutable│     │
           │        └───────────┘              └─────┬─────┘           └───────────┘     │
           └─────────────────────────────────────────┼───────────────────────────────────┘
                                                     │ Authenticated WebSocket WSS
                                                     ▼
                                   ┌───────────────────────────────────┐
                                   │ FactoryPulse Web App (React/Vite) │
                                   │ Control-Room Industrial Theme     │
                                   └───────────────────────────────────┘
```

---

## 2. Multi-Tenant Role-Based Access Control (RBAC)

FactoryPulse enforces deny-by-default server-side RBAC and strict tenant isolation on every database query, aggregation pipeline, and WebSocket room:

| Role | Scope | Key Permissions & Responsibilities | Demo User |
| :--- | :--- | :--- | :--- |
| **Master Admin** | Platform-Wide | Tenant provisioning, global billing/plan quotas, system health, platform audit logs | `admin@factorypulse.io` |
| **Company Admin** | Single Tenant | Company settings, plant/line topology, employee provisioning, quota allocation | `admin@apex.com` |
| **Plant IT / OT Lead** | Facility Assets | Asset registration, protocol driver mapping, gateway keys, telemetry tag binding | `it@apex.com` |
| **Production Supervisor**| Plant & Lines | Shift monitoring, OEE tracking, line throughput, alert acknowledgment, report exports | `supervisor@apex.com` |
| **Machine Operator** | Assigned Cells | Terminal monitoring, scrap logging, safety-authorized start/stop command dispatch | `operator@apex.com` |
| **Maintenance Engineer** | Fleet Assets | Work orders, preventive checklists, LOTO sign-off, downtime attribution, spare parts | `maintenance@apex.com` |

*Default Demo Password for all accounts:* `Password123!`

---

## 3. Industrial Telemetry & Mathematical Formulations

### Counter Safety & Rollover Handling
Industrial PLCs frequently reset cumulative part counters upon shift transitions or counter roll-over. FactoryPulse handles this transparently:
$$\Delta \text{Good} = \begin{cases} C_{t} - C_{t-1} & \text{if } C_{t} \ge C_{t-1} \\ C_{t} & \text{if } C_{t} < C_{t-1} \text{ (Rollover / Reset detected)} \end{cases}$$

### Overall Equipment Effectiveness (OEE) — ISO 22400
1. **Availability ($A$):**
   $$A = \frac{\text{Operating Time}}{\text{Planned Production Time}} \times 100$$
2. **Performance ($P$):**
   $$P = \frac{\text{Total Processed Count} \times \text{Ideal Cycle Time (sec)}}{\text{Operating Time (sec)}} \times 100$$
3. **Quality ($Q$):**
   $$Q = \frac{\text{Good Count}}{\text{Total Processed Count}} \times 100$$
4. **Overall OEE:**
   $$\text{OEE} = \frac{A \times P \times Q}{10000} \quad (0 - 100\%)$$

---

## 4. Controlled Machine Start & Stop Workflow

FactoryPulse adheres to industrial machinery safety guidelines. Web applications must never bypass safety circuits:
1. **Permission Check:** User identity, company tenant membership, and role permissions are verified.
2. **Safety Interlock Evaluation:** Machine must not be in `FAULTED` or `MAINTENANCE` state prior to receiving a `START` command.
3. **Cryptographic Command ID:** A unique non-replayable token (`FP-CMD-XXXX`) is issued with an expiration deadline (30 seconds).
4. **Safety Confirmation:** User must provide a mandatory operational justification reason recorded in the immutable audit ledger.
5. **Driver Dispatch:** The command is passed to the edge gateway driver (or simulator).
6. **Telemetry Verification:** The state change is observed in the subsequent telemetry packet before the command transitions from `ACKNOWLEDGED` to `OBSERVED`.

---

## 5. Technology Stack

### Frontend (`apps/web`)
- **Core:** React 18 with Vite 6 & TypeScript
- **Styling:** Tailwind CSS with custom industrial control-room dark palette
- **Charts:** Recharts for real-time throughput and OEE comparative analytics
- **Real-Time:** Socket.IO Client with automatic reconnection and tenant room binding
- **Icons:** Lucide React icons
- **State & Query:** React Query (TanStack Query) + Custom Context Stores

### Backend (`apps/api`)
- **Runtime:** Node.js with Express.js and TypeScript (native ES Modules)
- **Database:** MySQL 8.0 with `mysql2` connection pooling and automatic schema management
- **Real-Time:** Socket.IO with JWT handshake authentication and room partitioning
- **Validation:** Zod request schemas
- **Security:** Helmet, CORS allowlisting, Argon2id/bcrypt password hashing, HttpOnly cookies
- **Logging:** Structured Pino logging with pretty-print development formatting
- **Documentation:** OpenAPI / Swagger interactive documentation at `/api-docs`

### Industrial Connectivity & Simulation
- **Industrial Simulator:** Autonomous background simulator engine generating realistic mechanical, thermal, vibration, and counter dynamics.
- **Protocol Adapters:** Pluggable adapter architecture for MQTT over TLS, OPC UA, Modbus TCP, and Simulator.

---

## 6. Monorepo Repository Structure

```text
factorypulse/
├── package.json                   # Root workspace package.json
├── tsconfig.json                  # Root TypeScript configuration
├── .env.example                   # Environment variable template
├── docker-compose.yml             # Complete multi-service Docker stack
├── README.md                      # Comprehensive documentation
├── packages/
│   └── shared/                    # Shared types, Zod schemas, constants
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── constants/         # User roles, machine states, command types
│           ├── types/             # Domain TypeScript interfaces
│           └── schemas/           # Zod validation schemas
├── apps/
│   ├── api/                       # Express + MySQL + Socket.IO Backend
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── config/            # DB connector and MySQL schema migration
│   │       ├── models/            # 14 MySQL models with tenant scoping
│   │       ├── middleware/        # JWT auth, RBAC, tenant isolation, audit
│   │       ├── services/          # Telemetry, OEE, Alerts, Commands, Exports
│   │       ├── adapters/          # MQTT, OPC UA, Modbus TCP, Simulator drivers
│   │       ├── simulator/         # Autonomous industrial machine simulator
│   │       ├── modules/           # Controllers and versioned routes (/api/v1/...)
│   │       ├── socket/            # Authenticated Socket.IO engine
│   │       ├── seed/              # Comprehensive multi-tenant seed dataset
│   │       └── tests/             # Vitest unit & integration test suites
│   └── web/                       # React 18 + Vite Industrial Frontend
│       ├── package.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── index.html
│       └── src/
│           ├── components/        # Header, Sidebar, StatCard, StatusBadge, Modals
│           ├── context/           # AuthContext, TelemetryContext (WebSocket)
│           ├── pages/             # 15 enterprise views & dashboards
│           └── services/          # API client & Socket.IO listener
└── infrastructure/
    └── docker/
        ├── Dockerfile.api         # Production multi-stage API image
        ├── Dockerfile.web         # Production Nginx frontend image
        └── mosquitto.conf         # MQTT TLS Broker configuration
```

---

## 7. Quick-Start Guide (Zero External Dependencies)

FactoryPulse is engineered for **instant execution**. Connect to your local or remote MySQL instance (configured in `.env`), and FactoryPulse automatically creates all necessary relational tables, foreign indices, and populates realistic manufacturing seed data.

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build Shared Package
```bash
npm run build --workspace=packages/shared
```

### Step 3: Start Development Servers
```bash
# Starts both Backend API (port 5000) and Web Frontend (port 5173) concurrently
npm run dev
```

- **Web Application:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:5000/api/v1](http://localhost:5000/api/v1)
- **Interactive Swagger Docs:** [http://localhost:5000/api-docs](http://localhost:5000/api-docs)

---

## 8. Exploring the 6 Manufacturing Personas

Upon loading [http://localhost:5173/login](http://localhost:5173/login), you will find **1-Click Role Login Cards** for immediate evaluation:

1. **Platform Owner (Master Admin):** `admin@factorypulse.io`
   - Access global platform control, tenant list, company activation/suspension, and platform-wide metrics.
2. **VP Operations (Company Admin):** `admin@apex.com`
   - Governs Apex Precision Aerospace, creates plants, assigns production targets, and inspects company OEE.
3. **OT Infrastructure Lead (Plant IT):** `it@apex.com`
   - Configures edge gateways, registers machine assets, and inspects communication diagnostics.
4. **Production Supervisor:** `supervisor@apex.com`
   - Tracks shift throughput, good vs scrap count, and acknowledges active shop-floor incident alarms.
5. **Machine Operator:** `operator@apex.com`
   - Monitors assigned CNC milling and robotic cells, and issues safety-confirmed start/stop commands.
6. **Reliability Specialist (Maintenance):** `maintenance@apex.com`
   - Manages preventive maintenance plans, checks off LOTO inspection tasks, and logs downtime.

*You can also switch roles instantaneously from the top navigation banner without logging out!*

---

## 9. Running Tests & Builds

### Run Backend Unit & Integration Tests
```bash
npm run test --workspace=apps/api
```
*Executes Vitest test suites covering OEE math, JWT token lifecycle, and RBAC authorization.*

### Compile and Verify Full Production Builds
```bash
npm run build
```
*Builds `@factorypulse/shared`, compiles `@factorypulse/api` with strict TypeScript, and produces the optimized `@factorypulse/web` production bundle.*

---

## 10. Docker Compose Deployment

To run the full containerized production stack with MySQL, Redis, Mosquitto MQTT, API, and Nginx:

```bash
docker compose up --build -d
```

---

## 11. Security Posture & Standards Compliance

- **IEC 62443 Security:** Industrial edge gateways communicate strictly outbound; no public exposure of shop-floor PLCs.
- **OWASP Top 10 Protections:** Enforces parameterization against NoSQL injection, Helmet security headers, CORS origin allowlists, request size throttling, and secure refresh-token rotation in HttpOnly cookies.
- **Audit Traceability:** All administrative actions and machine commands generate append-only compliance audit logs with actor identity, action type, IP address, and cryptographic nonce.
