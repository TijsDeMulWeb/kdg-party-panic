import type { MinigameResult } from '../../minigames/types';
import { el } from '../dom';

export interface ResultsCardOptions {
    result: MinigameResult;
    best: number | null;
    isRecord: boolean;
    accent: string;
    onReplay(): void;
    onExit(): void;
}

/** End-of-minigame card for Solo Arcade: score, stats and personal best. */
export class ResultsCard {
    readonly root: HTMLElement;
    /** Ignore keys briefly so a jump pressed at the buzzer doesn't skip the results. */
    private armedAt = performance.now() + 800;

    constructor(private readonly options: ResultsCardOptions) {
        const { result, best, isRecord } = options;

        this.root = el('div', { className: 'overlay' }, [
            el('div', { className: 'card results-card' }, [
                el('span', { className: 'card__eyebrow', text: 'Solo Arcade' }),
                el('h2', { className: 'card__title', text: result.title }),
                isRecord ? el('span', { className: 'results-card__record', text: 'New personal best!' }) : null,
                el('div', { className: 'results-card__score' }, [el('span', { className: 'results-card__score-label', text: 'Score' }), el('span', { className: 'results-card__score-value', text: String(result.score) })]),
                el(
                    'dl',
                    { className: 'results-card__stats' },
                    [...result.stats, { label: 'Personal best', value: best === null ? 'None' : String(best) }].flatMap((stat) => [el('dt', { text: stat.label }), el('dd', { text: stat.value })]),
                ),
                el('div', { className: 'card__footer' }, [
                    el('button', { className: 'pp-button', text: 'Arcade', onClick: () => options.onExit() }),
                    el('button', { className: 'pp-button pp-button--primary', text: 'Play again', onClick: () => options.onReplay() }),
                ]),
            ]),
        ]);
        this.root.style.setProperty('--card-accent', options.accent);
    }

    mount(parent: HTMLElement): void {
        parent.append(this.root);
        window.addEventListener('keydown', this.onKeyDown);
    }

    unmount(): void {
        window.removeEventListener('keydown', this.onKeyDown);
        this.root.remove();
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.repeat || performance.now() < this.armedAt) {
            return;
        }

        if (event.code === 'Enter' || event.code === 'Space') {
            event.preventDefault();
            this.options.onReplay();
        }

        if (event.code === 'Escape') {
            this.options.onExit();
        }
    };
}
