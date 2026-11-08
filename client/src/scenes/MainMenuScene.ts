import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { GameScene } from '../core/GameScene';
import { audio } from '../audio/AudioManager';
import { CharacterModel } from '../characters/CharacterModel';
import { ROSTER } from '../characters/roster';
import { createCloudLayer, createLighting, createSky, type CloudLayer } from '../design/environment';
import { Effects } from '../effects/Effects';
import { MINIGAMES, UPCOMING_MINIGAMES } from '../minigames/registry';
import type { MinigameDefinition } from '../minigames/types';
import type { LocalProfile } from '../online/profile';
import { syncProfile } from '../online/onlineApi';
import { DailyMenu } from '../ui/DailyMenu';
import { LeaderboardMenu } from '../ui/LeaderboardMenu';
import { MainMenu } from '../ui/MainMenu';
import { PartyMenu } from '../ui/PartyMenu';
import { ProfileMenu } from '../ui/ProfileMenu';
import { SoloArcadeMenu } from '../ui/SoloArcadeMenu';
import { TopBar } from '../ui/TopBar';
import { WardrobeMenu } from '../ui/WardrobeMenu';
import { damp, randomRange } from '../utils/math';
import { PartyStage } from '../world/PartyStage';

export type MenuView = 'main' | 'arcade' | 'party' | 'daily' | 'leaderboard' | 'profile' | 'wardrobe';

export interface MainMenuOptions {
    profile: LocalProfile;
    view?: MenuView;
    onProfileChange(profile: LocalProfile): void;
    onFreePlay(): void;
    onPlayMinigame(minigame: MinigameDefinition): void;
    onPlayRandom(): void;
    onPlayDaily(minigame: MinigameDefinition): Promise<void>;
    onCreateParty(name: string): Promise<void>;
    onJoinParty(name: string, code: string): Promise<void>;
}

interface Performer {
    model: CharacterModel;
    homeX: number;
    y: number;
    vy: number;
    hopTimer: number;
}

interface Panel {
    mount(): void;
    unmount(): void;
}

const GRAVITY = 30;

/** Title screen: the cast hops around on a floating stage next to the menus. */
export class MainMenuScene implements GameScene {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 800);

    private readonly stage = new THREE.Group();
    private readonly partyStage = new PartyStage();
    private readonly performers: Performer[] = [];
    private readonly effects: Effects;
    private readonly clouds: CloudLayer;
    private readonly topBar: TopBar;
    private readonly leaderboard: LeaderboardMenu;
    private readonly panels: Record<MenuView, Panel>;
    private selectedIndex: number;
    private view: MenuView;
    private time = 0;
    private confettiTimer = 1.2;
    private readonly cameraBase = new THREE.Vector3(0, 3.4, 11);
    private readonly lookAt = new THREE.Vector3(0, 1.3, 0);
    private readonly currentLook = new THREE.Vector3(0, 1.3, 0);
    private cameraPlaced = false;
    private readonly stageTarget = new THREE.Vector3(3.4, 0, 0);
    private stageScaleTarget = 1;
    private landscape = true;
    private viewport = { width: 1, height: 1 };
    private layoutTimer = 0;

    constructor(private readonly game: Game, private readonly options: MainMenuOptions) {
        this.selectedIndex = Math.max(0, ROSTER.indexOf(options.profile.character));

        this.scene.add(createSky());
        createLighting(this.scene, 10);
        this.clouds = createCloudLayer(14, 30, 70, -6, 16);
        this.scene.add(this.clouds.group, this.stage);
        this.stage.add(this.partyStage.group);
        this.effects = new Effects(this.scene);
        this.buildCast();

        const back = (): void => this.showView('main');

        const menu = new MainMenu(game.uiRoot, {
            onSoloArcade: () => this.showView('arcade'),
            onPrivateParty: () => this.showView('party'),
            onDailyChallenge: () => this.showView('daily'),
            onLeaderboard: () => this.showView('leaderboard'),
            onFreePlay: () => options.onFreePlay(),
        });

        this.topBar = new TopBar(game.uiRoot, { onProfile: () => this.showView('profile'), onWardrobe: () => this.showView('wardrobe') });
        const changeLook = (profile: LocalProfile): void => {
            this.applyProfile(profile);
            void syncProfile(profile).catch(() => undefined);
        };

        this.leaderboard = new LeaderboardMenu(game.uiRoot, back);

        this.panels = {
            main: menu,
            arcade: new SoloArcadeMenu(game.uiRoot, { minigames: MINIGAMES, upcoming: UPCOMING_MINIGAMES, onPlay: (minigame) => options.onPlayMinigame(minigame), onRandom: () => options.onPlayRandom(), onBack: back }),
            party: new PartyMenu(game.uiRoot, { defaultName: options.profile.name, onCreate: options.onCreateParty, onJoin: options.onJoinParty, onBack: back }),
            daily: new DailyMenu(game.uiRoot, { onPlay: options.onPlayDaily, onLeaderboard: () => this.showLeaderboard('daily'), onBack: back }),
            leaderboard: this.leaderboard,
            profile: new ProfileMenu(game.uiRoot, { profile: options.profile, onChange: (profile) => this.applyProfile(profile), onBack: back }),
            wardrobe: new WardrobeMenu(game.uiRoot, { profile: options.profile, onChange: changeLook, onBack: back }),
        };

        this.view = options.view ?? 'main';
    }

    enter(): void {
        this.game.input.setGameplayControls(false);
        audio.setMusic('menu');
        this.topBar.mount();
        this.renderTopBar();
        this.showView(this.view);
    }

    exit(): void {
        this.topBar.unmount();
        Object.values(this.panels).forEach((panel) => panel.unmount());
    }

    private renderTopBar(): void {
        this.topBar.render(this.options.profile.name, this.options.profile.character.body);
    }

    resize(width: number, height: number): void {
        const aspect = width / height;
        this.camera.aspect = aspect;

        this.viewport = { width, height };
        this.landscape = aspect >= 1.15;

        if (this.landscape) {
            this.stageTarget.set(3.4, 0, 0);
            this.cameraBase.set(0.6, 3.8, 13.5);
            this.lookAt.set(0.6, 1.4, 0);
            this.camera.fov = 40;
        } else {
            this.camera.fov = 50;
            const halfHorizontalFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
            const distance = Math.min(32, Math.max(14, 4.6 / Math.tan(halfHorizontalFov)));
            this.stageTarget.set(0, 0, 0);
            this.stageScaleTarget = 1;
            this.cameraBase.set(0, distance * 0.3, distance);
            this.lookAt.set(0, 0.2, 0);
        }

        this.camera.updateProjectionMatrix();
        this.layoutCast();
    }

    /**
     * Keeps the cast in the free space to the right of whatever panel is
     * open: wide panels push the stage right and shrink it if needed.
     */
    private layoutCast(): void {
        if (!this.landscape) {
            return;
        }

        const panel = document.querySelector('#ui .arcade') ?? document.querySelector('#ui .menu__actions');
        const { width } = this.viewport;
        const panelRight = panel ? panel.getBoundingClientRect().right : 0;
        const freeLeft = Math.min(width * 0.75, panelRight + 24);
        const visibleWidth = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.cameraBase.z * this.camera.aspect;
        const unitsPerPixel = visibleWidth / width;
        const freeCenter = (freeLeft + width) / 2;
        const castWidth = 8.6;

        this.stageTarget.x = this.lookAt.x + (freeCenter - width / 2) * unitsPerPixel;
        this.stageScaleTarget = Math.min(1, Math.max(0.55, ((width - freeLeft) * unitsPerPixel) / castWidth));
    }

    update(dt: number): void {
        this.time += dt;

        this.performers.forEach((performer, index) => this.updatePerformer(performer, index === this.selectedIndex, dt));

        this.confettiTimer -= dt;
        if (this.confettiTimer <= 0) {
            this.confettiTimer = randomRange(2.5, 4.5);
            this.effects.confetti(new THREE.Vector3(randomRange(-4, 4), 5.5, randomRange(-2, 1)).add(this.stage.position), 40);
        }

        this.layoutTimer -= dt;
        if (this.layoutTimer <= 0) {
            this.layoutTimer = 0.25;
            this.layoutCast();
        }

        const settle = this.cameraPlaced ? damp(5, dt) : 1;
        this.stage.position.lerp(this.stageTarget, settle);
        this.stage.scale.setScalar(this.stage.scale.x + (this.stageScaleTarget - this.stage.scale.x) * settle);
        this.stage.rotation.y = Math.sin(this.time * 0.25) * 0.08;
        this.updateCamera(dt);

        this.partyStage.update(dt, this.time);
        this.clouds.update(dt);
        this.effects.update(dt);
    }

    /** Normal sway, or a close-up of your own character in the wardrobe. */
    private updateCamera(dt: number): void {
        const sway = new THREE.Vector3(Math.sin(this.time * 0.2) * 0.4, Math.sin(this.time * 0.33) * 0.15, 0);
        const desiredPosition = this.cameraBase.clone().add(sway);
        const desiredLook = this.lookAt.clone();

        if (this.view === 'wardrobe') {
            const focus = this.performers[this.selectedIndex].model.root.getWorldPosition(new THREE.Vector3());
            const portrait = this.camera.aspect < 1.15;
            desiredLook.set(focus.x + (portrait ? 0 : -1.2), focus.y + (portrait ? -1.4 : 1), focus.z);
            desiredPosition.set(focus.x + (portrait ? 0 : -1.6), focus.y + (portrait ? 1 : 2), focus.z + (portrait ? 9.5 : 6.2));
        }

        const smoothing = this.cameraPlaced ? damp(4, dt) : 1;
        this.cameraPlaced = true;
        this.camera.position.lerp(desiredPosition, smoothing);
        this.currentLook.lerp(desiredLook, smoothing);
        this.camera.lookAt(this.currentLook);
    }

    private showView(view: MenuView): void {
        if (view !== this.view) {
            audio.play('click');
        }

        this.view = view;
        Object.values(this.panels).forEach((panel) => panel.unmount());
        this.panels[view].mount();
        this.layoutCast();
    }

    private showLeaderboard(board: string): void {
        this.showView('leaderboard');
        this.leaderboard.unmount();
        this.leaderboard.mount(board);
    }


    /** Re-dresses the cast when the character or hat changes, with a happy hop. */
    private applyProfile(profile: LocalProfile): void {
        this.options.onProfileChange(profile);
        this.selectedIndex = ROSTER.indexOf(profile.character);
        this.renderTopBar();

        this.performers.forEach((performer, index) => {
            const hat = index === this.selectedIndex ? profile.hat : null;
            const position = performer.model.root.position.clone();
            const scale = performer.model.root.scale.x;
            this.stage.remove(performer.model.root);
            performer.model = new CharacterModel(ROSTER[index], hat);
            performer.model.root.position.copy(position);
            performer.model.root.scale.setScalar(scale);
            this.stage.add(performer.model.root);
        });

        const performer = this.performers[this.selectedIndex];
        if (performer.y === 0) {
            performer.vy = 10;
            performer.model.jump();
        }

        audio.play('pop');
        this.effects.confetti(performer.model.root.getWorldPosition(new THREE.Vector3()).setY(1.6), 50);
    }

    private updatePerformer(performer: Performer, selected: boolean, dt: number): void {
        const { model } = performer;
        const root = model.root;
        const smoothing = damp(8, dt);

        root.position.z += ((selected ? 1.6 : 0) - root.position.z) * smoothing;
        root.position.x += (performer.homeX - root.position.x) * smoothing;
        root.scale.setScalar(root.scale.x + ((selected ? 1.25 : 1) - root.scale.x) * smoothing);
        root.rotation.y += ((selected ? Math.sin(this.time * 1.2) * 0.25 : performer.homeX * -0.08) - root.rotation.y) * smoothing;

        performer.hopTimer -= dt;
        if (performer.y === 0 && performer.hopTimer <= 0) {
            performer.vy = selected ? randomRange(7, 9) : randomRange(5, 8);
            performer.hopTimer = selected ? randomRange(0.9, 1.8) : randomRange(1.5, 4);
            model.jump();
        }

        if (performer.vy !== 0 || performer.y > 0) {
            performer.vy -= GRAVITY * dt;
            performer.y += performer.vy * dt;

            if (performer.y <= 0) {
                model.land(Math.abs(performer.vy));
                if (selected) {
                    this.effects.landing(root.getWorldPosition(new THREE.Vector3()), 10);
                }
                performer.y = 0;
                performer.vy = 0;
            }
        }

        root.position.y = performer.y;
        model.update(dt, { speed: 0, grounded: performer.y === 0, verticalVelocity: performer.vy });
    }

    private buildCast(): void {
        const spacing = 1.9;

        ROSTER.forEach((definition, index) => {
            const model = new CharacterModel(definition, index === this.selectedIndex ? this.options.profile.hat : null);
            const homeX = (index - (ROSTER.length - 1) / 2) * spacing;
            model.root.position.set(homeX, 0, 0);
            this.stage.add(model.root);
            this.performers.push({ model, homeX, y: 0, vy: 0, hopTimer: randomRange(0.3, 2) });
        });
    }
}
