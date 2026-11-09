import { el } from './dom';

export interface PlaygroundHudOptions {
    characterName: string;
    onExit(): void;
}

/** Minimal HUD for the free-play island: back button and control hints. */
export class PlaygroundHud {
    private readonly root: HTMLElement;
    private readonly toast: HTMLElement;
    private toastTimer = 0;

    constructor(private readonly parent: HTMLElement, options: PlaygroundHudOptions) {
        const isTouch = window.matchMedia('(pointer: coarse)').matches;
        const hint = isTouch ? 'Stick to move · Jump · Dash · Drag to look around' : 'WASD / Arrows move · Space jump · Shift dash · Drag to rotate · Esc menu';

        this.toast = el('div', { className: 'hud__toast' });

        this.root = el('div', { className: 'hud' }, [
            el('div', { className: 'hud__top' }, [
                el('button', { className: 'pp-button pp-button--small', text: '‹ Menu', onClick: options.onExit }),
                el('div', { className: 'hud__badge' }, [el('span', { className: 'hud__badge-label', text: 'Free Play' }), el('span', { text: options.characterName })]),
            ]),
            this.toast,
            el('div', { className: 'hud__hint', text: hint }),
        ]);
    }

    mount(): void {
        this.parent.append(this.root);
    }

    unmount(): void {
        window.clearTimeout(this.toastTimer);
        this.root.remove();
    }

    showToast(message: string): void {
        this.toast.textContent = message;
        this.toast.classList.remove('is-visible');
        // Restart the CSS animation.
        void this.toast.offsetWidth;
        this.toast.classList.add('is-visible');
        window.clearTimeout(this.toastTimer);
        this.toastTimer = window.setTimeout(() => this.toast.classList.remove('is-visible'), 1600);
    }
}
