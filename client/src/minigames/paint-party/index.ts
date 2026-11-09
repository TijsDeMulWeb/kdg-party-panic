import type { MinigameDefinition } from '../types';
import { DURATION } from './rules';

export const paintParty: MinigameDefinition = {
    id: 'paint-party',
    name: 'Paint Party',
    tagline: 'Paint the most tiles in your colour.',
    accent: '#ff7ac6',
    durationSeconds: DURATION,
    actionLabel: 'Dash',
    instructions: [
        'Every tile you run over turns your colour. Others can paint over yours!',
        'Watch out for the big rollers: they wipe the paint and bowl you over. Jump over them!',
        'Only the tiles you own when time runs out count.',
    ],
    load: async () => (await import('./PaintParty')).createPaintParty,
};
