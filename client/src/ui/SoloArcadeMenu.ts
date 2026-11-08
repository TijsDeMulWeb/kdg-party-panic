import type { MinigameDefinition } from '../minigames/types';
import { getPersonalBest } from '../scoring/personalBest';
import { el } from './dom';

export interface SoloArcadeMenuOptions {
    minigames: readonly MinigameDefinition[];
    upcoming: readonly { name: string; tagline: string }[];
    onPlay(minigame: MinigameDefinition): void;
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

        this.root = el('div', { className: 'arcade' }, [
            el('div', { className: 'arcade__header' }, [
                el('button', { className: 'pp-button pp-button--small', text: '‹ Back', onClick: () => options.onBack() }),
                el('h2', { className: 'arcade__title', text: 'Solo Arcade' }),
            ]),
            el('p', { className: 'arcade__lead', text: 'Pick a minigame and beat your personal best.' }),
            el('div', { className: 'arcade__grid' }, [...playable, ...locked]),
        ]);
    }

    mount(): void {
        this.parent.append(this.root);
        window.addEventListener('keydown', this.onKeyDown);
        this.root.querySelector<HTMLButtonElement>('.arcade-card:not(.is-locked)')?.focus({ preventScroll: true });
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
