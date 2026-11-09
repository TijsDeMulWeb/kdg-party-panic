import type { MinigameDefinition } from '../types';
import { DURATION } from './rules';

export const snowballSplat: MinigameDefinition = {
    id: 'snowball-splat',
    name: 'Snowball Splat',
    tagline: 'Splat snowmen and friends with snowballs.',
    accent: '#3ea6ff',
    durationSeconds: DURATION,
    actionLabel: 'Throw',
    instructions: [
        'Press Throw (Shift / E) to throw a snowball the way you are facing. Aim close and it locks on.',
        'Snowmen pop up all over the place: 50 points each. Hitting another player is worth 100.',
        'You carry 3 snowballs and make new ones automatically. Get hit and you freeze for a moment.',
    ],
    load: async () => (await import('./SnowballSplat')).createSnowballSplat,
};
