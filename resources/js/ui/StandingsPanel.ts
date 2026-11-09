import { findCharacter } from '../characters/roster';
import type { RoundOutcome, StandingRow } from '../multiplayer/types';
import { el } from './dom';

const css = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
const ORDINALS = ['1st', '2nd', '3rd', '4th'];

/** Round results, then the tournament table, between party rounds. */
export class StandingsPanel {
    readonly root: HTMLElement;
    private readonly title: HTMLElement;
    private readonly body: HTMLElement;
    private readonly footer: HTMLElement;

    constructor(
        private readonly playerId: number,
        private readonly names: Map<number, string>,
    ) {
        this.title = el('h2', { className: 'card__title' });
        this.body = el('div', { className: 'standings__body' });
        this.footer = el('p', { className: 'standings__footer' });
        this.root = el('div', { className: 'overlay overlay--side' }, [el('div', { className: 'card standings' }, [this.title, this.body, this.footer])]);
    }

    showWaiting(roundNumber: number, totalRounds: number, myScore: number): void {
        this.title.textContent = `Round ${roundNumber} of ${totalRounds}`;
        this.body.replaceChildren(el('p', { className: 'standings__waiting', text: `You scored ${myScore}. Waiting for the others…` }));
    }

    showRound(outcome: RoundOutcome): void {
        this.title.textContent = `Round ${outcome.round.number} results`;
        const rows = outcome.results.map((result, index) => {
            const placement = result.placement === null ? 'DNF' : ORDINALS[result.placement - 1];
            const row = el('li', { className: `standings-row ${result.player_id === this.playerId ? 'is-me' : ''}` }, [
                el('span', { className: `standings-row__place place-${result.placement ?? 0}`, text: placement }),
                this.swatch(outcome.standings.find((standing) => standing.player_id === result.player_id)?.character),
                el('span', { className: 'standings-row__name', text: this.names.get(result.player_id) ?? 'Player' }),
                el('span', { className: 'standings-row__score', text: String(result.score) }),
                el('span', { className: 'standings-row__points', text: `+${result.points}` }),
            ]);
            row.style.animationDelay = `${index * 120}ms`;
            return row;
        });

        this.body.replaceChildren(el('ol', { className: 'standings__list' }, rows));
    }

    showStandings(outcome: RoundOutcome): void {
        this.title.textContent = outcome.match_finished ? 'Final standings' : 'Tournament standings';
        const leader = Math.max(1, ...outcome.standings.map((row) => row.total_points));
        const rows = outcome.standings.map((row: StandingRow, index) => {
            const bar = el('span', { className: 'standings-row__bar' });
            bar.style.setProperty('--fill', `${(row.total_points / leader) * 100}%`);
            const item = el('li', { className: `standings-row standings-row--total ${row.player_id === this.playerId ? 'is-me' : ''}` }, [
                el('span', { className: `standings-row__place place-${row.rank}`, text: ORDINALS[row.rank - 1] ?? `${row.rank}th` }),
                this.swatch(row.character),
                el('span', { className: 'standings-row__name', text: row.name }),
                el('span', { className: 'standings-row__points', text: `${row.total_points} pts` }),
                bar,
            ]);
            item.style.animationDelay = `${index * 120}ms`;
            return item;
        });

        this.body.replaceChildren(el('ol', { className: 'standings__list' }, rows));
    }

    setFooter(text: string): void {
        this.footer.textContent = text;
    }

    private swatch(character: string | undefined): HTMLElement {
        const swatch = el('span', { className: 'lobby-seat__swatch' });
        swatch.style.background = css(findCharacter(character ?? '').body);
        return swatch;
    }
}
