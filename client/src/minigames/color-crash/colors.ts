import { palette } from '../../design/palette';

export type SymbolShape = 'circle' | 'square' | 'triangle' | 'star' | 'diamond';

export interface CrashColor {
    name: string;
    color: number;
    symbol: SymbolShape;
}

/**
 * Each colour also has its own symbol so the game stays playable for
 * colour-blind players: you can always match on shape instead.
 */
export const CRASH_COLORS: readonly CrashColor[] = [
    { name: 'Red', color: palette.coral, symbol: 'circle' },
    { name: 'Blue', color: palette.sky, symbol: 'square' },
    { name: 'Yellow', color: palette.sun, symbol: 'triangle' },
    { name: 'Green', color: palette.mint, symbol: 'star' },
    { name: 'Purple', color: palette.grape, symbol: 'diamond' },
];

/** Symbol outline as a polygon with unit radius, shared by 3D tiles and the HUD. */
export function symbolPoints(symbol: SymbolShape): [number, number][] {
    const polygon = (count: number, radius: number, rotation: number): [number, number][] =>
        Array.from({ length: count }, (_, index) => {
            const angle = rotation + (index / count) * Math.PI * 2;
            return [Math.cos(angle) * radius, Math.sin(angle) * radius];
        });

    switch (symbol) {
        case 'circle':
            return polygon(32, 0.9, 0);
        case 'square':
            return polygon(4, 1, Math.PI / 4);
        case 'triangle':
            return polygon(3, 1.05, Math.PI / 2).map(([x, y]) => [x, y - 0.15]);
        case 'diamond':
            return [
                [0, 1],
                [0.7, 0],
                [0, -1],
                [-0.7, 0],
            ];
        case 'star':
            return Array.from({ length: 10 }, (_, index) => {
                const angle = Math.PI / 2 + (index / 10) * Math.PI * 2;
                const radius = index % 2 === 0 ? 1.05 : 0.45;
                return [Math.cos(angle) * radius, Math.sin(angle) * radius];
            });
    }
}

export function cssColor(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
}

/** Inline SVG of a symbol, for HUD elements. */
export function symbolSvg(symbol: SymbolShape, fill: string): string {
    const points = symbolPoints(symbol)
        .map(([x, y]) => `${(x * 10).toFixed(2)},${(-y * 10).toFixed(2)}`)
        .join(' ');

    return `<svg viewBox="-12 -12 24 24" aria-hidden="true"><polygon points="${points}" fill="${fill}" stroke="#2b2340" stroke-width="2" stroke-linejoin="round"/></svg>`;
}
