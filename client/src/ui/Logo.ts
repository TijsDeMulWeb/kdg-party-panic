import { el } from './dom';

const LETTER_COLORS = ['--pp-coral', '--pp-sun', '--pp-mint', '--pp-sky', '--pp-grape', '--pp-bubblegum'];

/** Chunky bouncing word-mark. Each letter gets its own colour and wobble. */
export function createLogo(): HTMLElement {
    let colorIndex = 0;

    const word = (text: string): HTMLElement =>
        el(
            'span',
            { className: 'logo__word' },
            [...text].map((letter, index) => {
                const span = el('span', { className: 'logo__letter', text: letter });
                span.style.setProperty('--letter-color', `var(${LETTER_COLORS[colorIndex++ % LETTER_COLORS.length]})`);
                span.style.setProperty('--letter-delay', `${index * 90}ms`);
                span.style.setProperty('--letter-tilt', `${(index % 2 === 0 ? -1 : 1) * (3 + (index % 3))}deg`);
                return span;
            }),
        );

    return el('h1', { className: 'logo', attrs: { 'aria-label': 'Party Panic' } }, [word('Party'), word('Panic')]);
}
