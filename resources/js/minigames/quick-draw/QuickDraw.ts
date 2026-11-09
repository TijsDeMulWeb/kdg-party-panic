import * as THREE from 'three';
import { audio } from '../../audio/AudioManager';
import type { InputSnapshot } from '../../core/InputManager';
import { CharacterModel } from '../../characters/CharacterModel';
import { createNameTag } from '../../characters/NameTag';
import { createLighting, createSky } from '../../design/environment';
import { addOutline, toonMaterial } from '../../design/materials';
import { palette, partyColors } from '../../design/palette';
import { Effects } from '../../effects/Effects';
import { el } from '../../ui/dom';
import { PartyStage } from '../../world/PartyStage';
import type { Minigame, MinigameContext, MinigameFactory, MinigameResult } from '../types';
import { planDuels, reactionPoints, RESPONSE_WINDOW, type DuelPlan } from './rules';

type DuelStatus = 'waiting' | 'ready' | 'signal' | 'done';

interface Contestant {
    id: number;
    name: string;
    model: CharacterModel;
    /** Reaction in ms for the current duel, -1 for a false start. */
    reaction: number | null;
    hop: number;
}

/**
 * Quick Draw: wait for the signal, then press as fast as you can. Press
 * too early and that duel is lost. Everyone uses the same server-timed
 * signals, so reactions are directly comparable.
 */
class QuickDraw implements Minigame {
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
    private readonly duels: DuelPlan[];
    private readonly effects: Effects;
    private readonly stage = new PartyStage(7);
    private readonly lamp: THREE.Mesh;
    private readonly lampMaterial = toonMaterial(palette.coral);
    private readonly contestants: Contestant[] = [];
    private readonly banner: HTMLElement;
    private readonly bannerText: HTMLElement;
    private readonly reactionBoard: HTMLElement;
    private readonly unsubscribe: (() => void) | null = null;
    private readonly onPointer = (): void => {
        this.tapped = true;
    };
    private tapped = false;
    private duelIndex = 0;
    private status: DuelStatus = 'waiting';
    private fakeShown = false;
    private time = 0;
    private visualTime = 0;
    private score = 0;
    private wins = 0;
    private falseStarts = 0;
    private bestReaction: number | null = null;

    constructor(private readonly context: MinigameContext) {
        this.duels = planDuels(context.seed);

        this.scene.add(createSky());
        createLighting(this.scene, 10);
        this.effects = new Effects(this.scene);
        this.scene.add(this.stage.group);

        this.lamp = this.createSignalLamp();

        const players = [
            { id: context.network?.localPlayerId ?? 0, name: 'You', definition: context.character, hat: context.hat, local: true },
            ...(context.network?.remotePlayers ?? []).map((player) => ({ id: player.id, name: player.name, definition: player.character, hat: player.hat, local: false })),
        ];

        players.forEach((player, index) => {
            const model = new CharacterModel(player.definition, player.hat);
            model.root.add(createNameTag(player.name, player.definition.body, player.local));
            model.root.position.set((index - (players.length - 1) / 2) * 2.2, 0, 1.5);
            this.scene.add(model.root);
            this.contestants.push({ id: player.id, name: player.name, model, reaction: null, hop: 0 });
        });

        this.bannerText = el('span', { className: 'quick-draw__text', text: 'Get ready…' });
        this.reactionBoard = el('ol', { className: 'quick-draw__board' });
        this.banner = el('div', { className: 'quick-draw' }, [this.bannerText, this.reactionBoard]);
        context.overlay.append(this.banner);

        if (context.network) {
            this.unsubscribe = context.network.onSnapshot((playerId, snapshot) => this.receive(playerId, snapshot.e));
        }

        window.addEventListener('pointerdown', this.onPointer);
    }

    start(): void {
        this.time = 0;
    }

    getScore(): number {
        return this.score;
    }

    update(dt: number, input: InputSnapshot, elapsed: number | null): void {
        this.visualTime += dt;
        const pressed = input.actionPressed || input.jumpPressed || this.tapped;
        this.tapped = false;

        if (elapsed !== null) {
            this.time = elapsed;
            this.runDuel(pressed);
        }

        this.lamp.rotation.y += dt * 0.6;
        for (const contestant of this.contestants) {
            contestant.hop = Math.max(0, contestant.hop - dt * 2.5);
            contestant.model.root.position.y = Math.sin(contestant.hop * Math.PI) * 1.2;
            contestant.model.update(dt, { speed: 0, grounded: contestant.hop === 0, verticalVelocity: contestant.hop > 0.5 ? 4 : -4 });
        }

        this.sendReaction(dt);
        this.effects.update(dt);
        this.stage.update(dt, this.visualTime);
        this.camera.position.set(0, 3.2 + Math.sin(this.visualTime * 0.5) * 0.05, 11);
        this.camera.lookAt(0, 1.8, 0);
    }

    isOver(): boolean {
        return false;
    }

    getResult(): MinigameResult {
        return {
            score: this.score,
            title: this.falseStarts === 0 ? 'Steady hands!' : 'Quick on the draw!',
            stats: [
                { label: 'Fastest reaction', value: this.bestReaction === null ? 'None' : `${Math.round(this.bestReaction)} ms` },
                { label: 'Duels won', value: this.context.network ? String(this.wins) : `${this.wins} / ${this.duels.length}` },
                { label: 'False starts', value: String(this.falseStarts) },
            ],
        };
    }

    resize(width: number, height: number): void {
        this.camera.aspect = width / height;
        this.camera.fov = width < height ? 62 : 40;
        this.camera.updateProjectionMatrix();
    }

    dispose(): void {
        window.removeEventListener('pointerdown', this.onPointer);
        this.unsubscribe?.();
        this.banner.remove();
    }

    private get me(): Contestant {
        return this.contestants[0];
    }

    private runDuel(pressed: boolean): void {
        const duel = this.duels[this.duelIndex];

        if (!duel) {
            this.setBanner('That’s all, folks!', 'done');
            return;
        }

        if (this.status === 'waiting' && this.time >= duel.readyAt) {
            this.status = 'ready';
            this.fakeShown = false;
            this.contestants.forEach((contestant) => (contestant.reaction = null));
            this.reactionBoard.replaceChildren();
            this.setLamp(palette.coral);
            this.setBanner(`Duel ${duel.index + 1}: wait for it…`, 'ready');
        }

        if (this.status === 'ready') {
            if (duel.fakeAt !== null && !this.fakeShown && this.time >= duel.fakeAt) {
                this.fakeShown = true;
                this.setLamp(palette.sun);
                this.setBanner('Not yet…', 'fake');
                audio.play('tick');
            }

            if (pressed && this.me.reaction === null) {
                this.me.reaction = -1;
                this.falseStarts++;
                this.context.hud.callout('Too soon!', 'bad');
                audio.play('wrong');
            }

            if (this.time >= duel.signalAt) {
                this.status = 'signal';
                this.setLamp(palette.mint);
                this.setBanner('GO!', 'go');
                this.effects.confetti(new THREE.Vector3(0, 4, -1), 30);
                audio.play('go');
            }
        }

        if (this.status === 'signal') {
            if (pressed && this.me.reaction === null) {
                this.react((this.time - duel.signalAt) * 1000);
            }

            if (this.time >= duel.signalAt + RESPONSE_WINDOW) {
                this.finishDuel();
            }
        }

        if (this.status === 'done' && this.time >= duel.signalAt + RESPONSE_WINDOW + 0.8) {
            this.duelIndex++;
            this.status = 'waiting';
        }
    }

    private react(reactionMs: number): void {
        this.me.reaction = reactionMs;
        this.me.hop = 1;
        const points = reactionPoints(reactionMs / 1000);
        this.score += points;
        this.bestReaction = this.bestReaction === null ? reactionMs : Math.min(this.bestReaction, reactionMs);
        this.context.hud.setScore(this.score);
        this.context.hud.callout(`${Math.round(reactionMs)} ms +${points}`, 'good');
        audio.play(reactionMs < 300 ? 'bonus' : 'score');
    }

    private finishDuel(): void {
        this.status = 'done';
        this.setLamp(palette.coral);

        const valid = this.contestants.filter((contestant) => contestant.reaction !== null && contestant.reaction >= 0);
        const fastest = valid.sort((a, b) => (a.reaction ?? 0) - (b.reaction ?? 0))[0];

        if (fastest) {
            fastest.hop = 1;
            if (fastest === this.me) {
                this.wins++;
            }
        }

        if (!this.context.network && this.me.reaction !== null && this.me.reaction >= 0 && this.me.reaction < 450) {
            this.wins++;
        }

        this.setBanner(fastest ? `${fastest.name === 'You' ? 'You were' : `${fastest.name} was`} fastest!` : 'Nobody made it!', 'done');
        this.renderBoard();
    }

    private renderBoard(): void {
        const rows = [...this.contestants].sort((a, b) => this.sortKey(a) - this.sortKey(b));
        this.reactionBoard.replaceChildren(
            ...rows.map((contestant) =>
                el('li', {}, [
                    el('span', { text: contestant.name }),
                    el('strong', { text: contestant.reaction === null ? 'missed' : contestant.reaction < 0 ? 'too soon' : `${Math.round(contestant.reaction)} ms` }),
                ]),
            ),
        );
    }

    private sortKey(contestant: Contestant): number {
        if (contestant.reaction === null) {
            return 10_000;
        }

        return contestant.reaction < 0 ? 20_000 : contestant.reaction;
    }

    /** Reactions travel in snapshots as [duelIndex, reactionMs]; -1 is a false start. */
    private sendReaction(dt: number): void {
        if (!this.context.network) {
            return;
        }

        this.sendTimer -= dt;
        if (this.sendTimer > 0) {
            return;
        }

        this.sendTimer = 0.11;
        this.context.network.send({
            t: Math.round(this.context.network.serverNow()),
            x: 0,
            y: 0,
            z: 0,
            f: 0,
            s: 0,
            g: 1,
            v: 0,
            o: 0,
            c: this.score,
            e: this.me.reaction === null ? [] : [this.duelIndex, Math.round(this.me.reaction)],
        });
    }

    private sendTimer = 0;

    private receive(playerId: number, payload: number[] | undefined): void {
        if (!payload || payload.length < 2 || payload[0] !== this.duelIndex) {
            return;
        }

        const contestant = this.contestants.find((candidate) => candidate.id === playerId);

        if (contestant && contestant.reaction === null) {
            contestant.reaction = payload[1];
            if (payload[1] >= 0) {
                contestant.hop = 0.6;
            }
        }
    }

    private setBanner(text: string, mode: string): void {
        if (this.bannerText.textContent === text) {
            return;
        }

        this.bannerText.textContent = text;
        this.banner.dataset.mode = mode;
    }

    private setLamp(color: number): void {
        this.lamp.material = toonMaterial(color);
        this.lamp.scale.setScalar(1.25);
        window.setTimeout(() => this.lamp.scale.setScalar(1), 120);
    }

    private createSignalLamp(): THREE.Mesh {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.4, 12), toonMaterial(palette.ink));
        post.position.set(0, 1.7, -1.5);
        this.scene.add(post);

        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 16), this.lampMaterial);
        lamp.position.set(0, 4, -1.5);
        addOutline(lamp).scale.setScalar(1.05);
        this.scene.add(lamp);

        for (let index = 0; index < 8; index++) {
            const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), toonMaterial(partyColors[index % partyColors.length]));
            const angle = (index / 8) * Math.PI * 2;
            bulb.position.set(Math.cos(angle) * 1.2, Math.sin(angle) * 1.2, 0);
            lamp.add(bulb);
        }

        return lamp;
    }
}

export const createQuickDraw: MinigameFactory = (context) => new QuickDraw(context);
