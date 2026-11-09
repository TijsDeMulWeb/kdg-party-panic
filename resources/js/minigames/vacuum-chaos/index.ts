import type { MinigameDefinition } from '../types';
import { DURATION } from './rules';

export const vacuumChaos: MinigameDefinition = {
    id: 'vacuum-chaos',
    name: 'Vacuum Chaos',
    tagline: 'Suck up the most toys before time runs out.',
    accent: '#a66cff',
    durationSeconds: DURATION,
    actionLabel: 'Vacuum',
    instructions: [
        'Hold the action button (Shift / E) to switch on your vacuum and point it at toys.',
        'Small toys pop in instantly. Big teddies are worth the most but take a while and slow you down.',
        'New toys keep dropping in. Grab them before the others do!',
    ],
    load: async () => (await import('./VacuumChaos')).createVacuumChaos,
};
