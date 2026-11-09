import type { MinigameDefinition } from '../types';
import { DURATION } from './rules';

export const iceSlide: MinigameDefinition = {
    id: 'ice-slide',
    name: 'Ice Slide',
    tagline: 'Glide over the ice and stop dead centre.',
    accent: '#3ea6ff',
    durationSeconds: DURATION,
    actionLabel: 'Dash',
    instructions: [
        'Run up and cross the red line. After that you are on slippery ice!',
        'On the ice you can only steer a little. Your speed at the line decides how far you glide.',
        'Stop as close to the centre as you can. Too fast and you slide off the end.',
    ],
    load: async () => (await import('./IceSlide')).createIceSlide,
};
