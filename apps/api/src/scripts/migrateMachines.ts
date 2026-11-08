import { connectDB, disconnectDB } from '../config/db.js';
import { Machine } from '../models/Machine.js';
import { MachineState } from '@factorypulse/shared';

async function migrate() {
  await connectDB();

  // 1. Update PLC12 as real connected machine
  await Machine.updateOne(
    { assetId: 'PLC12' },
    {
      $set: {
        isRealDevice: true,
        isDeviceConnected: true,
        deviceConnectionStatus: 'CONNECTED',
        state: MachineState.RUNNING,
        isSimulated: false
      }
    }
  );

  // 2. Update seed demo machines as OFFLINE (when simulator is off)
  const simDefaults: Record<string, MachineState> = {
    'CNC-101': MachineState.RUNNING,
    'ROBOT-202': MachineState.RUNNING,
    'INJECT-303': MachineState.IDLE,
    'LASER-404': MachineState.RUNNING,
    'PRESS-505': MachineState.STOPPED,
    'PACK-606': MachineState.FAULTED
  };

  for (const [assetId, defaultState] of Object.entries(simDefaults)) {
    await Machine.updateOne(
      { assetId },
      {
        $set: {
          isRealDevice: false,
          isDeviceConnected: false,
          deviceConnectionStatus: 'DISCONNECTED',
          state: MachineState.OFFLINE,
          isSimulated: false,
          simulatedDefaultState: defaultState
        }
      }
    );
  }

  const updated = await Machine.find({}, {
    assetId: 1, name: 1, state: 1, isDeviceConnected: 1, isSimulated: 1
  }).lean();

  console.log('MIGRATION_RESULT_SUCCESS:');
  console.log(JSON.stringify(updated, null, 2));

  await disconnectDB();
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
