import type { MinigameDefinition } from '../types';
import { DURATION } from './rules';

export const fruitFrenzy: MinigameDefinition = {
    id: 'fruit-frenzy',
    name: 'Fruit Frenzy',
    tagline: 'Catch the fruit in your basket, dodge the rotten ones.',
    accent: '#ff5a5f',
    durationSeconds: DURATION,
    actionLabel: 'Dash',
    instructions: [
        'Fruit falls from the sky. A ring shows where it will land.',
        'Stand on the ring when it lands to catch it in the basket on your head.',
        'Apples 10, pears 20, golden apples 50. Rotten apples cost 30!',
    ],
    load: async () => (await import('./FruitFrenzy')).createFruitFrenzy,
};
