import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { GameScene } from '../core/GameScene';
import { audio } from '../audio/AudioManager';
import { Performer } from '../characters/Performer';
import { findCharacter } from '../characters/roster';
import { createCloudLayer, createLighting, createSky, type CloudLayer } from '../design/environment';
import { Effects } from '../effects/Effects';
import { MINIGAMES } from '../minigames/registry';
import type { PartySession } from '../multiplayer/PartySession';
import type { RoundInfo, RoundOutcome } from '../multiplayer/types';
import { StandingsPanel } from '../ui/StandingsPanel';
import { PartyStage } from '../world/PartyStage';

export interface StandingsSceneOptions {
    session: PartySession;
    round: RoundInfo;
    myScore: number;
    onNextRound(round: RoundInfo): void;
    onMatchFinished(outcome: RoundOutcome): void;
}

const ROUND_RESULTS_SECONDS = 4.5;
const STANDINGS_SECONDS = 4;
/** Extra margin on top of the server's submission window before asking it to close the round. */
const FINALIZE_MARGIN_MS = 4500;

type Step = 'waiting' | 'round' | 'standings' | 'done';

/** Between rounds: everyone's results and the running tournament table. */
export class StandingsScene implements GameScene {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 800);

    private readonly stage = new THREE.Group();
    private readonly partyStage = new PartyStage();
    private readonly performers = new Map<number, Performer>();
    private readonly effects: Effects;
    private readonly clouds: CloudLayer;
    private readonly panel: StandingsPanel;
    private readonly unsubscribers: (() => void)[] = [];
    private outcome: RoundOutcome | null = null;
    private nextRound: RoundInfo | null = null;
    private step: Step = 'waiting';
    private stepTime = 0;
    private time = 0;
    private finalizeCooldown = 0;

    constructor(private readonly game: Game, private readonly options: StandingsSceneOptions) {
        this.scene.add(createSky());
        createLighting(this.scene, 10);
        this.clouds = createCloudLayer(14, 30, 70, -6, 16);
        this.scene.add(this.clouds.group, this.stage);
        this.stage.add(this.partyStage.group);
        this.effects = new Effects(this.scene);

        const { session } = options;
        const players = session.room.players;
        players.forEach((player, index) => {
            const performer = new Performer(findCharacter(player.character), player.hat, player.name, player.id === session.player.id);
            performer.model.root.position.x = (index - (players.length - 1) / 2) * 1.8;
            this.stage.add(performer.model.root);
            this.performers.set(player.id, performer);
        });

        this.panel = new StandingsPanel(session.player.id, new Map(players.map((player) => [player.id, player.name])));
    }

    enter(): void {
        const { session, round, myScore } = this.options;
        this.game.input.setGameplayControls(false);
        this.game.uiRoot.append(this.panel.root);
        this.panel.showWaiting(round.number, round.total_rounds, myScore);
        audio.setMusic('menu');

        this.unsubscribers.push(
            session.events.on('outcome', (outcome) => {
                if (outcome.round.id === round.id) {
                    this.receive(outcome);
                }
            }),
            session.events.on('round', (next) => {
                if (next.id !== round.id) {
                    this.nextRound = next;
                }
            }),
        );

        const known = session.outcomeFor(round.id);
        if (known) {
            this.receive(known);
        }

        const upcoming = session.upcomingRound;
        if (upcoming && upcoming.id !== round.id) {
            this.nextRound = upcoming;
        }
    }

    exit(): void {
        this.unsubscribers.forEach((unsubscribe) => unsubscribe());
        this.panel.root.remove();
    }

    resize(width: number, height: number): void {
        const aspect = width / height;
        this.camera.aspect = aspect;
        const landscape = aspect >= 1.15;
        this.stage.position.set(landscape ? 4.4 : 0, 0, 0);
        this.camera.fov = landscape ? 40 : 52;
        this.camera.position.set(landscape ? 1.2 : 0, landscape ? 3.8 : 5, landscape ? 13.5 : 17);
        this.camera.lookAt(landscape ? 1.2 : 0, landscape ? 1.4 : 3.2, 0);
        this.camera.updateProjectionMatrix();
    }

    update(dt: number): void {
        this.time += dt;
        this.stepTime += dt;

        if (this.step === 'waiting') {
            this.tryFinalize(dt);
        }

        if (this.step === 'round' && this.stepTime >= ROUND_RESULTS_SECONDS && this.outcome) {
            this.setStep('standings');
            this.panel.showStandings(this.outcome);
            this.celebrate(this.outcome.standings.filter((row) => row.rank === 1).map((row) => row.player_id));
        }

        if (this.step === 'standings') {
            this.updateFooter();

            if (this.stepTime >= STANDINGS_SECONDS) {
                this.advance();
            }
        }

        for (const performer of this.performers.values()) {
            performer.update(dt);
        }

        this.partyStage.update(dt, this.time);
        this.clouds.update(dt);
        this.effects.update(dt);
    }

    private receive(outcome: RoundOutcome): void {
        if (this.outcome) {
            return;
        }

        this.outcome = outcome;
        this.setStep('round');
        this.panel.showRound(outcome);
        this.celebrate(outcome.results.filter((result) => result.placement === 1).map((result) => result.player_id));

        const mine = outcome.results.find((result) => result.player_id === this.options.session.player.id);
        audio.play(mine?.placement === 1 ? 'bonus' : 'score');
    }

    private celebrate(playerIds: number[]): void {
        for (const [playerId, performer] of this.performers) {
            const winner = playerIds.includes(playerId);
            performer.excitement = winner ? 1 : 0.15;

            if (winner) {
                performer.hop(10);
                this.effects.confetti(performer.model.root.getWorldPosition(new THREE.Vector3()).setY(2), 40);
            }
        }
    }

    private updateFooter(): void {
        if (this.outcome?.match_finished) {
            this.panel.setFooter('And the winner is…');
            return;
        }

        if (!this.nextRound) {
            this.panel.setFooter('Preparing the next round…');
            return;
        }

        const name = MINIGAMES.find((minigame) => minigame.id === this.nextRound?.minigame)?.name ?? 'Next minigame';
        this.panel.setFooter(`Next up: ${name} (round ${this.nextRound.number} of ${this.nextRound.total_rounds})`);
    }

    private advance(): void {
        if (this.outcome?.match_finished) {
            this.setStep('done');
            this.options.onMatchFinished(this.outcome);
            return;
        }

        if (this.nextRound) {
            this.setStep('done');
            this.options.onNextRound(this.nextRound);
        }
    }

    /** If someone never reports, ask the server to close the round after the window. */
    private tryFinalize(dt: number): void {
        const { session, round } = this.options;
        this.finalizeCooldown -= dt;

        if (this.finalizeCooldown > 0 || session.clock.now() < round.ends_at + FINALIZE_MARGIN_MS) {
            return;
        }

        this.finalizeCooldown = 2;
        void session.finalize(round.id).catch(() => this.panel.setFooter('Reconnecting to the party server…'));
    }

    private setStep(step: Step): void {
        this.step = step;
        this.stepTime = 0;
    }
}
