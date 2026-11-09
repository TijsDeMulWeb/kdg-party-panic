import { palette } from './palette';

export type Season = 'default' | 'christmas' | 'halloween' | 'easter';

export interface SeasonTheme {
    season: Season;
    /** Shown under the logo. */
    tagline: string;
    /** Hat that can only be picked during this season. */
    hat: { id: string; name: string } | null;
    /** Falling particles everywhere: snow, leaves or blossom. */
    ambience: { colors: number[]; size: number; speed: number; sway: number } | null;
    confetti: number[];
}

/** Easter Sunday for a year (anonymous Gregorian algorithm). */
export function easterSunday(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month - 1, day);
}

/**
 * Christmas: 1 December to 6 January. Halloween: 15 October to 2 November.
 * Easter: two weeks before to one week after Easter Sunday.
 */
export function seasonFor(date: Date): Season {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if (month === 12 || (month === 1 && day <= 6)) {
        return 'christmas';
    }

    if ((month === 10 && day >= 15) || (month === 11 && day <= 2)) {
        return 'halloween';
    }

    const easter = easterSunday(date.getFullYear()).getTime();
    const dayMs = 86_400_000;
    const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

    if (midnight >= easter - 14 * dayMs && midnight <= easter + 7 * dayMs) {
        return 'easter';
    }

    return 'default';
}

const THEMES: Record<Season, SeasonTheme> = {
    default: {
        season: 'default',
        tagline: 'Quick minigames. Four friends. Zero chill.',
        hat: null,
        ambience: null,
        confetti: [palette.coral, palette.sky, palette.sun, palette.mint, palette.grape, palette.bubblegum, palette.tangerine],
    },
    christmas: {
        season: 'christmas',
        tagline: 'Merry Panicmas! Snowball fights included.',
        hat: { id: 'santa-hat', name: 'Santa hat' },
        ambience: { colors: [0xffffff, 0xeaf6ff], size: 0.13, speed: 1.6, sway: 0.6 },
        confetti: [0xe23b3b, 0x2f9e5b, 0xffffff, 0xffc93c],
    },
    halloween: {
        season: 'halloween',
        tagline: 'Happy Hallowpanic! Trick, treat or tumble.',
        hat: { id: 'witch-hat', name: 'Witch hat' },
        ambience: { colors: [0xe8742a, 0xb5541b, 0x8a3d14, 0xf2b134], size: 0.14, speed: 1.1, sway: 1.4 },
        confetti: [0xff8a1f, 0x7b3fe4, 0x2b2340, 0x9be35a],
    },
    easter: {
        season: 'easter',
        tagline: 'Egg-cellent Easter! Hop to it.',
        hat: { id: 'bunny-ears', name: 'Bunny ears' },
        ambience: { colors: [0xffd1e8, 0xfff0f7, 0xe7d6ff], size: 0.1, speed: 0.8, sway: 1.1 },
        confetti: [0xffb3d9, 0xb8e6ff, 0xfff2a8, 0xc8f5c2, 0xe0c8ff],
    },
};

let active: SeasonTheme = THEMES.default;

/** Picks the season (date, or ?season= to preview one) and recolours the shared palette. */
export function applySeason(date = new Date()): SeasonTheme {
    const override = new URLSearchParams(window.location.search).get('season');
    const season = override && override in THEMES ? (override as Season) : seasonFor(date);
    active = THEMES[season];

    const colors = palette as unknown as Record<string, number>;

    if (season === 'christmas') {
        Object.assign(colors, { skyTop: 0x6c9fd8, skyHorizon: 0xdceefa, fog: 0xe3f0fa, grass: 0xf2f7ff, grassDark: 0xd5e4f5 });
    }

    if (season === 'halloween') {
        Object.assign(colors, { skyTop: 0x3b2a6b, skyHorizon: 0xf29b5c, fog: 0x8f6a9a, grass: 0x6f9a3e, grassDark: 0x52782b });
    }

    if (season === 'easter') {
        Object.assign(colors, { skyTop: 0x8fd3ff, skyHorizon: 0xfff0f7, fog: 0xfbefff, grass: 0x9be86f, grassDark: 0x7fd65a });
    }

    document.documentElement.dataset.season = season;

    return active;
}

export function seasonTheme(): SeasonTheme {
    return active;
}
