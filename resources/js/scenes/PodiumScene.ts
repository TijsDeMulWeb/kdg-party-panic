import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { GameScene } from '../core/GameScene';
import { audio } from '../audio/AudioManager';
import { Performer } from '../characters/Performer';
import { findCharacter } from '../characters/roster';
import { createCloudLayer, createLighting, createSky, type CloudLayer } from '../design/environment';
import { palette } from '../design/palette';
import { Effects } from '../effects/Effects';
import type { RoomPlayer, StandingRow } from '../multiplayer/types';
import { el } from '../ui/dom';
import { createBlock } from '../world/props';
import { PartyStage } from '../world/PartyStage';
import { randomRange } from '../utils/math';

export interface PodiumSceneOptions {
    standings: StandingRow[];
    players: RoomPlayer[];
    playerId: number;
    onBack(): void;
}

interface Spot {
    x: number;
    height: number;
    color: number;
}

/** Podium slots by finishing position: 1st in the middle and highest. */
const SPOTS: Spot[] = [
    { x: 0, height: 1.6, color: palette.sun },
    { x: -2, height: 1.1, color: palette.sky },
    { x: 2, height: 0.7, color: palette.coral },
    { x: 3.8, height: 0, color: palette.mint },
];

/** Final winner podium after the fifth round. */
export class PodiumScene implements GameScene {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 800);

    private readonly stage = new THREE.Group();
    private readonly partyStage = new PartyStage();
    private readonly performers: { performer: Performer; groundY: number }[] = [];
    private readonly effects: Effects;
    private readonly clouds: CloudLayer;
    private readonly panel: HTMLElement;
    private time = 0;
    private confettiTimer = 0.4;

    constructor(private readonly game: Game, options: PodiumSceneOptions) {
        this.scene.add(createSky());
        createLighting(this.scene, 10);
        this.clouds = createCloudLayer(14, 30, 70, -6, 16);
        this.scene.add(this.clouds.group, this.stage);
        this.stage.add(this.partyStage.group);
        this.effects = new Effects(this.scene);

        options.standings.forEach((row, index) => {
            const spot = SPOTS[index] ?? SPOTS[SPOTS.length - 1];
            const player = options.players.find((candidate) => candidate.id === row.player_id);

            if (spot.height > 0) {
                const block = createBlock(1.8, spot.height, 1.8, spot.color);
                block.position.set(spot.x, spot.height / 2, 0);
                this.stage.add(block);
            }

            const performer = new Performer(findCharacter(row.character), player?.hat ?? null, row.name, row.player_id === options.playerId);
            performer.model.root.position.x = spot.x;
            performer.excitement = row.rank === 1 ? 1 : 0.3;
            this.stage.add(performer.model.root);
            this.performers.push({ performer, groundY: spot.height });
        });

        const winners = options.standings.filter((row) => row.rank === 1).map((row) => row.name);
        const title = winners.length > 1 ? `${winners.join(' & ')} tie!` : `${winners[0] ?? 'Nobody'} wins!`;
        const ordinals = ['1st', '2nd', '3rd', '4th'];

        this.panel = el('div', { className: 'podium-panel' }, [
            el('h2', { className: 'podium-panel__title', text: title }),
            el(
                'ol',
                { className: 'podium-panel__list' },
                options.standings.map((row) =>
                    el('li', { className: row.player_id === options.playerId ? 'is-me' : '' }, [
                        el('span', { text: ordinals[row.rank - 1] ?? `${row.rank}th` }),
                        el('span', { text: row.name }),
                        el('strong', { text: `${row.total_points} pts` }),
                    ]),
                ),
            ),
            el('button', { className: 'pp-button pp-button--primary', text: 'Back to lobby', onClick: () => options.onBack() }),
        ]);
    }

    enter(): void {
        this.game.input.setGameplayControls(false);
        this.game.uiRoot.append(this.panel);
        audio.play('win');
    }

    exit(): void {
        this.panel.remove();
    }

    resize(width: number, height: number): void {
        const aspect = width / height;
        this.camera.aspect = aspect;
        this.camera.fov = aspect < 1 ? 58 : 40;
        this.camera.position.set(0, aspect < 1 ? 5 : 4, aspect < 1 ? 15 : 11);
        this.camera.lookAt(0, aspect < 1 ? 0.6 : 1.8, 0);
        this.camera.updateProjectionMatrix();
    }

    update(dt: number): void {
        this.time += dt;
        this.confettiTimer -= dt;

        if (this.confettiTimer <= 0) {
            this.confettiTimer = randomRange(0.8, 1.6);
            this.effects.confetti(new THREE.Vector3(randomRange(-3, 3), 5, randomRange(-1, 1)), 50);
            audio.play('pop', 0.5);
        }

        for (const { performer, groundY } of this.performers) {
            performer.update(dt, groundY);
        }

        this.stage.rotation.y = Math.sin(this.time * 0.3) * 0.12;
        this.partyStage.update(dt, this.time);
        this.clouds.update(dt);
        this.effects.update(dt);
    }
}
