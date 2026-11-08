import { el } from './dom';

const STICK_RADIUS = 56;

/**
 * On-screen joystick plus jump and action buttons. Only rendered on
 * devices with a coarse pointer; desktop players never see it.
 */
export class TouchControls {
    readonly stick = { x: 0, y: 0 };
    jumpHeld = false;
    actionHeld = false;

    private readonly root: HTMLDivElement;
    private readonly knob: HTMLDivElement;
    private readonly actionButton: HTMLButtonElement;
    private stickPointer: number | null = null;
    private stickOrigin = { x: 0, y: 0 };

    constructor(parent: HTMLElement) {
        this.knob = el('div', { className: 'touch-stick__knob' });
        const base = el('div', { className: 'touch-stick' }, [this.knob]);
        const jumpButton = el('button', { className: 'touch-button touch-button--jump', text: 'Jump' });
        this.actionButton = el('button', { className: 'touch-button touch-button--action', text: 'Dash' });

        this.root = el('div', { className: 'touch-controls' }, [
            el('div', { className: 'touch-controls__zone' }, [base]),
            el('div', { className: 'touch-controls__buttons' }, [this.actionButton, jumpButton]),
        ]);
        parent.append(this.root);

        base.addEventListener('pointerdown', this.onStickDown);
        window.addEventListener('pointermove', this.onStickMove);
        window.addEventListener('pointerup', this.onStickUp);
        window.addEventListener('pointercancel', this.onStickUp);

        this.bindButton(jumpButton, (held) => (this.jumpHeld = held));
        this.bindButton(this.actionButton, (held) => (this.actionHeld = held));
    }

    setVisible(visible: boolean, actionLabel: string): void {
        this.root.classList.toggle('is-visible', visible);
        this.actionButton.textContent = actionLabel;

        if (!visible) {
            this.reset();
        }
    }

    private reset(): void {
        this.stick.x = 0;
        this.stick.y = 0;
        this.jumpHeld = false;
        this.actionHeld = false;
        this.stickPointer = null;
        this.knob.style.transform = '';
    }

    private bindButton(button: HTMLButtonElement, setHeld: (held: boolean) => void): void {
        button.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            button.setPointerCapture(event.pointerId);
            setHeld(true);
            button.classList.add('is-pressed');
        });

        const release = (): void => {
            setHeld(false);
            button.classList.remove('is-pressed');
        };

        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
        button.addEventListener('lostpointercapture', release);
    }

    private readonly onStickDown = (event: PointerEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        this.stickPointer = event.pointerId;
        this.stickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        this.updateStick(event);
    };

    private readonly onStickMove = (event: PointerEvent): void => {
        if (event.pointerId === this.stickPointer) {
            this.updateStick(event);
        }
    };

    private readonly onStickUp = (event: PointerEvent): void => {
        if (event.pointerId === this.stickPointer) {
            this.stickPointer = null;
            this.stick.x = 0;
            this.stick.y = 0;
            this.knob.style.transform = '';
        }
    };

    private updateStick(event: PointerEvent): void {
        let dx = event.clientX - this.stickOrigin.x;
        let dy = event.clientY - this.stickOrigin.y;
        const distance = Math.hypot(dx, dy);

        if (distance > STICK_RADIUS) {
            dx = (dx / distance) * STICK_RADIUS;
            dy = (dy / distance) * STICK_RADIUS;
        }

        this.stick.x = dx / STICK_RADIUS;
        this.stick.y = -dy / STICK_RADIUS;
        this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    }
}
