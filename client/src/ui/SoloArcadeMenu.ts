import type { MinigameDefinition } from '../minigames/types';
import { getPersonalBest } from '../scoring/personalBest';
import { el } from './dom';

export interface SoloArcadeMenuOptions {
    minigames: readonly MinigameDefinition[];
    upcoming: readonly { name: string; tagline: string }[];
    onPlay(minigame: MinigameDefinition): void;
    onRandom(): void;
    onBack(): void;
}

/** Minigame picker for Solo Arcade, shown over the title scene. */
export class SoloArcadeMenu {
    private readonly root: HTMLElement;

    constructor(private readonly parent: HTMLElement, private readonly options: SoloArcadeMenuOptions) {
        const playable = options.minigames.map((minigame) => {
            const best = getPersonalBest(minigame.id);
            const card = el(
                'button',
                { className: 'arcade-card', onClick: () => options.onPlay(minigame) },
                [
                    el('span', { className: 'arcade-card__name', text: minigame.name }),
                    el('span', { className: 'arcade-card__tagline', text: minigame.tagline }),
                    el('span', { className: 'arcade-card__meta' }, [
                        el('span', { text: `${minigame.durationSeconds}s` }),
                        el('span', { text: best === null ? 'No record yet' : `Best ${best}` }),
                    ]),
                ],
            );
            card.style.setProperty('--card-accent', minigame.accent);
            return card;
        });

        const locked = options.upcoming.map((minigame) =>
            el('button', { className: 'arcade-card is-locked', attrs: { disabled: '' } }, [
                el('span', { className: 'arcade-card__name', text: minigame.name }),
                el('span', { className: 'arcade-card__tagline', text: minigame.tagline }),
                el('span', { className: 'arcade-card__meta' }, [el('span', { className: 'pp-tag', text: 'Soon' })]),
            ]),
        );

        const dice = el('span', { className: 'arcade-card__dice', attrs: { 'aria-hidden': 'true' } });
        dice.innerHTML =
            '<svg viewBox="0 0 40 40" width="46" height="46"><rect x="2" y="2" width="36" height="36" rx="9" fill="#fff" stroke="#2b2340" stroke-width="3"/><circle cx="12" cy="12" r="3.6" fill="#2b2340"/><circle cx="20" cy="20" r="3.6" fill="#2b2340"/><circle cx="28" cy="28" r="3.6" fill="#2b2340"/></svg>';

        const random = el('button', { className: 'arcade-card arcade-card--random', onClick: () => options.onRandom() }, [
            el('span', { className: 'arcade-card__name', text: 'Surprise me!' }),
            el('span', { className: 'arcade-card__tagline', text: `A random pick from all ${options.minigames.length} minigames.` }),
            dice,
        ]);

        this.root = el('div', { className: 'arcade' }, [
            el('div', { className: 'arcade__header' }, [
                el('button', { className: 'pp-button pp-button--small', text: '‹ Back', onClick: () => options.onBack() }),
                el('h2', { className: 'arcade__title', text: 'Solo Arcade' }),
            ]),
            el('p', { className: 'arcade__lead', text: 'Pick a minigame and beat your personal best.' }),
            el('div', { className: 'arcade__grid' }, [random, ...playable, ...locked]),
        ]);
    }

    mount(): void {
        this.parent.append(this.root);
        window.addEventListener('keydown', this.onKeyDown);
        this.root.querySelector<HTMLButtonElement>('.arcade-card--random')?.focus({ preventScroll: true });
    }

    unmount(): void {
        window.removeEventListener('keydown', this.onKeyDown);
        this.root.remove();
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.code === 'Escape') {
            this.options.onBack();
        }
    };
}
