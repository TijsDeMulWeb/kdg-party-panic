import type { MinigameDefinition } from '../types';
import { DURATION } from './track';

export const kartRace: MinigameDefinition = {
    id: 'kart-race',
    name: 'Mini Kart Race',
    tagline: 'Two laps, yellow boost pads, no brakes needed.',
    accent: '#ff9a3c',
    durationSeconds: DURATION,
    actionLabel: 'Brake',
    instructions: [
        'Up / W to accelerate, down / S (or the action button) to brake and reverse, left and right to steer.',
        'Stay on the road: grass slows you right down. Drive over yellow arrows for a boost.',
        'Finish two laps as fast as you can. You have to pass every part of the track for a lap to count.',
    ],
    load: async () => (await import('./KartRace')).createKartRace,
};
