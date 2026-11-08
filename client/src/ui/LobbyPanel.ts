import { findCharacter, ROSTER } from '../characters/roster';
import { HATS } from '../characters/hats';
import type { RoomPlayer, RoomState } from '../multiplayer/types';
import { el } from './dom';

export interface LobbyPanelOptions {
    playerId: number;
    onReady(isReady: boolean): Promise<void>;
    onCharacter(character: string): Promise<void>;
    onHat(hat: string | null): Promise<void>;
    onStart(): Promise<void>;
    onLeave(): void;
}

const css = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/** Multiplayer lobby: room code, seats, ready states and the host's start button. */
export class LobbyPanel {
    private readonly root: HTMLElement;
    private readonly code: HTMLElement;
    private readonly seats: HTMLElement;
    private readonly readyButton: HTMLButtonElement;
    private readonly startButton: HTMLButtonElement;
    private readonly startHint: HTMLElement;
    private readonly characterName: HTMLElement;
    private readonly hatName = el('span', { className: 'picker__name picker__name--small' });
    private readonly message: HTMLElement;
    private state: RoomState | null = null;
    private online: ReadonlySet<number> = new Set();
    private busy = false;

    constructor(private readonly parent: HTMLElement, private readonly options: LobbyPanelOptions) {
        this.code = el('span', { className: 'lobby__code-value' });
        this.seats = el('ol', { className: 'lobby__seats' });
        this.characterName = el('span', { className: 'picker__name' });
        this.message = el('p', { className: 'party-menu__error', attrs: { role: 'status' } });
        this.readyButton = el('button', { className: 'pp-button pp-button--primary', onClick: () => void this.toggleReady() });
        this.startButton = el('button', { className: 'pp-button pp-button--start', text: 'Start match', onClick: () => void this.run(() => this.options.onStart()) });
        this.startHint = el('span', { className: 'lobby__start-hint' });

        this.root = el('div', { className: 'arcade lobby' }, [
            el('div', { className: 'arcade__header' }, [
                el('button', { className: 'pp-button pp-button--small', text: '‹ Leave', onClick: () => options.onLeave() }),
                el('h2', { className: 'arcade__title', text: 'Lobby' }),
            ]),
            el('button', { className: 'lobby__code', attrs: { title: 'Copy code' }, onClick: () => this.copyCode() }, [
                el('span', { className: 'party-menu__label', text: 'Party code' }),
                this.code,
                el('span', { className: 'lobby__code-hint', text: 'Tap to copy and share with friends' }),
            ]),
            this.seats,
            el('div', { className: 'picker look-card lobby__picker' }, [
                el('div', { className: 'look-card__row' }, [
                    el('button', { className: 'picker__arrow', text: '‹', attrs: { 'aria-label': 'Previous character' }, onClick: () => void this.cycleCharacter(-1) }),
                    el('div', { className: 'picker__info' }, [el('span', { className: 'party-menu__label', text: 'You play as' }), this.characterName]),
                    el('button', { className: 'picker__arrow', text: '›', attrs: { 'aria-label': 'Next character' }, onClick: () => void this.cycleCharacter(1) }),
                ]),
                el('div', { className: 'look-card__row' }, [
                    el('button', { className: 'picker__arrow', text: '‹', attrs: { 'aria-label': 'Previous hat' }, onClick: () => void this.cycleHat(-1) }),
                    el('div', { className: 'picker__info' }, [el('span', { className: 'party-menu__label', text: 'Hat' }), this.hatName]),
                    el('button', { className: 'picker__arrow', text: '›', attrs: { 'aria-label': 'Next hat' }, onClick: () => void this.cycleHat(1) }),
                ]),
            ]),
            el('div', { className: 'lobby__actions' }, [this.readyButton, this.startButton, this.startHint]),
            this.message,
        ]);
    }

    mount(): void {
        this.parent.append(this.root);
    }

    unmount(): void {
        this.root.remove();
    }

    showMessage(text: string): void {
        this.message.textContent = text;
    }

    render(state: RoomState, online: ReadonlySet<number>): void {
        this.state = state;
        this.online = online;
        const me = this.me();
        const isHost = state.host_id === this.options.playerId;

        this.code.textContent = state.code;
        this.seats.replaceChildren(...Array.from({ length: state.max_players }, (_, seat) => this.renderSeat(state, seat)));

        if (me) {
            this.characterName.textContent = findCharacter(me.character).name;
            this.hatName.textContent = HATS.find((hat) => hat.id === me.hat)?.name ?? 'No hat';
            this.readyButton.textContent = me.is_ready ? 'Not ready' : "I'm ready!";
            this.readyButton.classList.toggle('is-ready', me.is_ready);
        }

        const blocker = this.startBlocker(state);
        const anyoneOffline = state.players.some((player) => !online.has(player.id));
        const readyHint = anyoneOffline ? 'Offline players are removed when you start.' : 'Everyone is ready!';
        this.startButton.hidden = !isHost;
        this.startButton.disabled = this.busy || blocker !== null;
        this.startHint.textContent = isHost ? (blocker ?? readyHint) : 'The host starts the match.';

        if (state.active_match && !state.active_match.is_finished) {
            this.startHint.textContent = 'A match is being played. You will join the next one.';
        }
    }

    private renderSeat(state: RoomState, seat: number): HTMLElement {
        const player = state.players.find((candidate) => candidate.seat === seat);

        if (!player) {
            return el('li', { className: 'lobby-seat is-empty' }, [el('span', { className: 'lobby-seat__swatch' }), el('span', { className: 'lobby-seat__name', text: 'Waiting for a friend…' })]);
        }

        const character = findCharacter(player.character);
        const isOnline = this.online.has(player.id);
        const swatch = el('span', { className: 'lobby-seat__swatch' });
        swatch.style.background = css(character.body);

        const status = !isOnline ? 'Offline' : player.is_ready ? 'Ready' : 'Not ready';

        return el('li', { className: `lobby-seat ${player.is_ready ? 'is-ready' : ''} ${isOnline ? '' : 'is-offline'}` }, [
            swatch,
            el('span', { className: 'lobby-seat__name' }, [
                el('span', { text: player.name }),
                player.id === this.options.playerId ? el('span', { className: 'lobby-seat__you', text: 'you' }) : null,
                player.id === state.host_id ? el('span', { className: 'pp-tag', text: 'Host' }) : null,
            ]),
            el('span', { className: 'lobby-seat__status', text: status }),
        ]);
    }

    private startBlocker(state: RoomState): string | null {
        if (state.players.length < state.min_players) {
            return `Waiting for at least ${state.min_players} players.`;
        }

        if (state.players.some((player) => !player.is_ready)) {
            return 'Waiting until everyone is ready.';
        }

        return null;
    }

    private me(): RoomPlayer | undefined {
        return this.state?.players.find((player) => player.id === this.options.playerId);
    }

    private async toggleReady(): Promise<void> {
        const me = this.me();

        if (me) {
            await this.run(() => this.options.onReady(!me.is_ready));
        }
    }

    private async cycleCharacter(direction: number): Promise<void> {
        const me = this.me();

        if (!me || !this.state) {
            return;
        }

        const taken = new Set(this.state.players.filter((player) => player.id !== me.id).map((player) => player.character));
        const index = ROSTER.findIndex((character) => character.id === me.character);

        for (let step = 1; step < ROSTER.length; step++) {
            const candidate = ROSTER[(index + direction * step + ROSTER.length * step) % ROSTER.length];

            if (!taken.has(candidate.id)) {
                await this.run(() => this.options.onCharacter(candidate.id));
                return;
            }
        }
    }

    private async cycleHat(direction: number): Promise<void> {
        const me = this.me();

        if (!me) {
            return;
        }

        const options = [null, ...HATS.map((hat) => hat.id)];
        const index = options.indexOf(me.hat);
        await this.run(() => this.options.onHat(options[(index + direction + options.length) % options.length]));
    }

    private copyCode(): void {
        if (!this.state) {
            return;
        }

        navigator.clipboard?.writeText(this.state.code).then(
            () => this.showMessage('Code copied!'),
            () => this.showMessage(`Your code is ${this.state?.code}`),
        );
    }

    private async run(action: () => Promise<void>): Promise<void> {
        if (this.busy) {
            return;
        }

        this.busy = true;
        this.showMessage('');

        try {
            await action();
        } catch (error) {
            this.showMessage(error instanceof Error ? error.message : 'Something went wrong.');
        } finally {
            this.busy = false;
            if (this.state) {
                this.render(this.state, this.online);
            }
        }
    }
}
