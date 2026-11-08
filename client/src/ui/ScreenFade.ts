import { el } from './dom';

const DURATION_MS = 260;

/** Full-screen colour wipe used between scenes. */
export class ScreenFade {
    private readonly element: HTMLDivElement;

    constructor(parent: HTMLElement) {
        this.element = el('div', { className: 'screen-fade is-covering' });
        parent.append(this.element);
    }

    cover(): Promise<void> {
        this.element.classList.add('is-covering');
        return wait(DURATION_MS);
    }

    reveal(): Promise<void> {
        // Wait a frame so the new scene has rendered before revealing it.
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                this.element.classList.remove('is-covering');
                wait(DURATION_MS).then(resolve);
            });
        });
    }
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}
