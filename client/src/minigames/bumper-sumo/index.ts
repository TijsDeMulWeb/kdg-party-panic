import type { MinigameDefinition } from '../types';
import { DURATION } from './rules';

export const bumperSumo: MinigameDefinition = {
    id: 'bumper-sumo',
    name: 'Bumper Sumo',
    tagline: 'Stay on the shrinking ring. Shove everyone else off.',
    accent: '#a66cff',
    durationSeconds: DURATION,
    actionLabel: 'Shove',
    instructions: [
        'The ring keeps shrinking. Fall into the water and you are out.',
        'Jump over the spinning sweeper bar or it launches you.',
        'Dash (Shift / E) into other players to knock them away. The longer you last, the more points.',
    ],
    load: async () => (await import('./BumperSumo')).createBumperSumo,
};
