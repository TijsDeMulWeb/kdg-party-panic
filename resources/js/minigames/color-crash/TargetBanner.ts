import { el } from '../../ui/dom';
import { cssColor, symbolSvg, type CrashColor } from './colors';

/** "Find BLUE!" call-out with a shrinking timer bar. */
export class TargetBanner {
    readonly root: HTMLElement;
    private readonly icon: HTMLElement;
    private readonly name: HTMLElement;
    private readonly bar: HTMLElement;

    constructor() {
        this.icon = el('span', { className: 'target-banner__icon' });
        this.name = el('span', { className: 'target-banner__name' });
        this.bar = el('span', { className: 'target-banner__bar' });

        this.root = el('div', { className: 'target-banner' }, [
            el('div', { className: 'target-banner__pill' }, [this.icon, el('span', { className: 'target-banner__label', text: 'Find' }), this.name]),
            el('div', { className: 'target-banner__track' }, [this.bar]),
        ]);
    }

    show(color: CrashColor): void {
        const css = cssColor(color.color);
        this.root.style.setProperty('--target-color', css);
        this.icon.innerHTML = symbolSvg(color.symbol, css);
        this.name.textContent = `${color.name}!`;
        this.root.classList.remove('is-visible', 'is-dropping');
        void this.root.offsetWidth;
        this.root.classList.add('is-visible');
    }

    /** 1 = full time left, 0 = tiles drop now. */
    setProgress(progress: number): void {
        this.bar.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`;
        this.root.classList.toggle('is-urgent', progress < 0.3);
    }

    dropping(): void {
        this.root.classList.add('is-dropping');
    }

    hide(): void {
        this.root.classList.remove('is-visible');
    }
}
