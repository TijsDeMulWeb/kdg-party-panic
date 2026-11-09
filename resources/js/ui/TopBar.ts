import { el } from './dom';

export interface TopBarOptions {
    onProfile(): void;
    onWardrobe(): void;
}

const HANGER_ICON = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 7a2.5 2.5 0 1 1 3.4 2.33c-.55.21-.9.74-.9 1.32V11"/><path d="M12 11 3.2 17.1A1 1 0 0 0 3.8 19h16.4a1 1 0 0 0 .6-1.9L12 11z"/></svg>`;

/** Top-right corner of the title screen: who you are, and the wardrobe. */
export class TopBar {
    private readonly root: HTMLElement;
    private readonly name = el('span', { className: 'top-bar__name' });
    private readonly swatch = el('span', { className: 'top-bar__swatch' });

    constructor(private readonly parent: HTMLElement, options: TopBarOptions) {
        const wardrobe = el('button', { className: 'top-bar__button top-bar__wardrobe', attrs: { 'aria-label': 'Wardrobe: character and hat', title: 'Wardrobe' }, onClick: () => options.onWardrobe() });
        wardrobe.innerHTML = HANGER_ICON;

        this.root = el('div', { className: 'top-bar' }, [
            el('button', { className: 'top-bar__button top-bar__profile', attrs: { 'aria-label': 'Profile', title: 'Profile' }, onClick: () => options.onProfile() }, [this.swatch, this.name]),
            wardrobe,
        ]);
    }

    render(name: string, color: number): void {
        this.name.textContent = name || 'Profile';
        this.swatch.style.background = `#${color.toString(16).padStart(6, '0')}`;
    }

    mount(): void {
        this.parent.append(this.root);
    }

    unmount(): void {
        this.root.remove();
    }
}
