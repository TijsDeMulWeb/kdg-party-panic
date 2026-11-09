import { el } from './dom';

export interface PartyMenuOptions {
    defaultName: string;
    onCreate(name: string): Promise<void>;
    onJoin(name: string, code: string): Promise<void>;
    onBack(): void;
}

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{5}$/;

/** Create Party and Join Party screens, combined in one panel. */
export class PartyMenu {
    private readonly root: HTMLElement;
    private readonly nameInput: HTMLInputElement;
    private readonly codeInput: HTMLInputElement;
    private readonly error: HTMLElement;
    private readonly buttons: HTMLButtonElement[];
    private busy = false;

    constructor(private readonly parent: HTMLElement, private readonly options: PartyMenuOptions) {
        this.nameInput = el('input', {
            className: 'pp-input',
            attrs: { type: 'text', maxlength: '16', value: options.defaultName, autocomplete: 'nickname', 'aria-label': 'Your name' },
        });
        this.codeInput = el('input', {
            className: 'pp-input pp-input--code',
            attrs: { type: 'text', maxlength: '5', placeholder: 'CODE', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Party code' },
        });
        this.codeInput.addEventListener('input', () => {
            this.codeInput.value = this.codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });
        this.codeInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                void this.join();
            }
        });

        const createButton = el('button', { className: 'pp-button pp-button--primary', text: 'Create party', onClick: () => void this.create() });
        const joinButton = el('button', { className: 'pp-button', text: 'Join', onClick: () => void this.join() });
        this.buttons = [createButton, joinButton];
        this.error = el('p', { className: 'party-menu__error', attrs: { role: 'alert' } });

        this.root = el('div', { className: 'arcade party-menu' }, [
            el('div', { className: 'arcade__header' }, [
                el('button', { className: 'pp-button pp-button--small', text: '‹ Back', onClick: () => options.onBack() }),
                el('h2', { className: 'arcade__title', text: 'Private Party' }),
            ]),
            el('p', { className: 'arcade__lead', text: 'Play with up to three friends. Everyone plays at the same time.' }),
            el('label', { className: 'party-menu__panel' }, [el('span', { className: 'party-menu__label', text: 'Your name' }), this.nameInput]),
            el('div', { className: 'party-menu__panel' }, [
                el('span', { className: 'party-menu__label', text: 'Host a new party' }),
                el('p', { className: 'party-menu__hint', text: 'You get a code to share with your friends.' }),
                createButton,
            ]),
            el('div', { className: 'party-menu__panel' }, [
                el('span', { className: 'party-menu__label', text: 'Join with a code' }),
                el('div', { className: 'party-menu__join' }, [this.codeInput, joinButton]),
            ]),
            this.error,
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

    private name(): string | null {
        const name = this.nameInput.value.trim();

        if (!name) {
            this.showError('Pick a name first.');
            this.nameInput.focus();
            return null;
        }

        return name;
    }

    private async create(): Promise<void> {
        const name = this.name();

        if (name) {
            await this.run(() => this.options.onCreate(name));
        }
    }

    private async join(): Promise<void> {
        const name = this.name();
        const code = this.codeInput.value.trim();

        if (!name) {
            return;
        }

        if (!CODE_PATTERN.test(code)) {
            this.showError('Party codes are 5 letters or numbers.');
            this.codeInput.focus();
            return;
        }

        await this.run(() => this.options.onJoin(name, code));
    }

    private async run(action: () => Promise<void>): Promise<void> {
        if (this.busy) {
            return;
        }

        this.busy = true;
        this.showError('');
        this.buttons.forEach((button) => (button.disabled = true));

        try {
            await action();
        } catch (error) {
            console.error('[party]', error);
            this.showError(error instanceof Error ? error.message : 'Something went wrong.');
        } finally {
            this.busy = false;
            this.buttons.forEach((button) => (button.disabled = false));
        }
    }

    private showError(message: string): void {
        this.error.textContent = message;
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.code === 'Escape') {
            this.options.onBack();
        }
    };
}
