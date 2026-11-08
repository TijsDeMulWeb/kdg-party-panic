import { colorCrash } from './color-crash';
import type { MinigameDefinition } from './types';

/** Every playable minigame. Adding one here makes it appear in Solo Arcade. */
export const MINIGAMES: readonly MinigameDefinition[] = [colorCrash];

/** Announced but not yet playable; shown as locked cards. */
export const UPCOMING_MINIGAMES: readonly { name: string; tagline: string }[] = [
    { name: 'Package Panic', tagline: 'Sort the parcels before the belt speeds up.' },
    { name: 'Big Ball', tagline: 'Roll a giant ball to the finish.' },
    { name: 'Vacuum Chaos', tagline: 'Suck up the most toys.' },
];

export function findMinigame(id: string): MinigameDefinition | undefined {
    return MINIGAMES.find((minigame) => minigame.id === id);
}
