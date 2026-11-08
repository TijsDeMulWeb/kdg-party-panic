import type { MinigameDefinition } from '../types';
import { DURATION } from './rules';

export const meteorMayhem: MinigameDefinition = {
    id: 'meteor-mayhem',
    name: 'Meteor Mayhem',
    tagline: 'Dodge the meteors, grab the stars.',
    accent: '#ff9a3c',
    durationSeconds: DURATION,
    actionLabel: 'Dash',
    instructions: [
        'Red circles show where a meteor is about to land. Get out of the way!',
        'Grab the golden stars for points before they fade.',
        'A meteor hit stuns you and costs points. It gets busier every second.',
    ],
    load: async () => (await import('./MeteorMayhem')).createMeteorMayhem,
};
