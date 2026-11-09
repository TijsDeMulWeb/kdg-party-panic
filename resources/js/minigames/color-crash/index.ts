import type { MinigameDefinition } from '../types';
import { DURATION } from './rounds';

export const colorCrash: MinigameDefinition = {
    id: 'color-crash',
    name: 'Color Crash',
    tagline: 'Find the colour before the floor falls away.',
    accent: '#3ea6ff',
    durationSeconds: DURATION,
    actionLabel: 'Dash',
    instructions: [
        'A colour is called out. Every other tile is about to drop.',
        'Run to a tile with that colour (or its symbol) before the bar runs out.',
        'Get there early for a speed bonus. Fall and you are out!',
    ],
    load: async () => (await import('./ColorCrash')).createColorCrash,
};
