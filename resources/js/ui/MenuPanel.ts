import { el } from './dom';

/**
 * Shared shell for the side panels of the title screen (arcade, party,
 * daily, leaderboard, profile): header with back button, Escape to go back.
 */
export class MenuPanel {
    readonly root: HTMLElement;
    readonly content: HTMLElement;

    constructor(
        private readonly parent: HTMLElement,
        title: string,
        lead: string,
        private readonly onBack: () => void,
        className = '',
    ) {
        this.content = el('div', { className: 'menu-panel__content' });
        this.root = el('div', { className: `arcade ${className}` }, [
            el('div', { className: 'arcade__header' }, [
                el('button', { className: 'pp-button pp-button--small', text: '‹ Back', onClick: () => onBack() }),
                el('h2', { className: 'arcade__title', text: title }),
            ]),
            el('p', { className: 'arcade__lead', text: lead }),
            this.content,
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
        if (event.code === 'Escape' && !(event.target instanceof HTMLInputElement)) {
            this.onBack();
        }
    };
}
