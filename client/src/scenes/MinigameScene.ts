import type * as THREE from 'three';
import type { Game } from '../core/Game';
import type { GameScene } from '../core/GameScene';
import type { CharacterDefinition } from '../characters/roster';
import type { Minigame, MinigameDefinition, MinigameNetwork, MinigameResult } from '../minigames/types';
import { getPersonalBest, submitPersonalBest } from '../scoring/personalBest';
import { el } from '../ui/dom';
import { Countdown } from '../ui/minigame/Countdown';
import { GameHud } from '../ui/minigame/GameHud';
import { IntroCard } from '../ui/minigame/IntroCard';
import { ResultsCard } from '../ui/minigame/ResultsCard';

/** Party rounds start at a server-chosen moment instead of on a button press. */
export interface MinigameSchedule {
    /** Server time (ms) at which play begins. */
    startsAt: number;
    network: MinigameNetwork;
}

export interface MinigameSceneOptions {
    definition: MinigameDefinition;
    character: CharacterDefinition;
    seed: number;
    schedule?: MinigameSchedule;
    onReplay(): void;
    onExit(): void;
}

type Phase = 'intro' | 'countdown' | 'playing' | 'ending' | 'results';

const COUNTDOWN_SECONDS = 3;
/** Pause between the final whistle and the results card. */
const ENDING_SECONDS = 1.4;

/**
 * Runs any minigame through the same flow:
 * intro card → 3-2-1 countdown → timed play → results.
 * Solo: the player starts it and the local clock times it.
 * Party: Laravel picks the start time and every client follows the server clock.
 */
export class MinigameScene implements GameScene {
    private readonly minigame: Minigame;
    private readonly hud: GameHud;
    private readonly overlay: HTMLElement;
    private readonly layer: HTMLElement;
    private readonly countdown = new Countdown();
    private readonly duration: number;
    private phase: Phase = 'intro';
    private phaseTime = 0;
    private localElapsed = 0;
    private intro: IntroCard | null = null;
    private results: ResultsCard | null = null;

    constructor(private readonly game: Game, private readonly options: MinigameSceneOptions) {
        const { definition, character, seed, schedule } = options;

        this.hud = new GameHud(definition.name, character.name, options.onExit);
        this.overlay = el('div', { className: 'minigame-overlay' });
        this.layer = el('div', { className: 'minigame-layer' }, [this.hud.root, this.overlay]);
        this.duration = definition.durationSeconds;

        this.minigame = definition.create({ character, seed, hud: this.hud, overlay: this.overlay, network: schedule?.network });
    }

    get scene(): THREE.Scene {
        return this.minigame.scene;
    }

    get camera(): THREE.Camera {
        return this.minigame.camera;
    }

    private get isParty(): boolean {
        return this.options.schedule !== undefined;
    }

    enter(): void {
        this.game.uiRoot.append(this.layer);
        this.game.input.setEnabled(false);
        this.game.input.setGameplayControls(true, this.options.definition.actionLabel);
        this.hud.setTime(this.duration);
        this.hud.setVisible(false);
        window.addEventListener('keydown', this.onKeyDown);

        const { definition } = this.options;
        this.intro = this.isParty
            ? new IntroCard(definition, null)
            : new IntroCard(definition, getPersonalBest(definition.id), () => this.setPhase('countdown'));
        this.intro.mount(this.game.uiRoot);
    }

    exit(): void {
        window.removeEventListener('keydown', this.onKeyDown);
        this.game.input.setEnabled(true);
        this.game.input.setGameplayControls(false);
        this.intro?.unmount();
        this.results?.unmount();
        this.countdown.unmount();
        this.minigame.dispose();
        this.layer.remove();
    }

    resize(width: number, height: number): void {
        this.minigame.resize(width, height);
    }

    update(dt: number): void {
        this.phaseTime += dt;
        const untilStart = this.secondsUntilStart(dt);

        if (this.phase === 'intro' && this.isParty) {
            this.intro?.setStatus(`Starting in ${Math.max(0, Math.ceil(untilStart - COUNTDOWN_SECONDS))}…`);
            if (untilStart <= COUNTDOWN_SECONDS) {
                this.intro?.unmount();
                this.setPhase('countdown');
            }
        }

        if (this.phase === 'countdown') {
            this.countdown.update(untilStart);
            if (untilStart <= 0) {
                this.setPhase('playing');
            }
        }

        const elapsed = this.phase === 'playing' ? Math.min(this.duration, -untilStart) : null;
        const remaining = elapsed === null ? this.duration : this.duration - elapsed;

        if (this.phase === 'playing') {
            this.hud.setTime(remaining);
            this.countdown.update(untilStart);
            if (this.phaseTime > 0.7) {
                this.countdown.unmount();
            }
        }

        this.minigame.update(dt, this.game.input.snapshot, elapsed);

        if (this.phase === 'playing') {
            // In a party an eliminated player keeps watching until time is up.
            const finishedEarly = !this.isParty && this.minigame.isOver();
            if (remaining <= 0 || finishedEarly) {
                this.setPhase('ending', remaining <= 0);
            }
        }

        if (this.phase === 'ending' && this.phaseTime >= ENDING_SECONDS) {
            this.setPhase('results');
        }
    }

    /** Seconds until play starts (negative once playing). */
    private secondsUntilStart(dt: number): number {
        const { schedule } = this.options;

        if (schedule) {
            return (schedule.startsAt - schedule.network.serverNow()) / 1000;
        }

        if (this.phase === 'countdown') {
            return COUNTDOWN_SECONDS - this.phaseTime;
        }

        if (this.phase === 'playing') {
            this.localElapsed += dt;
            return -this.localElapsed;
        }

        return COUNTDOWN_SECONDS;
    }

    private setPhase(phase: Phase, timeUp = false): void {
        this.phase = phase;
        this.phaseTime = 0;

        if (phase === 'countdown') {
            this.hud.setVisible(true);
            this.countdown.mount(this.game.uiRoot);
        }

        if (phase === 'playing') {
            this.localElapsed = 0;
            this.game.input.setEnabled(true);
            this.minigame.start();
        }

        if (phase === 'ending') {
            this.game.input.setEnabled(false);
            this.countdown.unmount();
            if (timeUp) {
                this.hud.callout("Time's up!", 'neutral');
            }
        }

        if (phase === 'results') {
            this.showResults(this.minigame.getResult());
        }
    }

    private showResults(result: MinigameResult): void {
        const { definition } = this.options;
        const isRecord = !this.isParty && result.score > 0 && submitPersonalBest(definition.id, result.score);

        this.hud.setVisible(false);
        this.game.input.setGameplayControls(false);
        this.results = new ResultsCard({
            result,
            best: getPersonalBest(definition.id),
            isRecord,
            accent: definition.accent,
            mode: this.isParty ? 'party' : 'solo',
            onReplay: this.options.onReplay,
            onExit: this.options.onExit,
        });
        this.results.mount(this.game.uiRoot);
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.code === 'Escape' && this.phase !== 'results') {
            this.options.onExit();
        }
    };
}
