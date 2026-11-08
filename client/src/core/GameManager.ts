import type { Game } from './Game';
import { findCharacter, ROSTER, type CharacterDefinition } from '../characters/roster';
import { MainMenuScene, type MenuView } from '../scenes/MainMenuScene';
import { PlaygroundScene } from '../scenes/PlaygroundScene';
import { MinigameScene } from '../scenes/MinigameScene';
import { LobbyScene } from '../scenes/LobbyScene';
import { findMinigame } from '../minigames/registry';
import type { MinigameDefinition } from '../minigames/types';
import { PartySession } from '../multiplayer/PartySession';
import { createMinigameNetwork } from '../multiplayer/minigameNetwork';
import { savePlayer } from '../multiplayer/partyApi';
import type { RoundInfo } from '../multiplayer/types';
import { randomSeed } from '../utils/random';
import { readStorage, writeStorage } from '../utils/storage';

const CHARACTER_KEY = 'party-panic.character';
const NAME_KEY = 'party-panic.name';

/**
 * Application flow: decides which scene is shown and holds the player's
 * local choices and party session. Scenes never create other scenes;
 * they call back here.
 */
export class GameManager {
    private character: CharacterDefinition;
    private party: PartySession | null = null;

    constructor(private readonly game: Game) {
        this.character = findCharacter(readStorage(CHARACTER_KEY, ROSTER[0].id));
    }

    async start(): Promise<void> {
        // Dev shortcuts: ?scene=freeplay or ?scene=<minigame-id>[&seed=n] skip the title screen.
        const params = new URLSearchParams(window.location.search);
        const scene = import.meta.env.DEV ? params.get('scene') : null;
        const minigame = scene ? findMinigame(scene) : undefined;

        if (scene === 'freeplay') {
            this.startFreePlay();
            return;
        }

        if (minigame) {
            const seed = Number.parseInt(params.get('seed') ?? '', 10);
            this.startSolo(minigame, Number.isFinite(seed) ? seed : randomSeed());
            return;
        }

        // Back after a reload or a dropped connection: return to the party.
        this.party = await PartySession.resume().catch(() => null);

        if (this.party) {
            this.showLobby();
            return;
        }

        this.showMainMenu();
    }

    showMainMenu(view: MenuView = 'main'): void {
        void this.game.scenes.switchTo(
            new MainMenuScene(this.game, {
                character: this.character,
                view,
                defaultName: readStorage(NAME_KEY, ''),
                onSelectCharacter: (character) => this.selectCharacter(character),
                onFreePlay: () => this.startFreePlay(),
                onPlayMinigame: (minigame) => this.startSolo(minigame),
                onCreateParty: (name) => this.openParty(name, null),
                onJoinParty: (name, code) => this.openParty(name, code),
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

    private async openParty(name: string, code: string | null): Promise<void> {
        writeStorage(NAME_KEY, name);
        const player = await savePlayer(name, this.character.id);

        this.party?.close();
        this.party = code ? await PartySession.join(player, code) : await PartySession.create(player);
        this.showLobby();
    }

    private showLobby(): void {
        const session = this.party;

        if (!session) {
            this.showMainMenu('party');
            return;
        }

        void this.game.scenes.switchTo(
            new LobbyScene(this.game, {
                session,
                onRound: (round) => this.startPartyRound(session, round),
                onLeave: () => void this.leaveParty(),
            }),
        );
    }

    private startPartyRound(session: PartySession, round: RoundInfo): void {
        const minigame = findMinigame(round.minigame);
        const me = session.me;

        if (!minigame || !me) {
            return;
        }

        void this.game.scenes.switchTo(
            new MinigameScene(this.game, {
                definition: minigame,
                character: findCharacter(me.character),
                seed: round.seed,
                schedule: { startsAt: round.starts_at, network: createMinigameNetwork(session) },
                onReplay: () => this.showLobby(),
                onExit: () => this.showLobby(),
            }),
        );
    }

    private async leaveParty(): Promise<void> {
        const session = this.party;
        this.party = null;
        this.showMainMenu('party');
        await session?.leave();
    }

    private selectCharacter(character: CharacterDefinition): void {
        this.character = character;
        writeStorage(CHARACTER_KEY, character.id);
    }
}
