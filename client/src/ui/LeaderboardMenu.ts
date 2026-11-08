import { findCharacter } from '../characters/roster';
import { MINIGAMES } from '../minigames/registry';
import { fetchLeaderboard, type Leaderboard } from '../online/onlineApi';
import { el } from './dom';
import { MenuPanel } from './MenuPanel';

/** Global leaderboards: the daily challenge plus all-time bests per minigame. */
export class LeaderboardMenu {
    private readonly panel: MenuPanel;
    private readonly tabs: HTMLElement;
    private readonly list: HTMLElement;
    private board = 'daily';

    constructor(parent: HTMLElement, onBack: () => void) {
        this.panel = new MenuPanel(parent, 'Leaderboard', 'Best score per player, worldwide.', onBack);
        this.tabs = el('div', { className: 'tabs', attrs: { role: 'tablist' } });
        this.list = el('div', { className: 'leaderboard' });
        this.panel.content.append(this.tabs, this.list);
    }

    mount(board = this.board): void {
        this.panel.mount();
        this.select(board);
    }

    unmount(): void {
        this.panel.unmount();
    }

    private select(board: string): void {
        this.board = board;
        const boards = [{ id: 'daily', name: 'Daily' }, ...MINIGAMES.map((minigame) => ({ id: minigame.id, name: minigame.name }))];

        this.tabs.replaceChildren(
            ...boards.map((candidate) =>
                el('button', {
                    className: `tab ${candidate.id === board ? 'is-active' : ''}`,
                    text: candidate.name,
                    attrs: { role: 'tab', 'aria-selected': String(candidate.id === board) },
                    onClick: () => this.select(candidate.id),
                }),
            ),
        );

        this.list.replaceChildren(el('p', { className: 'menu-panel__status', text: 'Loading…' }));
        fetchLeaderboard(board).then(
            (leaderboard) => {
                if (this.board === board) {
                    this.render(leaderboard);
                }
            },
            () => this.list.replaceChildren(el('p', { className: 'menu-panel__status', text: 'Leaderboards are offline right now.' })),
        );
    }

    private render(leaderboard: Leaderboard): void {
        if (leaderboard.entries.length === 0) {
            this.list.replaceChildren(el('p', { className: 'menu-panel__status', text: 'No scores yet. Be the first!' }));
            return;
        }

        const rows = leaderboard.entries.map((entry) => {
            const swatch = el('span', { className: 'lobby-seat__swatch' });
            swatch.style.background = `#${findCharacter(entry.character ?? '').body.toString(16).padStart(6, '0')}`;
            return el('li', { className: `standings-row ${entry.is_me ? 'is-me' : ''}` }, [
                el('span', { className: `standings-row__place place-${entry.rank}`, text: `#${entry.rank}` }),
                swatch,
                el('span', { className: 'standings-row__name', text: entry.name }),
                el('span', { className: 'standings-row__points', text: String(entry.score) }),
            ]);
        });

        const meOutsideTop = leaderboard.me && !leaderboard.entries.some((entry) => entry.is_me);

        this.list.replaceChildren(el('ol', { className: 'standings__list' }, rows));

        if (meOutsideTop && leaderboard.me) {
            this.list.append(el('p', { className: 'menu-panel__status', text: `You: #${leaderboard.me.rank} with ${leaderboard.me.score}` }));
        }
    }
}
