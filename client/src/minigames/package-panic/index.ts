import type { MinigameDefinition } from '../types';
import { DURATION } from './rules';

export const packagePanic: MinigameDefinition = {
    id: 'package-panic',
    name: 'Package Panic',
    tagline: 'Shove the parcels into the right bins.',
    accent: '#ff9a3c',
    durationSeconds: DURATION,
    actionLabel: 'Shove',
    instructions: [
        'Parcels roll down the conveyor towards three bins.',
        'Walk into a parcel to push it, or press Shove (Shift / E) to kick the nearest one a lane over in the direction you face.',
        'Every parcel must reach the bin with the same colour (or symbol).',
        'Correct deliveries in a row build a combo. Watch out: the bins shuffle!',
    ],
    load: async () => (await import('./PackagePanic')).createPackagePanic,
};
