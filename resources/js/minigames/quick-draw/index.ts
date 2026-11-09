import type { MinigameDefinition } from '../types';
import { DURATION } from './rules';

export const quickDraw: MinigameDefinition = {
    id: 'quick-draw',
    name: 'Quick Draw',
    tagline: 'Wait for green… then press as fast as you can!',
    accent: '#3ddc97',
    durationSeconds: DURATION,
    actionLabel: 'Press!',
    instructions: [
        'Each duel the big lamp turns green at a random moment.',
        'Press any button (or tap the screen) the moment it goes green. Faster means more points.',
        'Press too early and you lose that duel. Watch out for yellow fake-outs!',
    ],
    load: async () => (await import('./QuickDraw')).createQuickDraw,
};
