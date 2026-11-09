import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { GameScene } from '../core/GameScene';
import { CharacterModel } from '../characters/CharacterModel';
import { createNameTag } from '../characters/NameTag';
import { findCharacter } from '../characters/roster';
import { createCloudLayer, createLighting, createSky, type CloudLayer } from '../design/environment';
import { Effects } from '../effects/Effects';
import type { PartySession } from '../multiplayer/PartySession';
import type { RoomState, RoundInfo } from '../multiplayer/types';
import { LobbyPanel } from '../ui/LobbyPanel';
import { randomRange } from '../utils/math';
import { PartyStage } from '../world/PartyStage';
import { MINIGAMES } from '../minigames/registry';
import { audio } from '../audio/AudioManager';

export interface LobbySceneOptions {
    session: PartySession;
    onRound(round: RoundInfo): void;
    onLeave(): void;
    onHatChange(hat: string | null): void;
}

interface SeatActor {
    playerId: number;
    character: string;
    model: CharacterModel;
    y: number;
    vy: number;
    hopTimer: number;
    ready: boolean;
}

const SEAT_SPACING = 1.7;

/** Party lobby: the party's characters on stage, the lobby panel on the side. */
export class LobbyScene implements GameScene {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 800);

    private readonly stage = new THREE.Group();
    private readonly partyStage = new PartyStage();
    private readonly actors = new Map<number, SeatActor>();
    private readonly effects: Effects;
    private readonly clouds: CloudLayer;
    private readonly panel: LobbyPanel;
    private readonly unsubscribers: (() => void)[] = [];
    private readonly cameraBase = new THREE.Vector3(0.6, 3.8, 13.5);
    private readonly lookAt = new THREE.Vector3(0.6, 1.4, 0);
    private time = 0;

    constructor(private readonly game: Game, private readonly options: LobbySceneOptions) {
        this.scene.add(createSky());
        createLighting(this.scene, 10);
        this.clouds = createCloudLayer(14, 30, 70, -6, 16);
        this.scene.add(this.clouds.group);
        this.effects = new Effects(this.scene);
        this.scene.add(this.stage);
        this.stage.add(this.partyStage.group);

        const { session } = options;
        this.panel = new LobbyPanel(game.uiRoot, {
            playerId: session.player.id,
            onReady: (isReady) => session.setReady(isReady),
            onCharacter: (character) => session.setCharacter(character),
            onHat: async (hat) => {
                await session.setHat(hat);
                options.onHatChange(hat);
            },
            onStart: () => session.startMatch(),
            onLeave: options.onLeave,
        });
    }

    enter(): void {
        const { session } = this.options;
        this.game.input.setGameplayControls(false);
        this.panel.mount();
        this.sync(session.room);

        this.unsubscribers.push(
            session.events.on('room', (room) => this.sync(room)),
            session.events.on('presence', () => this.sync(session.room)),
            session.events.on('round', (round) => this.options.onRound(round)),
            session.events.on('disconnected', () => this.panel.showMessage('Connection lost. Reconnecting…')),
        );

        // Arrived (or reconnected) while a round was about to start: hop straight in.
        const round = session.upcomingRound;
        if (round && round.starts_at > session.clock.now()) {
            this.options.onRound(round);
        }

        // Warm up every minigame's code so round starts never wait on a download.
        MINIGAMES.forEach((minigame) => void minigame.load());
        audio.setMusic('menu');

        void session.refresh().catch(() => this.panel.showMessage('Could not reach the party server.'));
    }

    exit(): void {
        this.unsubscribers.forEach((unsubscribe) => unsubscribe());
        this.panel.unmount();
    }

    resize(width: number, height: number): void {
        const aspect = width / height;
        this.camera.aspect = aspect;

        if (aspect >= 1.15) {
            this.stage.position.set(4.6, 0, 0);
            this.cameraBase.set(1.2, 3.8, 13.5);
            this.lookAt.set(1.2, 1.4, 0);
            this.camera.fov = 40;
        } else {
            // Portrait: the lobby panel fills the screen, the stage peeks out behind it.
            this.stage.position.set(0, 0, 0);
            this.cameraBase.set(0, 3, 18);
            this.lookAt.set(0, -2.5, 0);
            this.camera.fov = 50;
        }

        this.camera.updateProjectionMatrix();
    }

    update(dt: number): void {
        this.time += dt;

        for (const actor of this.actors.values()) {
            this.updateActor(actor, dt);
        }

        this.camera.position.set(this.cameraBase.x + Math.sin(this.time * 0.2) * 0.4, this.cameraBase.y, this.cameraBase.z);
        this.camera.lookAt(this.lookAt);
        this.partyStage.update(dt, this.time);
        this.clouds.update(dt);
        this.effects.update(dt);
    }

    private sync(room: RoomState): void {
        this.panel.render(room, this.options.session.online);

        const present = new Set(room.players.map((player) => player.id));

        for (const [playerId, actor] of this.actors) {
            if (!present.has(playerId)) {
                this.effects.poof(actor.model.root.getWorldPosition(new THREE.Vector3()).setY(0.6));
                this.stage.remove(actor.model.root);
                this.actors.delete(playerId);
            }
        }

        for (const player of room.players) {
            let actor = this.actors.get(player.id);

            // Re-create the model when someone switches character.
            if (actor && actor.character !== `${player.character}:${player.hat}`) {
                this.stage.remove(actor.model.root);
                this.actors.delete(player.id);
                actor = undefined;
            }

            if (!actor) {
                const definition = findCharacter(player.character);
                const model = new CharacterModel(definition, player.hat);
                model.root.add(createNameTag(player.name, definition.body, player.id === this.options.session.player.id));
                this.stage.add(model.root);
                actor = { playerId: player.id, character: `${player.character}:${player.hat}`, model, y: 0, vy: 6, hopTimer: randomRange(0.5, 2), ready: false };
                this.actors.set(player.id, actor);
                this.effects.confetti(new THREE.Vector3(this.seatX(player.seat), 2, 0).add(this.stage.position), 30);
            }

            if (player.is_ready && !actor.ready) {
                actor.vy = 9;
                actor.model.jump();
            }

            actor.ready = player.is_ready;
            actor.model.root.position.x = this.seatX(player.seat);
            actor.model.root.traverse((object) => {
                if (object instanceof THREE.Sprite) {
                    object.material.opacity = this.options.session.online.has(player.id) ? 1 : 0.4;
                }
            });
        }
    }

    private seatX(seat: number): number {
        return (seat - 1.5) * SEAT_SPACING;
    }

    private updateActor(actor: SeatActor, dt: number): void {
        actor.hopTimer -= dt;

        if (actor.y === 0 && actor.hopTimer <= 0) {
            actor.vy = actor.ready ? randomRange(7, 9) : randomRange(3, 5);
            actor.hopTimer = actor.ready ? randomRange(0.8, 1.6) : randomRange(2.5, 5);
            actor.model.jump();
        }

        if (actor.vy !== 0 || actor.y > 0) {
            actor.vy -= 30 * dt;
            actor.y = Math.max(0, actor.y + actor.vy * dt);

            if (actor.y === 0) {
                actor.model.land(Math.abs(actor.vy));
                actor.vy = 0;
            }
        }

        actor.model.root.position.y = actor.y;
        actor.model.update(dt, { speed: 0, grounded: actor.y === 0, verticalVelocity: actor.vy });
    }
}
