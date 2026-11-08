import { el } from './dom';
import { seasonTheme, type Season } from '../design/season';

const LETTER_COLORS: Record<Season, string[]> = {
    default: ['var(--pp-coral)', 'var(--pp-sun)', 'var(--pp-mint)', 'var(--pp-sky)', 'var(--pp-grape)', 'var(--pp-bubblegum)'],
    christmas: ['#e23b3b', '#2f9e5b', '#e23b3b', '#ffc93c', '#2f9e5b'],
    halloween: ['#ff8a1f', '#9b6cff', '#9be35a', '#ff8a1f', '#9b6cff'],
    easter: ['#ffb3d9', '#8fd3ff', '#ffe36e', '#9be8a0', '#d6b8ff'],
};

/** Chunky bouncing word-mark. Each letter gets its own colour and wobble. */
export function createLogo(): HTMLElement {
    let colorIndex = 0;
    const colors = LETTER_COLORS[seasonTheme().season];

    const word = (text: string): HTMLElement =>
        el(
            'span',
            { className: 'logo__word' },
            [...text].map((letter, index) => {
                const span = el('span', { className: 'logo__letter', text: letter });
                span.style.setProperty('--letter-color', colors[colorIndex++ % colors.length]);
                span.style.setProperty('--letter-delay', `${index * 90}ms`);
                span.style.setProperty('--letter-tilt', `${(index % 2 === 0 ? -1 : 1) * (3 + (index % 3))}deg`);
                return span;
            }),
        );

    return el('h1', { className: 'logo', attrs: { 'aria-label': 'Party Panic' } }, [word('Party'), word('Panic')]);
}
