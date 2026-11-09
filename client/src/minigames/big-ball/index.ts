import type { MinigameDefinition } from '../types';
import { DURATION } from './rules';

export const bigBall: MinigameDefinition = {
    id: 'big-ball',
    name: 'Big Ball',
    tagline: 'Roll a giant ball through the obstacle course.',
    accent: '#3ddc97',
    durationSeconds: DURATION,
    actionLabel: 'Dash',
    instructions: [
        'Walk into your ball to push it. It rolls in the direction you push.',
        'Steer around walls and bouncy bumpers. Dash into the ball for a big shove.',
        'Reach the finish line as fast as you can. Others can get in your way!',
    ],
    load: async () => (await import('./BigBall')).createBigBall,
};
