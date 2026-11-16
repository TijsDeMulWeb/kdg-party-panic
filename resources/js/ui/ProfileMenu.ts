import { MINIGAMES } from '../minigames/registry';
import { fetchCurrentPlayer } from '../multiplayer/partyApi';
import type { Player } from '../multiplayer/types';
import { fetchMatchHistory, login, logout, register, syncProfile } from '../online/onlineApi';
import { adoptLauncherName, type LocalProfile } from '../online/profile';
import { getPersonalBest } from '../scoring/personalBest';
import { el } from './dom';
import { MenuPanel } from './MenuPanel';

export interface ProfileMenuOptions {
    profile: LocalProfile;
    onChange(profile: LocalProfile): void;
    onBack(): void;
}

const ORDINALS = ['1st', '2nd', '3rd', '4th'];

/** Player profile: name, character, hat, account and history. */
export class ProfileMenu {
    private readonly panel: MenuPanel;
    private readonly nameInput: HTMLInputElement;
    private readonly nameField: HTMLElement;
    private nameIsLocked = false;
    private readonly account = el('div', { className: 'party-menu__panel' });
    private readonly history = el('div', { className: 'party-menu__panel' });
    private readonly bests = el('div', { className: 'party-menu__panel' });

    constructor(parent: HTMLElement, private readonly options: ProfileMenuOptions) {
        this.panel = new MenuPanel(parent, 'Profile', 'Your name, account and history.', () => this.close(), 'profile-menu');
        this.nameInput = el('input', { className: 'pp-input', attrs: { type: 'text', maxlength: '16', 'aria-label': 'Your name', autocomplete: 'nickname' } });
        this.nameInput.addEventListener('change', () => this.updateName());


        this.nameField = el('label', { className: 'party-menu__panel' }, [el('span', { className: 'party-menu__label', text: 'Name' }), this.nameInput]);

        this.panel.content.append(
            this.nameField,
            this.account,
            this.history,
            this.bests,
        );
    }

    mount(): void {
        this.panel.mount();
        this.renderLook();
        this.renderBests();
        void this.renderAccount();
    }

    unmount(): void {
        this.panel.unmount();
    }

    private close(): void {
        this.updateName();
        this.options.onBack();
    }

    private updateName(): void {
        if (!this.nameIsLocked) {
            this.update({ name: this.nameInput.value.trim() });
        }
    }

    private update(changes: Partial<LocalProfile>): void {
        Object.assign(this.options.profile, changes);
        this.options.onChange(this.options.profile);
        this.renderLook();
        void syncProfile(this.options.profile).catch(() => undefined);
    }


    private renderLook(): void {
        const { profile } = this.options;
        if (document.activeElement !== this.nameInput) {
            this.nameInput.value = profile.name;
        }
    }

    private renderBests(): void {
        this.bests.replaceChildren(
            el('span', { className: 'party-menu__label', text: 'Personal bests (this device)' }),
            el(
                'dl',
                { className: 'results-card__stats' },
                MINIGAMES.flatMap((minigame) => [el('dt', { text: minigame.name }), el('dd', { text: String(getPersonalBest(minigame.id) ?? 'None') })]),
            ),
        );
    }

    private async renderAccount(): Promise<void> {
        let player: Player | null = null;

        try {
            player = await fetchCurrentPlayer();
        } catch {
            this.account.replaceChildren(el('span', { className: 'party-menu__label', text: 'Account' }), el('p', { className: 'party-menu__hint', text: 'The game server is offline. Your profile is saved on this device.' }));
            this.history.replaceChildren();
            return;
        }

        this.nameIsLocked = player?.is_launcher ?? false;
        this.nameField.style.display = this.nameIsLocked ? 'none' : '';

        if (player && adoptLauncherName(this.options.profile, player)) {
            this.options.onChange(this.options.profile);
        }

        if (player && !player.is_guest) {
            this.account.replaceChildren(
                el('span', { className: 'party-menu__label', text: 'Account' }),
                el('p', { className: 'party-menu__hint', text: `Logged in as ${player.email ?? player.name}` }),
                el('button', { className: 'pp-button', text: 'Log out', onClick: () => void logout().then(() => this.renderAccount()) }),
            );
        } else {
            this.renderAccountForms();
        }

        void this.renderHistory(player);
    }

    private renderAccountForms(): void {
        const email = el('input', { className: 'pp-input', attrs: { type: 'email', placeholder: 'Email', autocomplete: 'email', 'aria-label': 'Email' } });
        const password = el('input', { className: 'pp-input', attrs: { type: 'password', placeholder: 'Password (8+ characters)', autocomplete: 'current-password', 'aria-label': 'Password' } });
        const error = el('p', { className: 'party-menu__hint profile-menu__error', attrs: { role: 'alert' } });

        const run = (action: () => Promise<Player>): void => {
            error.textContent = '';
            action().then(
                (player) => {
                    this.update({ name: player.name });
                    void this.renderAccount();
                },
                (reason: Error) => (error.textContent = reason.message),
            );
        };

        this.account.replaceChildren(
            el('span', { className: 'party-menu__label', text: 'Account' }),
            el('p', { className: 'party-menu__hint', text: 'Create an account to keep your scores and history on every device. Your guest progress comes with you.' }),
            email,
            password,
            el('div', { className: 'party-menu__join' }, [
                el('button', { className: 'pp-button pp-button--primary', text: 'Create account', onClick: () => run(() => register(this.options.profile.name || 'Player', email.value, password.value)) }),
                el('button', { className: 'pp-button', text: 'Log in', onClick: () => run(() => login(email.value, password.value)) }),
            ]),
            el('a', { className: 'pp-button', text: 'Log in with Game Launcher', attrs: { href: '/auth/redirect' } }),
            error,
        );
    }

    private async renderHistory(player: Player | null): Promise<void> {
        const title = el('span', { className: 'party-menu__label', text: 'Recent party matches' });

        if (!player) {
            this.history.replaceChildren(title, el('p', { className: 'party-menu__hint', text: 'Play a Private Party to start your history.' }));
            return;
        }

        const matches = await fetchMatchHistory().catch(() => []);

        this.history.replaceChildren(
            title,
            matches.length === 0
                ? el('p', { className: 'party-menu__hint', text: 'No finished matches yet.' })
                : el(
                      'ol',
                      { className: 'history-list' },
                      matches.map((match) =>
                          el('li', {}, [
                              el('strong', { text: match.rank ? ORDINALS[match.rank - 1] ?? `${match.rank}th` : '-' }),
                              el('span', { text: `${match.points} pts · ${match.players} players` }),
                              el('span', { className: 'history-list__date', text: match.played_at ? new Date(match.played_at).toLocaleDateString() : '' }),
                          ]),
                      ),
                  ),
        );
    }
}
