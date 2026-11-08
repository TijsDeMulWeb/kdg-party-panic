import { el } from '../dom';

/**
 * Shared in-game HUD: score, timer and pop-up callouts. Every minigame
 * uses the same component so the game feels consistent.
 */
export class GameHud {
    readonly root: HTMLElement;
    private readonly scoreValue: HTMLElement;
    private readonly timerValue: HTMLElement;
    private readonly timer: HTMLElement;
    private readonly callouts: HTMLElement;
    private score = 0;
    private shownSeconds = -1;

    constructor(title: string, characterName: string, onExit: () => void) {
        this.scoreValue = el('span', { className: 'game-hud__score-value', text: '0' });
        this.timerValue = el('span', { className: 'game-hud__timer-value', text: '' });
        this.timer = el('div', { className: 'game-hud__timer' }, [this.timerValue]);
        this.callouts = el('div', { className: 'game-hud__callouts' });

        this.root = el('div', { className: 'game-hud' }, [
            el('div', { className: 'game-hud__top' }, [
                el('div', { className: 'game-hud__left' }, [
                    el('button', { className: 'pp-button pp-button--small', text: '‹', attrs: { 'aria-label': 'Leave minigame' }, onClick: onExit }),
                    el('div', { className: 'game-hud__score' }, [el('span', { className: 'game-hud__label', text: 'Score' }), this.scoreValue]),
                ]),
                this.timer,
                el('div', { className: 'hud__badge' }, [el('span', { className: 'hud__badge-label', text: title }), el('span', { text: characterName })]),
            ]),
            this.callouts,
        ]);
    }

    setScore(score: number): void {
        if (score === this.score) {
            return;
        }

        this.score = score;
        this.scoreValue.textContent = String(score);
        this.restartAnimation(this.scoreValue, 'is-bumped');
    }

    /** Shows whole seconds; the last five seconds pulse in red. */
    setTime(seconds: number): void {
        const whole = Math.max(0, Math.ceil(seconds));

        if (whole === this.shownSeconds) {
            return;
        }

        this.shownSeconds = whole;
        this.timerValue.textContent = String(whole);
        this.timer.classList.toggle('is-urgent', whole <= 5 && whole > 0);

        if (whole <= 5) {
            this.restartAnimation(this.timer, 'is-ticking');
        }
    }

    /** Big floating text in the middle of the screen, e.g. "+142" or "Out!". */
    callout(text: string, tone: 'good' | 'bad' | 'neutral' = 'neutral'): void {
        const node = el('div', { className: `game-hud__callout game-hud__callout--${tone}`, text });
        this.callouts.append(node);
        node.addEventListener('animationend', () => node.remove());
    }

    setVisible(visible: boolean): void {
        this.root.classList.toggle('is-hidden', !visible);
    }

    private restartAnimation(node: HTMLElement, className: string): void {
        node.classList.remove(className);
        void node.offsetWidth;
        node.classList.add(className);
    }
}
