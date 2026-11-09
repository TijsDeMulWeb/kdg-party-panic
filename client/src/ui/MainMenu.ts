import { el } from './dom';
import { createLogo } from './Logo';
import { seasonTheme } from '../design/season';

export interface MainMenuCallbacks {
    onSoloArcade(): void;
    onPrivateParty(): void;
    onDailyChallenge(): void;
    onLeaderboard(): void;
    onFreePlay(): void;
}

/** DOM overlay for the title screen: logo and the main modes. */
export class MainMenu {
    private readonly root: HTMLElement;

    constructor(private readonly parent: HTMLElement, private readonly options: MainMenuCallbacks) {
        const entries = [
            { label: 'Solo Arcade', action: options.onSoloArcade },
            { label: 'Private Party', action: options.onPrivateParty },
            { label: 'Daily Challenge', action: options.onDailyChallenge },
            { label: 'Leaderboard', action: options.onLeaderboard },
            { label: 'Free Play', action: options.onFreePlay },
        ];

        const buttons = entries.map((entry, position) =>
            el('button', { className: `pp-button ${position === 0 ? 'pp-button--primary' : ''}`, onClick: () => entry.action() }, [el('span', { className: 'pp-button__label', text: entry.label })]),
        );

        this.root = el('div', { className: 'menu' }, [
            el('header', { className: 'menu__brand' }, [createLogo(), el('p', { className: 'menu__tagline', text: seasonTheme().tagline })]),
            el('nav', { className: 'menu__actions' }, buttons),
            el('footer', { className: 'menu__footer', text: 'Enter for Solo Arcade' }),
        ]);
    }

    mount(): void {
        this.parent.append(this.root);
        window.addEventListener('keydown', this.onKeyDown);
    }

    unmount(): void {
        window.removeEventListener('keydown', this.onKeyDown);
        this.root.remove();
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.code === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
            this.options.onSoloArcade();
        }
    };
}
