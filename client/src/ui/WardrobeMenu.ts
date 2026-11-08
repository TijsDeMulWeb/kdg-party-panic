import { HATS } from '../characters/hats';
import { ROSTER } from '../characters/roster';
import type { LocalProfile } from '../online/profile';
import { el } from './dom';
import { MenuPanel } from './MenuPanel';

export interface WardrobeMenuOptions {
    profile: LocalProfile;
    onChange(profile: LocalProfile): void;
    onBack(): void;
}

/** Pick your character and hat while the camera shows you up close. */
export class WardrobeMenu {
    private readonly panel: MenuPanel;
    private readonly characterName = el('span', { className: 'picker__name' });
    private readonly characterTagline = el('span', { className: 'picker__tagline' });
    private readonly swatch = el('span', { className: 'picker__swatch' });
    private readonly hats: HTMLElement;

    constructor(parent: HTMLElement, private readonly options: WardrobeMenuOptions) {
        this.panel = new MenuPanel(parent, 'Wardrobe', 'Pick your character and a hat. Everyone in your party sees it.', options.onBack, 'wardrobe');
        this.hats = el('div', { className: 'wardrobe__hats', attrs: { role: 'radiogroup', 'aria-label': 'Hat' } });

        this.panel.content.append(
            el('div', { className: 'party-menu__panel' }, [
                el('span', { className: 'party-menu__label', text: 'Character' }),
                el('div', { className: 'look-card__row' }, [
                    el('button', { className: 'picker__arrow', text: '‹', attrs: { 'aria-label': 'Previous character' }, onClick: () => this.cycleCharacter(-1) }),
                    el('div', { className: 'picker__info' }, [this.swatch, el('div', {}, [this.characterName, this.characterTagline])]),
                    el('button', { className: 'picker__arrow', text: '›', attrs: { 'aria-label': 'Next character' }, onClick: () => this.cycleCharacter(1) }),
                ]),
            ]),
            el('div', { className: 'party-menu__panel' }, [el('span', { className: 'party-menu__label', text: 'Hat' }), this.hats]),
            el('button', { className: 'pp-button pp-button--primary', text: 'Looking good!', onClick: () => options.onBack() }),
        );
    }

    mount(): void {
        this.panel.mount();
        this.render();
        window.addEventListener('keydown', this.onKeyDown);
    }

    unmount(): void {
        window.removeEventListener('keydown', this.onKeyDown);
        this.panel.unmount();
    }

    private cycleCharacter(direction: number): void {
        const index = ROSTER.indexOf(this.options.profile.character);
        this.update({ character: ROSTER[(index + direction + ROSTER.length) % ROSTER.length] });
    }

    private update(changes: Partial<LocalProfile>): void {
        Object.assign(this.options.profile, changes);
        this.options.onChange(this.options.profile);
        this.render();
    }

    private render(): void {
        const { character, hat } = this.options.profile;
        this.characterName.textContent = character.name;
        this.characterTagline.textContent = character.tagline;
        this.swatch.style.background = `#${character.body.toString(16).padStart(6, '0')}`;

        const choices = [{ id: null, name: 'No hat' }, ...HATS];
        this.hats.replaceChildren(
            ...choices.map((choice) =>
                el('button', {
                    className: `wardrobe__hat ${choice.id === hat ? 'is-selected' : ''}`,
                    text: choice.name,
                    attrs: { role: 'radio', 'aria-checked': String(choice.id === hat) },
                    onClick: () => this.update({ hat: choice.id }),
                }),
            ),
        );
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.code === 'ArrowLeft') {
            this.cycleCharacter(-1);
        }

        if (event.code === 'ArrowRight') {
            this.cycleCharacter(1);
        }
    };
}
