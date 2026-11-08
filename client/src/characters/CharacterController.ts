import * as THREE from 'three';
import type { CharacterModel } from './CharacterModel';
import type { InputSnapshot } from '../core/InputManager';
import { audio } from '../audio/AudioManager';
import {
    createMovementState,
    DEFAULT_MOVEMENT,
    stepMovement,
    type MovementConfig,
    type MovementEvents,
    type MovementState,
    type MovementWorld,
} from './movement';

/**
 * Glue between player input, the pure movement simulation and the visual
 * model. Converts screen-relative input into world space using the camera yaw.
 */
export class CharacterController {
    readonly state: MovementState;
    readonly config: MovementConfig;

    constructor(
        readonly model: CharacterModel,
        private readonly world: MovementWorld,
        spawn: THREE.Vector3,
        config: Partial<MovementConfig> = {},
    ) {
        this.config = { ...DEFAULT_MOVEMENT, ...config };
        this.state = createMovementState(spawn);
        this.syncModel();
    }

    get position(): THREE.Vector3 {
        return this.model.root.position;
    }

    update(dt: number, input: InputSnapshot, cameraYaw: number): MovementEvents {
        // Camera looks along -z when yaw is 0, so "forward" on screen is -z rotated by yaw.
        const sin = Math.sin(cameraYaw);
        const cos = Math.cos(cameraYaw);
        const moveX = input.moveX * cos - input.moveY * sin;
        const moveZ = -input.moveX * sin - input.moveY * cos;

        const events = stepMovement(
            this.state,
            { moveX, moveZ, jumpPressed: input.jumpPressed, jumpHeld: input.jumpHeld, dashPressed: input.actionPressed },
            this.config,
            this.world,
            dt,
        );

        if (events.jumped) {
            this.model.jump();
            audio.play('jump');
        }

        if (events.landed) {
            this.model.land(events.landingSpeed);
            audio.play('land', events.landingSpeed / 12);
        }

        if (events.dashed) {
            audio.play('dash');
        }

        this.syncModel();
        const { velocity } = this.state;
        this.model.update(dt, {
            speed: Math.hypot(velocity.x, velocity.z) / this.config.maxSpeed,
            grounded: this.state.grounded,
            verticalVelocity: velocity.y,
        });

        return events;
    }

    teleport(position: THREE.Vector3, facing = 0): void {
        const fresh = createMovementState(position, facing);
        Object.assign(this.state, fresh);
        this.syncModel();
    }

    private syncModel(): void {
        const { position, facing } = this.state;
        this.model.root.position.set(position.x, position.y, position.z);
        this.model.root.rotation.y = facing;
    }
}
