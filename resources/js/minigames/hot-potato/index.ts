import type { MinigameDefinition } from '../types';
import { DURATION } from './rules';

export const hotPotato: MinigameDefinition = {
    id: 'hot-potato',
    name: 'Hot Potato',
    tagline: 'Pass the bomb before it blows!',
    accent: '#ff5a5f',
    durationSeconds: DURATION,
    actionLabel: 'Dash',
    instructions: [
        'One player carries a ticking bomb. Run into someone to pass it on.',
        'Whoever holds it when it explodes is out. The ticking speeds up near the end!',
        'Points for every explosion you survive, and a bonus for the last one standing.',
    ],
    load: async () => (await import('./HotPotato')).createHotPotato,
};
