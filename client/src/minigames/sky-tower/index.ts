import type { MinigameDefinition } from '../types';
import { DURATION } from './rules';

export const skyTower: MinigameDefinition = {
    id: 'sky-tower',
    name: 'Sky Tower',
    tagline: 'Jump up the tower before the goo gets you.',
    accent: '#3ea6ff',
    durationSeconds: DURATION,
    actionLabel: 'Dash',
    instructions: [
        'Jump from platform to platform up the spiral tower (hold jump for higher jumps).',
        'Pink goo rises from below. Touch it and you are out!',
        'Points for every metre you climb, bonus points for stars.',
    ],
    load: async () => (await import('./SkyTower')).createSkyTower,
};
