import type { MinigameDefinition } from '../../minigames/types';
import { el } from '../dom';

/** "How to play" card shown before the countdown. */
export class IntroCard {
    readonly root: HTMLElement;
    private readonly status = el('span', { className: 'intro-card__status' });

    /** Without `onStart` the card has no button: the start is scheduled by the server. */
    constructor(definition: MinigameDefinition, best: number | null, private readonly onStart?: () => void) {
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
                onStart
                    ? el('div', { className: 'card__footer' }, [
                          el('span', { className: 'card__meta', text: best === null ? 'No record yet' : `Your best: ${best}` }),
                          el('button', { className: 'pp-button pp-button--primary', text: 'Start', onClick: () => this.start() }),
                      ])
                    : el('div', { className: 'card__footer card__footer--center' }, [this.status]),
            ]),
        ]);
        this.root.style.setProperty('--card-accent', definition.accent);
    }

    setStatus(text: string): void {
        this.status.textContent = text;
    }

    mount(parent: HTMLElement): void {
        parent.append(this.root);

        if (!this.onStart) {
            return;
        }

        window.addEventListener('keydown', this.onKeyDown);
        this.root.querySelector<HTMLButtonElement>('.pp-button--primary')?.focus({ preventScroll: true });
    }

    unmount(): void {
        window.removeEventListener('keydown', this.onKeyDown);
        this.root.remove();
    }

    private start(): void {
        this.unmount();
        this.onStart?.();
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.code === 'Space' || event.code === 'Enter') {
            event.preventDefault();
            this.start();
        }
    };
}
