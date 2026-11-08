import { CharacterModel } from './CharacterModel';
import { createNameTag } from './NameTag';
import type { CharacterDefinition } from './roster';
import { randomRange } from '../utils/math';

const GRAVITY = 30;

/**
 * A character that just stands around and hops: used on menu-like stages
 * (standings, podium) where nobody is controlling it.
 */
export class Performer {
    readonly model: CharacterModel;
    private y = 0;
    private vy = 0;
    private hopTimer = randomRange(0.5, 2.5);
    /** 0 = calm, 1 = celebrating. */
    excitement = 0.2;

    constructor(definition: CharacterDefinition, hat: string | null, name?: string, isLocal = false) {
        this.model = new CharacterModel(definition, hat);

        if (name) {
            this.model.root.add(createNameTag(name, definition.body, isLocal));
        }
    }

    hop(strength = 8): void {
        if (this.y === 0) {
            this.vy = strength;
            this.model.jump();
        }
    }

    update(dt: number, groundY = 0): void {
        this.hopTimer -= dt;

        if (this.y === 0 && this.hopTimer <= 0) {
            this.hop(3 + this.excitement * 6);
            this.hopTimer = randomRange(0.6, 1.2) + (1 - this.excitement) * randomRange(1.5, 3.5);
        }

        if (this.vy !== 0 || this.y > 0) {
            this.vy -= GRAVITY * dt;
            this.y = Math.max(0, this.y + this.vy * dt);

            if (this.y === 0) {
                this.model.land(Math.abs(this.vy));
                this.vy = 0;
            }
        }

        this.model.root.position.y = groundY + this.y;
        this.model.update(dt, { speed: 0, grounded: this.y === 0, verticalVelocity: this.vy });
    }
}
