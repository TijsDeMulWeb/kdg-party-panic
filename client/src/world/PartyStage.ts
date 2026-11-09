import * as THREE from 'three';
import { partyColors } from '../design/palette';
import { randomRange } from '../utils/math';
import { createBalloon, createFlower, createIsland, type Balloon } from './props';
import { createSeasonalDecor, type Decor } from './seasonalDecor';

/** Floating island with flowers and balloons, used by the title screen and the lobby. */
export class PartyStage {
    readonly group = new THREE.Group();
    private readonly balloons: Balloon[] = [];
    private readonly decor: Decor | null;

    constructor(radius = 6.2) {
        this.group.add(createIsland(radius, 1));

        for (let index = 0; index < 26; index++) {
            const flower = createFlower();
            const angle = Math.random() * Math.PI * 2;
            const distance = randomRange(radius - 2, radius - 0.4);
            flower.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
            this.group.add(flower);
        }

        const spots = [
            [-5.5, 4.2, -2.5],
            [-4.2, 5.4, -3.6],
            [5.2, 4.6, -2.8],
            [4, 6, -4],
            [0.5, 6.8, -5],
        ];

        this.decor = createSeasonalDecor(radius);
        if (this.decor) {
            this.group.add(this.decor.group);
        }

        spots.forEach(([x, y, z], index) => {
            const balloon = createBalloon(partyColors[index % partyColors.length], new THREE.Vector3(x, y, z));
            this.balloons.push(balloon);
            this.group.add(balloon.group);
        });
    }

    update(dt: number, time: number): void {
        for (const balloon of this.balloons) {
            balloon.update(dt, time);
        }

        this.decor?.update(dt, time);
    }
}
