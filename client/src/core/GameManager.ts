import type { Game } from './Game';
import { findCharacter, ROSTER, type CharacterDefinition } from '../characters/roster';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { PlaygroundScene } from '../scenes/PlaygroundScene';
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
        // Dev shortcut: ?scene=freeplay skips the title screen.
        if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('scene') === 'freeplay') {
            this.startFreePlay();
            return;
        }

        this.showMainMenu();
    }

    showMainMenu(): void {
        void this.game.scenes.switchTo(
            new MainMenuScene(this.game, {
                character: this.character,
                onSelectCharacter: (character) => this.selectCharacter(character),
                onFreePlay: () => this.startFreePlay(),
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
