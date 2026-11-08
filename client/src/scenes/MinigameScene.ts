import type * as THREE from 'three';
import type { Game } from '../core/Game';
import type { GameScene } from '../core/GameScene';
import type { CharacterDefinition } from '../characters/roster';
import type { Minigame, MinigameDefinition, MinigameResult } from '../minigames/types';
import { getPersonalBest, submitPersonalBest } from '../scoring/personalBest';
import { el } from '../ui/dom';
import { Countdown } from '../ui/minigame/Countdown';
import { GameHud } from '../ui/minigame/GameHud';
import { IntroCard } from '../ui/minigame/IntroCard';
import { ResultsCard } from '../ui/minigame/ResultsCard';

export interface MinigameSceneOptions {
    definition: MinigameDefinition;
    character: CharacterDefinition;
    seed: number;
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
 * Minigames only implement their own world and rules.
 */
export class MinigameScene implements GameScene {
    private readonly minigame: Minigame;
    private readonly hud: GameHud;
    private readonly overlay: HTMLElement;
    private readonly layer: HTMLElement;
    private readonly countdown = new Countdown();
    private phase: Phase = 'intro';
    private phaseTime = 0;
    private remaining: number;
    private intro: IntroCard | null = null;
    private results: ResultsCard | null = null;

    constructor(private readonly game: Game, private readonly options: MinigameSceneOptions) {
        const { definition, character, seed } = options;

        this.hud = new GameHud(definition.name, character.name, options.onExit);
        this.overlay = el('div', { className: 'minigame-overlay' });
        this.layer = el('div', { className: 'minigame-layer' }, [this.hud.root, this.overlay]);
        this.remaining = definition.durationSeconds;

        this.minigame = definition.create({ character, seed, hud: this.hud, overlay: this.overlay });
    }

    get scene(): THREE.Scene {
        return this.minigame.scene;
    }

    get camera(): THREE.Camera {
        return this.minigame.camera;
    }

    enter(): void {
        this.game.uiRoot.append(this.layer);
        this.game.input.setEnabled(false);
        this.game.input.setGameplayControls(true, this.options.definition.actionLabel);
        this.hud.setTime(this.remaining);
        this.hud.setVisible(false);
        window.addEventListener('keydown', this.onKeyDown);

        this.intro = new IntroCard(this.options.definition, getPersonalBest(this.options.definition.id), () => this.setPhase('countdown'));
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
        const playing = this.phase === 'playing';

        if (this.phase === 'countdown') {
            this.countdown.update(COUNTDOWN_SECONDS - this.phaseTime);
            if (this.phaseTime >= COUNTDOWN_SECONDS) {
                this.setPhase('playing');
            }
        }

        if (playing) {
            this.remaining = Math.max(0, this.remaining - dt);
            this.hud.setTime(this.remaining);
            // Keep "GO!" on screen for a moment after the start.
            this.countdown.update(-this.phaseTime);
            if (this.phaseTime > 0.7) {
                this.countdown.unmount();
            }
        }

        this.minigame.update(dt, this.game.input.snapshot, playing);

        if (playing && (this.remaining <= 0 || this.minigame.isOver())) {
            this.setPhase('ending');
        }

        if (this.phase === 'ending' && this.phaseTime >= ENDING_SECONDS) {
            this.setPhase('results');
        }
    }

    private setPhase(phase: Phase): void {
        this.phase = phase;
        this.phaseTime = 0;

        if (phase === 'countdown') {
            this.hud.setVisible(true);
            this.countdown.mount(this.game.uiRoot);
        }

        if (phase === 'playing') {
            this.game.input.setEnabled(true);
            this.minigame.start();
        }

        if (phase === 'ending') {
            this.game.input.setEnabled(false);
            this.countdown.unmount();
            if (this.remaining <= 0) {
                this.hud.callout("Time's up!", 'neutral');
            }
        }

        if (phase === 'results') {
            this.showResults(this.minigame.getResult());
        }
    }

    private showResults(result: MinigameResult): void {
        const { definition } = this.options;
        const isRecord = result.score > 0 && submitPersonalBest(definition.id, result.score);

        this.hud.setVisible(false);
        this.game.input.setGameplayControls(false);
        this.results = new ResultsCard({
            result,
            best: getPersonalBest(definition.id),
            isRecord,
            accent: definition.accent,
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
