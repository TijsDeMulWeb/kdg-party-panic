import type { MinigameDefinition } from '../../minigames/types';
import { el } from '../dom';

/** "How to play" card shown before the countdown. */
export class IntroCard {
    readonly root: HTMLElement;

    constructor(definition: MinigameDefinition, best: number | null, private readonly onStart: () => void) {
        const isTouch = window.matchMedia('(pointer: coarse)').matches;
        const controls = isTouch ? `Joystick to move · Jump · ${definition.actionLabel}` : `WASD / Arrows move · Space jump · Shift ${definition.actionLabel.toLowerCase()}`;

        this.root = el('div', { className: 'overlay' }, [
            el('div', { className: 'card intro-card' }, [
                el('span', { className: 'card__eyebrow', text: `${definition.durationSeconds} second minigame` }),
                el('h2', { className: 'card__title', text: definition.name }),
                el('p', { className: 'card__lead', text: definition.tagline }),
                el(
                    'ol',
                    { className: 'intro-card__steps' },
                    definition.instructions.map((step) => el('li', { text: step })),
                ),
                el('p', { className: 'intro-card__controls', text: controls }),
                el('div', { className: 'card__footer' }, [
                    el('span', { className: 'card__meta', text: best === null ? 'No record yet' : `Your best: ${best}` }),
                    el('button', { className: 'pp-button pp-button--primary', text: 'Start', onClick: () => this.start() }),
                ]),
            ]),
        ]);
        this.root.style.setProperty('--card-accent', definition.accent);
    }

    mount(parent: HTMLElement): void {
        parent.append(this.root);
        window.addEventListener('keydown', this.onKeyDown);
        this.root.querySelector<HTMLButtonElement>('.pp-button--primary')?.focus({ preventScroll: true });
    }

    unmount(): void {
        window.removeEventListener('keydown', this.onKeyDown);
        this.root.remove();
    }

    private start(): void {
        this.unmount();
        this.onStart();
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.code === 'Space' || event.code === 'Enter') {
            event.preventDefault();
            this.start();
        }
    };
}
