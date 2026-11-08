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
        'Walk into a parcel from the side to push it into the lane of the bin with the same colour (or symbol).',
        'Correct deliveries in a row build a combo. Watch out: the bins shuffle!',
    ],
    load: async () => (await import('./PackagePanic')).createPackagePanic,
};
