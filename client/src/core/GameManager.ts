import type { Game } from './Game';
import { findCharacter } from '../characters/roster';
import { MainMenuScene, type MenuView } from '../scenes/MainMenuScene';
import { PlaygroundScene } from '../scenes/PlaygroundScene';
import { MinigameScene, type ResultExtras } from '../scenes/MinigameScene';
import { LobbyScene } from '../scenes/LobbyScene';
import { StandingsScene } from '../scenes/StandingsScene';
import { PodiumScene } from '../scenes/PodiumScene';
import { findMinigame } from '../minigames/registry';
import type { MinigameDefinition, MinigameResult } from '../minigames/types';
import { PartySession } from '../multiplayer/PartySession';
import { createMinigameNetwork } from '../multiplayer/minigameNetwork';
import { savePlayer } from '../multiplayer/partyApi';
import type { RoundInfo, RoundOutcome } from '../multiplayer/types';
import { startDailyRun, startRun, submitRun, type RunInfo } from '../online/onlineApi';
import { displayName, loadProfile, saveProfile, type LocalProfile } from '../online/profile';
import { randomSeed } from '../utils/random';

/**
 * Application flow: decides which scene is shown and holds the player's
 * profile and party session. Scenes never create other scenes; they call
 * back here.
 */
export class GameManager {
    private readonly profile: LocalProfile = loadProfile();
    private party: PartySession | null = null;

    constructor(private readonly game: Game) {}

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
            void this.startSolo(minigame, Number.isFinite(seed) ? seed : undefined);
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
                profile: this.profile,
                view,
                onProfileChange: (profile) => saveProfile(profile),
                onFreePlay: () => this.startFreePlay(),
                onPlayMinigame: (minigame) => void this.startSolo(minigame),
                onPlayDaily: (minigame) => this.startDaily(minigame),
                onCreateParty: (name) => this.openParty(name, null),
                onJoinParty: (name, code) => this.openParty(name, code),
            }),
        );
    }

    /** Solo Arcade. Uses a server run (seed + leaderboard) when online, a local seed otherwise. */
    async startSolo(minigame: MinigameDefinition, fixedSeed?: number): Promise<void> {
        const [factory, run] = await Promise.all([minigame.load(), fixedSeed === undefined ? startRun(this.profile, minigame.id) : Promise.resolve(null)]);

        void this.game.scenes.switchTo(
            new MinigameScene(this.game, {
                definition: minigame,
                factory,
                character: this.profile.character,
                hat: this.profile.hat,
                seed: fixedSeed ?? run?.seed ?? randomSeed(),
                resultExtras: run ? this.leaderboardExtras(run) : undefined,
                onReplay: () => void this.startSolo(minigame, fixedSeed),
                onExit: () => this.showMainMenu('arcade'),
            }),
        );
    }

    /** Daily Challenge: everyone plays the same seed; it needs the server. */
    async startDaily(minigame: MinigameDefinition): Promise<void> {
        const [factory, run] = await Promise.all([minigame.load(), startDailyRun(this.profile)]);

        void this.game.scenes.switchTo(
            new MinigameScene(this.game, {
                definition: minigame,
                factory,
                character: this.profile.character,
                hat: this.profile.hat,
                seed: run.seed,
                eyebrow: 'Daily Challenge',
                resultExtras: this.leaderboardExtras(run),
                onReplay: () => void this.startDaily(minigame).catch(() => this.showMainMenu('daily')),
                onExit: () => this.showMainMenu('daily'),
            }),
        );
    }

    startFreePlay(): void {
        void this.game.scenes.switchTo(
            new PlaygroundScene(this.game, {
                character: this.profile.character,
                hat: this.profile.hat,
                onExit: () => this.showMainMenu(),
            }),
        );
    }

    private leaderboardExtras(run: RunInfo): ResultExtras {
        return async (result: MinigameResult) => {
            const submitted = await submitRun(run.id, result.score);
            const rank = submitted.rank ? `#${submitted.rank}` : 'Ranked';

            if (!submitted.is_daily) {
                return [{ label: 'World rank', value: rank }];
            }

            return [{ label: 'Daily challenge', value: submitted.is_official ? `Official score, ${rank}` : 'Practice (not ranked)' }];
        };
    }

    private async openParty(name: string, code: string | null): Promise<void> {
        this.profile.name = name;
        saveProfile(this.profile);
        const player = await savePlayer(displayName(this.profile), this.profile.character.id, this.profile.hat);

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
                onRound: (round) => void this.startPartyRound(session, round),
                onLeave: () => void this.leaveParty(),
                onHatChange: (hat) => {
                    this.profile.hat = hat;
                    saveProfile(this.profile);
                },
            }),
        );
    }

    private async startPartyRound(session: PartySession, round: RoundInfo): Promise<void> {
        const minigame = findMinigame(round.minigame);
        const me = session.me;

        if (!minigame || !me) {
            return;
        }

        const factory = await minigame.load();

        void this.game.scenes.switchTo(
            new MinigameScene(this.game, {
                definition: minigame,
                factory,
                character: findCharacter(me.character),
                hat: me.hat,
                seed: round.seed,
                schedule: {
                    startsAt: round.starts_at,
                    network: createMinigameNetwork(session),
                    label: `Round ${round.number} of ${round.total_rounds}`,
                    onFinished: (result) => this.showStandings(session, round, result.score),
                },
                onReplay: () => this.showLobby(),
                onExit: () => this.showLobby(),
            }),
        );
    }

    private showStandings(session: PartySession, round: RoundInfo, score: number): void {
        void session.submitResult(round.id, score).catch(() => undefined);

        void this.game.scenes.switchTo(
            new StandingsScene(this.game, {
                session,
                round,
                myScore: score,
                onNextRound: (next) => void this.startPartyRound(session, next),
                onMatchFinished: (outcome) => this.showPodium(session, outcome),
            }),
        );
    }

    private showPodium(session: PartySession, outcome: RoundOutcome): void {
        void this.game.scenes.switchTo(
            new PodiumScene(this.game, {
                standings: outcome.standings,
                players: session.room.players,
                playerId: session.player.id,
                onBack: () => this.showLobby(),
            }),
        );
    }

    private async leaveParty(): Promise<void> {
        const session = this.party;
        this.party = null;
        this.showMainMenu('party');
        await session?.leave();
    }
}
