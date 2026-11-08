import { TouchControls } from '../ui/TouchControls';

/**
 * Device-agnostic player intent for one frame. Every minigame reads this
 * instead of raw keyboard, gamepad or touch events.
 */
export interface InputSnapshot {
    /** Screen-relative movement. x: right, y: forward/up. Length <= 1. */
    moveX: number;
    moveY: number;
    jumpPressed: boolean;
    jumpHeld: boolean;
    actionPressed: boolean;
    actionHeld: boolean;
    /** Camera look delta in pixels since the previous frame. */
    lookX: number;
    lookY: number;
}

const KEY_BINDINGS = {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    jump: ['Space'],
    action: ['ShiftLeft', 'ShiftRight', 'KeyE', 'KeyJ'],
} as const;

type Binding = keyof typeof KEY_BINDINGS;

const GAMEPAD_DEADZONE = 0.18;

export class InputManager {
    private readonly keys = new Set<string>();
    private readonly touch: TouchControls;
    private lookX = 0;
    private lookY = 0;
    private dragPointer: number | null = null;
    private lastPointer = { x: 0, y: 0 };
    private previousJump = false;
    private previousAction = false;
    private enabled = true;

    readonly snapshot: InputSnapshot = {
        moveX: 0,
        moveY: 0,
        jumpPressed: false,
        jumpHeld: false,
        actionPressed: false,
        actionHeld: false,
        lookX: 0,
        lookY: 0,
    };

    constructor(private readonly surface: HTMLElement, uiRoot: HTMLElement) {
        this.touch = new TouchControls(uiRoot);

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.onBlur);
        surface.addEventListener('pointerdown', this.onPointerDown);
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('pointercancel', this.onPointerUp);
    }

    /** Shows or hides on-screen touch controls (only visible on touch devices). */
    setGameplayControls(visible: boolean, actionLabel = 'Dash'): void {
        this.touch.setVisible(visible, actionLabel);
    }

    /** Disabled input reports neutral values, e.g. during countdowns. */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /** Samples all devices. Call once at the start of every frame. */
    update(): void {
        let moveX = this.axis('left', 'right');
        let moveY = this.axis('down', 'up');
        let jump = this.isDown('jump');
        let action = this.isDown('action');

        const pad = this.readGamepad();
        if (pad) {
            moveX += pad.moveX;
            moveY += pad.moveY;
            jump ||= pad.jump;
            action ||= pad.action;
            this.lookX += pad.lookX;
        }

        moveX += this.touch.stick.x;
        moveY += this.touch.stick.y;
        jump ||= this.touch.jumpHeld;
        action ||= this.touch.actionHeld;

        const length = Math.hypot(moveX, moveY);
        if (length > 1) {
            moveX /= length;
            moveY /= length;
        }

        const snapshot = this.snapshot;

        if (!this.enabled) {
            moveX = 0;
            moveY = 0;
            jump = false;
            action = false;
        }

        snapshot.moveX = moveX;
        snapshot.moveY = moveY;
        snapshot.jumpPressed = jump && !this.previousJump;
        snapshot.jumpHeld = jump;
        snapshot.actionPressed = action && !this.previousAction;
        snapshot.actionHeld = action;
        snapshot.lookX = this.lookX;
        snapshot.lookY = this.lookY;

        this.previousJump = jump;
        this.previousAction = action;
        this.lookX = 0;
        this.lookY = 0;
    }

    private axis(negative: Binding, positive: Binding): number {
        return (this.isDown(positive) ? 1 : 0) - (this.isDown(negative) ? 1 : 0);
    }

    private isDown(binding: Binding): boolean {
        return KEY_BINDINGS[binding].some((code) => this.keys.has(code));
    }

    private readGamepad(): { moveX: number; moveY: number; lookX: number; jump: boolean; action: boolean } | null {
        const pads = navigator.getGamepads?.() ?? [];
        const pad = pads.find((candidate) => candidate?.connected);

        if (!pad) {
            return null;
        }

        const deadzone = (value: number): number => (Math.abs(value) < GAMEPAD_DEADZONE ? 0 : value);

        return {
            moveX: deadzone(pad.axes[0] ?? 0),
            moveY: -deadzone(pad.axes[1] ?? 0),
            lookX: deadzone(pad.axes[2] ?? 0) * 12,
            jump: pad.buttons[0]?.pressed ?? false,
            action: (pad.buttons[2]?.pressed ?? false) || (pad.buttons[1]?.pressed ?? false),
        };
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.target instanceof HTMLInputElement) {
            return;
        }

        this.keys.add(event.code);

        if (event.code === 'Space' || event.code.startsWith('Arrow')) {
            event.preventDefault();
        }
    };

    private readonly onKeyUp = (event: KeyboardEvent): void => {
        this.keys.delete(event.code);
    };

    private readonly onBlur = (): void => {
        this.keys.clear();
        this.dragPointer = null;
    };

    private readonly onPointerDown = (event: PointerEvent): void => {
        if (this.dragPointer !== null) {
            return;
        }

        this.dragPointer = event.pointerId;
        this.lastPointer = { x: event.clientX, y: event.clientY };
        this.surface.classList.add('is-dragging');
    };

    private readonly onPointerMove = (event: PointerEvent): void => {
        if (event.pointerId !== this.dragPointer) {
            return;
        }

        this.lookX += event.clientX - this.lastPointer.x;
        this.lookY += event.clientY - this.lastPointer.y;
        this.lastPointer = { x: event.clientX, y: event.clientY };
    };

    private readonly onPointerUp = (event: PointerEvent): void => {
        if (event.pointerId === this.dragPointer) {
            this.dragPointer = null;
            this.surface.classList.remove('is-dragging');
        }
    };
}
