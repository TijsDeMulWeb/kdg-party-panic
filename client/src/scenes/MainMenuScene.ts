import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { GameScene } from '../core/GameScene';
import { CharacterModel } from '../characters/CharacterModel';
import { ROSTER, type CharacterDefinition } from '../characters/roster';
import { createCloudLayer, createLighting, createSky, type CloudLayer } from '../design/environment';
import { Effects } from '../effects/Effects';
import { MainMenu } from '../ui/MainMenu';
import { SoloArcadeMenu } from '../ui/SoloArcadeMenu';
import { PartyMenu } from '../ui/PartyMenu';
import { MINIGAMES, UPCOMING_MINIGAMES } from '../minigames/registry';
import type { MinigameDefinition } from '../minigames/types';
import { PartyStage } from '../world/PartyStage';
import { damp, randomRange } from '../utils/math';

export interface MainMenuOptions {
    character: CharacterDefinition;
    onSelectCharacter(character: CharacterDefinition): void;
    onFreePlay(): void;
    onPlayMinigame(minigame: MinigameDefinition): void;
    defaultName: string;
    onCreateParty(name: string): Promise<void>;
    onJoinParty(name: string, code: string): Promise<void>;
    /** Which panel to open on. */
    view?: MenuView;
}

export type MenuView = 'main' | 'arcade' | 'party';

interface Performer {
    model: CharacterModel;
    homeX: number;
    y: number;
    vy: number;
    hopTimer: number;
}

const GRAVITY = 30;

/** Title screen: the cast hops around on a floating stage under the logo. */
export class MainMenuScene implements GameScene {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 800);

    private readonly stage = new THREE.Group();
    private readonly performers: Performer[] = [];
    private readonly partyStage = new PartyStage();
    private readonly effects: Effects;
    private readonly clouds: CloudLayer;
    private readonly menu: MainMenu;
    private readonly arcade: SoloArcadeMenu;
    private readonly party: PartyMenu;
    private view: MenuView;
    private selectedIndex: number;
    private time = 0;
    private confettiTimer = 1.2;
    private cameraBase = new THREE.Vector3(0, 3.4, 11);
    private lookAt = new THREE.Vector3(0, 1.3, 0);

    constructor(private readonly game: Game, private readonly options: MainMenuOptions) {
        this.selectedIndex = Math.max(0, ROSTER.findIndex((character) => character.id === options.character.id));

        this.scene.add(createSky());
        createLighting(this.scene, 10);
        this.clouds = createCloudLayer(14, 30, 70, -6, 16);
        this.scene.add(this.clouds.group);
        this.effects = new Effects(this.scene);

        this.buildStage();

        this.menu = new MainMenu(game.uiRoot, {
            roster: ROSTER,
            selectedIndex: this.selectedIndex,
            onSelect: (index) => this.select(index),
            onSoloArcade: () => this.showView('arcade'),
            onPrivateParty: () => this.showView('party'),
            onFreePlay: () => options.onFreePlay(),
        });

        this.arcade = new SoloArcadeMenu(game.uiRoot, {
            minigames: MINIGAMES,
            upcoming: UPCOMING_MINIGAMES,
            onPlay: (minigame) => options.onPlayMinigame(minigame),
            onBack: () => this.showView('main'),
        });

        this.party = new PartyMenu(game.uiRoot, {
            defaultName: options.defaultName,
            onCreate: options.onCreateParty,
            onJoin: options.onJoinParty,
            onBack: () => this.showView('main'),
        });

        this.view = options.view ?? 'main';
    }

    enter(): void {
        this.game.input.setGameplayControls(false);
        this.showView(this.view);
    }

    exit(): void {
        this.menu.unmount();
        this.arcade.unmount();
        this.party.unmount();
    }

    private showView(view: MenuView): void {
        this.view = view;
        this.menu.unmount();
        this.arcade.unmount();
        this.party.unmount();

        const panels = { main: this.menu, arcade: this.arcade, party: this.party };
        panels[view].mount();
    }

    resize(width: number, height: number): void {
        const aspect = width / height;
        this.camera.aspect = aspect;

        if (aspect >= 1.15) {
            // Landscape: logo and buttons on the left, cast on the right.
            this.stage.position.set(3.4, 0, 0);
            this.cameraBase.set(0.6, 3.8, 13.5);
            this.lookAt.set(0.6, 1.4, 0);
            this.camera.fov = 40;
        } else {
            // Portrait: cast centred between the logo and the buttons, pulled
            // back far enough that the whole line-up fits the narrow width.
            this.camera.fov = 50;
            const halfHorizontalFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
            const distance = Math.min(32, Math.max(14, 4.6 / Math.tan(halfHorizontalFov)));
            this.stage.position.set(0, 0, 0);
            this.cameraBase.set(0, distance * 0.3, distance);
            this.lookAt.set(0, 0.2, 0);
        }

        this.camera.updateProjectionMatrix();
    }

    update(dt: number): void {
        this.time += dt;

        this.performers.forEach((performer, index) => {
            this.updatePerformer(performer, index === this.selectedIndex, dt);
        });

        this.partyStage.update(dt, this.time);

        this.confettiTimer -= dt;
        if (this.confettiTimer <= 0) {
            this.confettiTimer = randomRange(2.5, 4.5);
            const origin = new THREE.Vector3(randomRange(-4, 4), 5.5, randomRange(-2, 1)).add(this.stage.position);
            this.effects.confetti(origin, 40);
        }

        this.stage.rotation.y = Math.sin(this.time * 0.25) * 0.08;
        this.camera.position.set(
            this.cameraBase.x + Math.sin(this.time * 0.2) * 0.4,
            this.cameraBase.y + Math.sin(this.time * 0.33) * 0.15,
            this.cameraBase.z,
        );
        this.camera.lookAt(this.lookAt);

        this.clouds.update(dt);
        this.effects.update(dt);
    }

    private select(index: number): void {
        this.selectedIndex = index;
        const performer = this.performers[index];
        this.options.onSelectCharacter(performer.model.definition);

        if (performer.y === 0) {
            performer.vy = 10;
            performer.model.jump();
        }

        const burst = new THREE.Vector3();
        performer.model.root.getWorldPosition(burst);
        burst.y += 1.6;
        this.effects.confetti(burst, 50);
    }

    private updatePerformer(performer: Performer, selected: boolean, dt: number): void {
        const { model } = performer;
        const root = model.root;

        // Selected character steps forward and grows a little.
        const targetZ = selected ? 1.6 : 0;
        const targetScale = selected ? 1.25 : 1;
        const smoothing = damp(8, dt);
        root.position.z += (targetZ - root.position.z) * smoothing;
        root.position.x += (performer.homeX - root.position.x) * smoothing;
        const scale = root.scale.x + (targetScale - root.scale.x) * smoothing;
        root.scale.setScalar(scale);
        root.rotation.y += ((selected ? Math.sin(this.time * 1.2) * 0.25 : performer.homeX * -0.08) - root.rotation.y) * smoothing;

        // Idle hopping.
        performer.hopTimer -= dt;
        const grounded = performer.y === 0;
        if (grounded && performer.hopTimer <= 0) {
            performer.vy = selected ? randomRange(7, 9) : randomRange(5, 8);
            performer.hopTimer = selected ? randomRange(0.9, 1.8) : randomRange(1.5, 4);
            model.jump();
        }

        let landed = false;
        if (performer.vy !== 0 || !grounded) {
            performer.vy -= GRAVITY * dt;
            performer.y += performer.vy * dt;

            if (performer.y <= 0) {
                landed = true;
                model.land(Math.abs(performer.vy));
                performer.y = 0;
                performer.vy = 0;
            }
        }

        root.position.y = performer.y;
        model.update(dt, { speed: 0, grounded: performer.y === 0, verticalVelocity: performer.vy });

        if (landed && selected) {
            const feet = new THREE.Vector3();
            root.getWorldPosition(feet);
            this.effects.landing(feet, 10);
        }
    }

    private buildStage(): void {
        this.scene.add(this.stage);

        this.stage.add(this.partyStage.group);

        const spacing = 1.9;
        ROSTER.forEach((definition, index) => {
            const model = new CharacterModel(definition);
            const homeX = (index - (ROSTER.length - 1) / 2) * spacing;
            model.root.position.set(homeX, 0, 0);
            this.stage.add(model.root);
            this.performers.push({ model, homeX, y: 0, vy: 0, hopTimer: randomRange(0.3, 2) });
        });
    }
}
