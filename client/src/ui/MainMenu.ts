import type { CharacterDefinition } from '../characters/roster';
import { el } from './dom';
import { createLogo } from './Logo';

export interface MainMenuCallbacks {
    roster: readonly CharacterDefinition[];
    selectedIndex: number;
    onSelect(index: number): void;
    onSoloArcade(): void;
    onFreePlay(): void;
}

interface MenuEntry {
    label: string;
    hint: string;
    action?: () => void;
}

/** DOM overlay for the title screen. */
export class MainMenu {
    private readonly root: HTMLElement;
    private readonly nameLabel: HTMLElement;
    private readonly taglineLabel: HTMLElement;
    private readonly swatch: HTMLElement;
    private index: number;

    constructor(private readonly parent: HTMLElement, private readonly options: MainMenuCallbacks) {
        this.index = options.selectedIndex;

        const entries: MenuEntry[] = [
            { label: 'Solo Arcade', hint: 'Play minigames and beat your best', action: options.onSoloArcade },
            { label: 'Free Play', hint: 'Warm up on the practice island', action: options.onFreePlay },
            { label: 'Private Party', hint: 'Coming in a later phase' },
            { label: 'Daily Challenge', hint: 'Coming in a later phase' },
            { label: 'Leaderboard', hint: 'Coming in a later phase' },
        ];

        const buttons = entries.map((entry, position) =>
            el(
                'button',
                {
                    className: `pp-button ${position === 0 ? 'pp-button--primary' : ''} ${entry.action ? '' : 'is-locked'}`,
                    attrs: entry.action ? {} : { disabled: '', title: entry.hint },
                    onClick: () => entry.action?.(),
                },
                [el('span', { className: 'pp-button__label', text: entry.label }), entry.action ? null : el('span', { className: 'pp-tag', text: 'Soon' })],
            ),
        );

        this.nameLabel = el('span', { className: 'picker__name' });
        this.taglineLabel = el('span', { className: 'picker__tagline' });
        this.swatch = el('span', { className: 'picker__swatch' });

        const picker = el('div', { className: 'picker' }, [
            el('button', { className: 'picker__arrow', text: '‹', attrs: { 'aria-label': 'Previous character' }, onClick: () => this.cycle(-1) }),
            el('div', { className: 'picker__info' }, [this.swatch, el('div', {}, [this.nameLabel, this.taglineLabel])]),
            el('button', { className: 'picker__arrow', text: '›', attrs: { 'aria-label': 'Next character' }, onClick: () => this.cycle(1) }),
        ]);

        this.root = el('div', { className: 'menu' }, [
            el('header', { className: 'menu__brand' }, [createLogo(), el('p', { className: 'menu__tagline', text: 'Five minigames. Four friends. Zero chill.' })]),
            el('nav', { className: 'menu__actions' }, buttons),
            el('div', { className: 'menu__picker' }, [el('span', { className: 'menu__picker-title', text: 'Your character' }), picker]),
            el('footer', { className: 'menu__footer', text: 'Enter for Solo Arcade · ← → to pick a character' }),
        ]);

        this.render();
    }

    mount(): void {
        this.parent.append(this.root);
        window.addEventListener('keydown', this.onKeyDown);
    }

    unmount(): void {
        window.removeEventListener('keydown', this.onKeyDown);
        this.root.remove();
    }

    private cycle(direction: number): void {
        const count = this.options.roster.length;
        this.index = (this.index + direction + count) % count;
        this.render();
        this.options.onSelect(this.index);
    }

    private render(): void {
        const character = this.options.roster[this.index];
        this.nameLabel.textContent = character.name;
        this.taglineLabel.textContent = character.tagline;
        this.swatch.style.background = `#${character.body.toString(16).padStart(6, '0')}`;
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.repeat) {
            return;
        }

        if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
            this.cycle(-1);
        }

        if (event.code === 'ArrowRight' || event.code === 'KeyD') {
            this.cycle(1);
        }

        if (event.code === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
            this.options.onSoloArcade();
        }
    };
}
