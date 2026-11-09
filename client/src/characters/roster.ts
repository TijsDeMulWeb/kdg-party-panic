import { palette } from '../design/palette';

export type Topper = 'antenna' | 'sprout' | 'ears' | 'crest';

export interface CharacterDefinition {
    id: string;
    name: string;
    tagline: string;
    body: number;
    accent: number;
    feet: number;
    topper: Topper;
}

/**
 * The four starter characters. Each has a distinct colour and silhouette
 * (head topper) so players can be told apart at a glance. Customisation
 * later will produce new definitions in this same shape.
 */
export const ROSTER: readonly CharacterDefinition[] = [
    { id: 'pip', name: 'Pip', tagline: 'Fizzy and fearless', body: palette.coral, accent: 0xffd1c9, feet: 0xc23a48, topper: 'antenna' },
    { id: 'blu', name: 'Blu', tagline: 'Cool under pressure', body: palette.sky, accent: 0xcdeaff, feet: 0x1f6fd1, topper: 'ears' },
    { id: 'zing', name: 'Zing', tagline: 'Fastest grin in town', body: palette.sun, accent: 0xfff2c2, feet: 0xe08a12, topper: 'crest' },
    { id: 'moss', name: 'Moss', tagline: 'Small sprout, big plans', body: palette.mint, accent: 0xd3fbe6, feet: 0x1f9e68, topper: 'sprout' },
];

export function findCharacter(id: string): CharacterDefinition {
    return ROSTER.find((character) => character.id === id) ?? ROSTER[0];
}
