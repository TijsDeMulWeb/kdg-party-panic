import { bigBall } from './big-ball';
import { bumperSumo } from './bumper-sumo';
import { colorCrash } from './color-crash';
import { fruitFrenzy } from './fruit-frenzy';
import { meteorMayhem } from './meteor-mayhem';
import { packagePanic } from './package-panic';
import { paintParty } from './paint-party';
import { skyTower } from './sky-tower';
import { vacuumChaos } from './vacuum-chaos';
import { hotPotato } from './hot-potato';
import { iceSlide } from './ice-slide';
import { kartRace } from './kart-race';
import { quickDraw } from './quick-draw';
import { snowballSplat } from './snowball-splat';
import type { MinigameDefinition } from './types';

/** Every playable minigame. Adding one here makes it appear in Solo Arcade and party matches. */
export const MINIGAMES: readonly MinigameDefinition[] = [
    colorCrash,
    packagePanic,
    bigBall,
    vacuumChaos,
    paintParty,
    meteorMayhem,
    skyTower,
    fruitFrenzy,
    bumperSumo,
    snowballSplat,
    quickDraw,
    iceSlide,
    kartRace,
    hotPotato,
];

/** Announced but not yet playable; shown as locked cards. */
export const UPCOMING_MINIGAMES: readonly { name: string; tagline: string }[] = [];

export function findMinigame(id: string): MinigameDefinition | undefined {
    return MINIGAMES.find((minigame) => minigame.id === id);
}
