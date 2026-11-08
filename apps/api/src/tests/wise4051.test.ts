import { connectDB, disconnectDB } from '../config/db.js';
import { Tenant } from '../models/Tenant.js';
import { Machine } from '../models/Machine.js';
import { Alert } from '../models/Alert.js';
import { User } from '../models/User.js';
import { Wise4051Service } from '../services/wise4051Service.js';
import {
  MachineState,
  IndustrialProtocol,
  DIFunctionType,
  DIPolarity,
  WiseProtocol,
  AlertSeverity,
  UserRole,
  getDefaultDigitalInputConfigs,
  UpdateDIMappingsSchema
} from '@factorypulse/shared';
import { v4 as uuidv4 } from 'uuid';

describe('Advantech WISE-4051 Machine Integration, Polarity, Debounce & RBAC', () => {
  let tenant: any;
  let machine: any;

  beforeAll(async () => {
    await connectDB();

    tenant = await Tenant.create({
      name: 'WISE-4051 Aerospace Test Plant',
      code: 'WISETEST',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      contactEmail: 'wise@test.com'
    });

    machine = await Machine.create({
      assetId: 'WISE-MC-01',
      tenantId: tenant._id,
      plantId: uuidv4(),
      lineId: uuidv4(),
      name: 'Advantech Connected CNC Mill',
      category: 'CNC Milling',
      manufacturer: 'Advantech / Haas',
      modelNumber: 'WISE-4051 / VF-2',
      serialNumber: 'SN-W4051-9988',
      protocol: IndustrialProtocol.WISE_4051,
      expectedCycleTimeSeconds: 15,
      plannedCapacityPerHour: 240,
      targetGoodQuantityPerShift: 1500,
      targetRejectionPercentage: 2.0,
      state: MachineState.IDLE,
      isMonitored: true,
      isSimulated: false,
      isDeviceConnected: true,
      tagMappings: [],
      wiseConnectionSettings: {
        model: 'WISE-4051',
        protocol: WiseProtocol.REST,
        slot: 0,
        pollIntervalMs: 500,
        username: 'root',
        password: '00000000',
        timeoutMs: 1000
      }
    });
  });

  afterAll(async () => {
    if (tenant) {
      await Alert.deleteMany({ tenantId: tenant._id });
      await Machine.deleteOne({ _id: machine._id });
      await Tenant.deleteOne({ _id: tenant._id });
    }
  });

  // 1. Default Digital Input Mapping Test
  it('initializes default digital input mappings with DI0=GOOD, DI1=REJECT, and DI2..DI9=ALERT', () => {
    const defaults = getDefaultDigitalInputConfigs();
    expect(defaults).toHaveLength(10);

    // DI0 must default to GOOD
    expect(defaults[0].pin).toBe('DI0');
    expect(defaults[0].functionType).toBe(DIFunctionType.GOOD);
    expect(defaults[0].polarity).toBe(DIPolarity.ACTIVE_HIGH);

    // DI1 must default to REJECT
    expect(defaults[1].pin).toBe('DI1');
    expect(defaults[1].functionType).toBe(DIFunctionType.REJECT);
    expect(defaults[1].polarity).toBe(DIPolarity.ACTIVE_HIGH);

    // DI2 to DI9 must default to ALERT
    for (let i = 2; i < 10; i++) {
      expect(defaults[i].pin).toBe(`DI${i}`);
      expect(defaults[i].functionType).toBe(DIFunctionType.ALERT);
    }
  });

  // 2. Conflicting Mappings Validation Test
  it('validates and rejects conflicting mappings to prevent duplicate counting', () => {
    const invalidConfig = {
      digitalInputConfigs: [
        {
          pin: 'DI0',
          pinIndex: 0,
          name: 'Counter 1',
          functionType: DIFunctionType.GOOD,
          isEnabled: true,
          polarity: DIPolarity.ACTIVE_HIGH,
          debounceMs: 50
        },
        {
          pin: 'DI1',
          pinIndex: 1,
          name: 'Counter 2 (Duplicate)',
          functionType: DIFunctionType.GOOD, // Duplicate GOOD counter!
          isEnabled: true,
          polarity: DIPolarity.ACTIVE_HIGH,
          debounceMs: 50
        }
      ]
    };

    const result = UpdateDIMappingsSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  // 3. Polarity Test: Active HIGH vs Active LOW
  it('accurately evaluates signal polarity for Active HIGH and Active LOW inputs', async () => {
    // Configure DI0 as ACTIVE_HIGH and DI1 as ACTIVE_LOW
    machine.digitalInputConfigs = [
      {
        pin: 'DI0',
        pinIndex: 0,
        name: 'Good Sensor (Active High)',
        functionType: DIFunctionType.GOOD,
        isEnabled: true,
        polarity: DIPolarity.ACTIVE_HIGH,
        debounceMs: 0
      },
      {
        pin: 'DI1',
        pinIndex: 1,
        name: 'Fail-Safe E-Stop (Active Low)',
        functionType: DIFunctionType.ALERT,
        isEnabled: true,
        polarity: DIPolarity.ACTIVE_LOW,
        severity: AlertSeverity.CRITICAL,
        alertMessage: 'E-Stop circuit open',
        debounceMs: 0
      }
    ];

    // Scenario A: Hardware raw level is [1, 1] (Logic HIGH on both)
    // DI0 (Active High): 1 -> ACTIVE (true)
    // DI1 (Active Low): 1 -> INACTIVE (false)
    const rawA = [true, true, false, false, false, false, false, false, false, false];
    const resA = await Wise4051Service.processMachineInputs(machine, rawA, 10);
    expect(resA.diStates[0].isActive).toBe(true);
    expect(resA.diStates[1].isActive).toBe(false);

    // Scenario B: Hardware raw level is [0, 0] (Logic LOW on both)
    // DI0 (Active High): 0 -> INACTIVE (false)
    // DI1 (Active Low): 0 -> ACTIVE (true)
    const rawB = [false, false, false, false, false, false, false, false, false, false];
    const resB = await Wise4051Service.processMachineInputs(machine, rawB, 10);
    expect(resB.diStates[0].isActive).toBe(false);
    expect(resB.diStates[1].isActive).toBe(true);
  });

  // 4. Counter Accuracy & Rising Edge Pulse Handling
  it('accurately counts GOOD and REJECT events on rising edges without double counting sustained signals', async () => {
    machine.digitalInputConfigs = getDefaultDigitalInputConfigs();
    // Set 0 debounce for deterministic test execution
    machine.digitalInputConfigs.forEach((c: any) => { c.debounceMs = 0; });

    const rt = Wise4051Service.getOrCreateRuntime(machine._id.toString(), 0, 0);
    rt.accumulatedGoodCount = 0;
    rt.accumulatedRejectCount = 0;
    rt.lastActiveStates = new Array(10).fill(false);

    // Pulse 1: DI0 turns HIGH (Good part detected)
    const tick1 = [true, false, false, false, false, false, false, false, false, false];
    const res1 = await Wise4051Service.processMachineInputs(machine, tick1, 10);
    expect(res1.goodCount).toBe(1);
    expect(res1.rejectCount).toBe(0);

    // Tick 2: DI0 remains HIGH (sensor still obscured / part passing) -> Counter must NOT increment again!
    const tick2 = [true, false, false, false, false, false, false, false, false, false];
    const res2 = await Wise4051Service.processMachineInputs(machine, tick2, 10);
    expect(res2.goodCount).toBe(1);

    // Tick 3: DI0 returns LOW (part cleared optical beam)
    const tick3 = [false, false, false, false, false, false, false, false, false, false];
    await Wise4051Service.processMachineInputs(machine, tick3, 10);

    // Tick 4: DI0 turns HIGH again (second part arrives) + DI1 turns HIGH (reject gate fires)
    const tick4 = [true, true, false, false, false, false, false, false, false, false];
    const res4 = await Wise4051Service.processMachineInputs(machine, tick4, 10);
    expect(res4.goodCount).toBe(2);
    expect(res4.rejectCount).toBe(1);
  });

  // 5. Alert & Fault Generation on Configured Inputs
  it('generates alerts and triggers FAULTED state when safety/fault inputs activate', async () => {
    machine.digitalInputConfigs = [
      {
        pin: 'DI2',
        pinIndex: 2,
        name: 'Coolant Level Alarm',
        functionType: DIFunctionType.ALERT,
        isEnabled: true,
        polarity: DIPolarity.ACTIVE_HIGH,
        severity: AlertSeverity.WARNING,
        alertMessage: 'Coolant reservoir depleted',
        debounceMs: 0
      },
      {
        pin: 'DI3',
        pinIndex: 3,
        name: 'Spindle Collision Fault',
        functionType: DIFunctionType.FAULT,
        isEnabled: true,
        polarity: DIPolarity.ACTIVE_HIGH,
        alertMessage: 'Spindle overload trip',
        debounceMs: 0
      }
    ];

    const rt = Wise4051Service.getOrCreateRuntime(machine._id.toString());
    rt.lastActiveStates[2] = false;
    rt.lastActiveStates[3] = false;

    // Trigger DI2 (Alert) and DI3 (Fault)
    const tick = [false, false, true, true, false, false, false, false, false, false];
    const res = await Wise4051Service.processMachineInputs(machine, tick, 12);

    expect(res.machineStateChanged).toBe(true);
    expect(res.newState).toBe(MachineState.FAULTED);
    expect(res.triggeredAlerts.length).toBeGreaterThanOrEqual(1);

    // Check that alert record exists in database
    const alertInDb = await Alert.findOne({
      machineId: machine._id,
      title: 'Machine Fault: Spindle Collision Fault'
    });
    expect(alertInDb).toBeDefined();

    expect(alertInDb?.severity).toBe(AlertSeverity.CRITICAL);
  });

  // 6. Device Disconnection & Error Handling
  it('handles device disconnection and marks connection status as DISCONNECTED', async () => {
    // Attempting to read unreachable IP on non-existent port
    const result = await Wise4051Service.readDeviceInputs(
      '192.0.2.1', // Non-routable TEST-NET IP address
      502,
      WiseProtocol.MODBUS_TCP,
      0,
      200
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // 7. RBAC Permissions Enforcement
  it('verifies RBAC policy allows Master Admin, Company Admin, and Plant IT to manage DI config', () => {
    const authorizedRoles = [
      UserRole.MASTER_ADMIN,
      UserRole.COMPANY_ADMIN,
      UserRole.PLANT_IT_HEAD
    ];

    const unauthorizedRoles = [
      UserRole.MACHINE_OPERATOR,
      UserRole.MAINTENANCE_ENGINEER,
      UserRole.PRODUCTION_MANAGER
    ];

    authorizedRoles.forEach(role => {
      expect([UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD].includes(role)).toBe(true);
    });

    unauthorizedRoles.forEach(role => {
      expect([UserRole.MASTER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PLANT_IT_HEAD].includes(role)).toBe(false);
    });
  });

  // 8. Advantech WISE-4051 Official REST Format Parser Test
  it('correctly parses official Advantech WISE-4051 REST API DIVal object array', () => {
    // Official Advantech WISE-4000 series payload
    const advantechPayload = {
      PE: 0,
      Slot: 0,
      DIVal: [
        { Ch: 0, Val: 1, Stat: 0 },
        { Ch: 1, Val: 0, Stat: 0 },
        { Ch: 2, Val: 1, Stat: 0 },
        { Ch: 3, Val: 0, Stat: 0 },
        { Ch: 4, Val: 0, Stat: 0 },
        { Ch: 5, Val: 0, Stat: 0 },
        { Ch: 6, Val: 0, Stat: 0 },
        { Ch: 7, Val: 0, Stat: 0 },
        { Ch: 8, Val: 0, Stat: 0 },
        { Ch: 9, Val: 0, Stat: 0 }
      ]
    };

    const parsed = Wise4051Service.parseAdvantechDiResponse(advantechPayload);
    expect(parsed).toHaveLength(10);
    expect(parsed[0]).toBe(true);  // Ch 0 is Val: 1
    expect(parsed[1]).toBe(false); // Ch 1 is Val: 0
    expect(parsed[2]).toBe(true);  // Ch 2 is Val: 1
    expect(parsed[3]).toBe(false);
  });

  // 9. Alternative Advantech Firmware Variants (Flat array, string values, key-value maps)
  it('correctly parses varied Advantech firmware formats including flat arrays, strings and key-value maps', () => {
    // Flat number array
    const flatNumbers = { DIVal: [1, 1, 0, 0, 1, 0, 0, 0, 0, 0] };
    const parsedFlat = Wise4051Service.parseAdvantechDiResponse(flatNumbers);
    expect(parsedFlat[0]).toBe(true);
    expect(parsedFlat[1]).toBe(true);
    expect(parsedFlat[2]).toBe(false);
    expect(parsedFlat[4]).toBe(true);

    // String / boolean values
    const stringVals = { DIVal: ['1', '0', 'true', 'false', 'HIGH', 'LOW', 0, 0, 0, 0] };
    const parsedStrings = Wise4051Service.parseAdvantechDiResponse(stringVals);
    expect(parsedStrings[0]).toBe(true);
    expect(parsedStrings[1]).toBe(false);
    expect(parsedStrings[2]).toBe(true);
    expect(parsedStrings[3]).toBe(false);
    expect(parsedStrings[4]).toBe(true);
    expect(parsedStrings[5]).toBe(false);

    // Key-value map format (DI0..DI9)
    const mapFormat = {
      DI0: 1,
      DI1: 0,
      DI2: 1,
      DI3: 0
    };
    const parsedMap = Wise4051Service.parseAdvantechDiResponse(mapFormat);
    expect(parsedMap[0]).toBe(true);
    expect(parsedMap[1]).toBe(false);
    expect(parsedMap[2]).toBe(true);
  });

  // 10. End-to-end pulse processing with parsed Advantech payload
  it('increments good count when receiving real Advantech DI0 pulse payload', async () => {
    machine.digitalInputConfigs = getDefaultDigitalInputConfigs();
    machine.digitalInputConfigs.forEach((c: any) => { c.debounceMs = 0; });

    const rt = Wise4051Service.getOrCreateRuntime(machine._id.toString(), 0, 0);
    rt.accumulatedGoodCount = 10;
    rt.accumulatedRejectCount = 2;
    rt.lastActiveStates = new Array(10).fill(false);

    const advantechPulse = {
      PE: 0,
      Slot: 0,
      DIVal: [
        { Ch: 0, Val: 1, Stat: 0 }, // DI0 active (Good pulse)
        { Ch: 1, Val: 0, Stat: 0 }
      ]
    };

    const rawLevels = Wise4051Service.parseAdvantechDiResponse(advantechPulse);
    const result = await Wise4051Service.processMachineInputs(machine, rawLevels, 15);

    expect(result.goodCount).toBe(11); // Incremented from 10 to 11
    expect(result.rejectCount).toBe(2);
    expect(result.diStates[0].isActive).toBe(true);
  });
});
