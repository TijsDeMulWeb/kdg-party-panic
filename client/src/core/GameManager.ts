import type { Game } from './Game';
import { findCharacter, ROSTER, type CharacterDefinition } from '../characters/roster';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { PlaygroundScene } from '../scenes/PlaygroundScene';
import { MinigameScene } from '../scenes/MinigameScene';
import { findMinigame } from '../minigames/registry';
import type { MinigameDefinition } from '../minigames/types';
import { randomSeed } from '../utils/random';
import { readStorage, writeStorage } from '../utils/storage';

const CHARACTER_KEY = 'party-panic.character';

/**
 * Application flow: decides which scene is shown and holds the player's
 * local choices. Scenes never create other scenes; they call back here.
 */
export class GameManager {
    private character: CharacterDefinition;

    constructor(private readonly game: Game) {
        this.character = findCharacter(readStorage(CHARACTER_KEY, ROSTER[0].id));
    }

    start(): void {
        // Dev shortcuts: ?scene=freeplay or ?scene=<minigame-id>[&seed=n] skip the title screen.
        const scene = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('scene') : null;
        const minigame = scene ? findMinigame(scene) : undefined;

        if (scene === 'freeplay') {
            this.startFreePlay();
            return;
        }

        if (minigame) {
            const seed = Number.parseInt(new URLSearchParams(window.location.search).get('seed') ?? '', 10);
            this.startSolo(minigame, Number.isFinite(seed) ? seed : randomSeed());
            return;
        }

        this.showMainMenu();
    }

    showMainMenu(view: 'main' | 'arcade' = 'main'): void {
        void this.game.scenes.switchTo(
            new MainMenuScene(this.game, {
                character: this.character,
                view,
                onSelectCharacter: (character) => this.selectCharacter(character),
                onFreePlay: () => this.startFreePlay(),
                onPlayMinigame: (minigame) => this.startSolo(minigame),
            }),
        );
    }

    startSolo(minigame: MinigameDefinition, seed = randomSeed()): void {
        void this.game.scenes.switchTo(
            new MinigameScene(this.game, {
                definition: minigame,
                character: this.character,
                seed,
                onReplay: () => this.startSolo(minigame),
                onExit: () => this.showMainMenu('arcade'),
            }),
        );
    }

    startFreePlay(): void {
        void this.game.scenes.switchTo(
            new PlaygroundScene(this.game, {
                character: this.character,
                onExit: () => this.showMainMenu(),
            }),
        );
    }

    private selectCharacter(character: CharacterDefinition): void {
        this.character = character;
        writeStorage(CHARACTER_KEY, character.id);
    }
}
