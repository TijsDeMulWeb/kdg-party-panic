import { MINIGAMES } from '../minigames/registry';
import type { MinigameDefinition } from '../minigames/types';
import { fetchDailyChallenge, type DailyChallengeInfo } from '../online/onlineApi';
import { el } from './dom';
import { MenuPanel } from './MenuPanel';

export interface DailyMenuOptions {
    onPlay(minigame: MinigameDefinition): Promise<void>;
    onLeaderboard(): void;
    onBack(): void;
}

/** Today's shared challenge: same minigame and layout for everyone. */
export class DailyMenu {
    private readonly panel: MenuPanel;

    constructor(parent: HTMLElement, private readonly options: DailyMenuOptions) {
        this.panel = new MenuPanel(parent, 'Daily Challenge', 'Same game, same layout, for everyone today.', options.onBack);
    }

    mount(): void {
        this.panel.mount();
        this.panel.content.replaceChildren(el('p', { className: 'menu-panel__status', text: 'Loading today’s challenge…' }));
        fetchDailyChallenge().then(
            (challenge) => this.render(challenge),
            () => this.panel.content.replaceChildren(el('p', { className: 'menu-panel__status', text: 'The Daily Challenge needs the game server, which is not reachable right now.' })),
        );
    }

    unmount(): void {
        this.panel.unmount();
    }

    private render(challenge: DailyChallengeInfo): void {
        const minigame = MINIGAMES.find((candidate) => candidate.id === challenge.minigame);

        if (!minigame) {
            this.panel.content.replaceChildren(el('p', { className: 'menu-panel__status', text: 'Today’s minigame is not available in this version.' }));
            return;
        }

        const error = el('p', { className: 'party-menu__error' });
        const playButton = el('button', {
            className: 'pp-button pp-button--primary',
            text: challenge.official_score === null ? 'Play official attempt' : 'Practice again',
            onClick: () => {
                playButton.disabled = true;
                this.options.onPlay(minigame).catch((reason: Error) => {
                    error.textContent = reason.message;
                    playButton.disabled = false;
                });
            },
        });

        const hours = Math.max(0, Math.round((challenge.resets_at - Date.now()) / 3_600_000));
        const card = el('div', { className: 'arcade-card daily-card' }, [
            el('span', { className: 'party-menu__label', text: challenge.date }),
            el('span', { className: 'arcade-card__name', text: minigame.name }),
            el('span', { className: 'arcade-card__tagline', text: minigame.tagline }),
            el('span', { className: 'arcade-card__meta' }, [
                el('span', { text: challenge.official_score === null ? 'No official score yet' : `Official score: ${challenge.official_score}` }),
                el('span', { text: `${challenge.attempts} attempt${challenge.attempts === 1 ? '' : 's'}` }),
                el('span', { text: `New challenge in ~${hours}h` }),
            ]),
        ]);
        card.style.setProperty('--card-accent', minigame.accent);

        this.panel.content.replaceChildren(
            card,
            el('div', { className: 'party-menu__panel' }, [el('span', { className: 'party-menu__label', text: 'Rules' }), el('p', { className: 'party-menu__hint', text: challenge.rules })]),
            playButton,
            el('button', { className: 'pp-button', text: 'Daily leaderboard', onClick: () => this.options.onLeaderboard() }),
            error,
        );
    }
}
