import { el } from '../dom';

/** 3-2-1-GO! overlay. Purely visual; the runner owns the timing. */
export class Countdown {
    private readonly root = el('div', { className: 'countdown' });
    private shown: string | null = null;

    mount(parent: HTMLElement): void {
        parent.append(this.root);
    }

    unmount(): void {
        this.root.remove();
    }

    /** `remaining` in seconds until GO. Negative values keep "GO!" briefly visible. */
    update(remaining: number): void {
        const label = remaining > 0 ? String(Math.ceil(remaining)) : 'GO!';

        if (label === this.shown) {
            return;
        }

        this.shown = label;
        const node = el('span', { className: `countdown__value ${label === 'GO!' ? 'is-go' : ''}`, text: label });
        this.root.replaceChildren(node);
    }
}
