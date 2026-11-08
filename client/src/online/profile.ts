import { findCharacter, type CharacterDefinition } from '../characters/roster';
import { HATS } from '../characters/hats';
import { readStorage, writeStorage } from '../utils/storage';

const CHARACTER_KEY = 'party-panic.character';
const NAME_KEY = 'party-panic.name';
const HAT_KEY = 'party-panic.hat';

export interface LocalProfile {
    name: string;
    character: CharacterDefinition;
    hat: string | null;
}

/** The player's look and name, kept locally so the game works offline. */
export function loadProfile(): LocalProfile {
    const hat = readStorage(HAT_KEY, '');

    return {
        name: readStorage(NAME_KEY, ''),
        character: findCharacter(readStorage(CHARACTER_KEY, 'pip')),
        hat: HATS.some((candidate) => candidate.id === hat) ? hat : null,
    };
}

export function saveProfile(profile: LocalProfile): void {
    writeStorage(NAME_KEY, profile.name);
    writeStorage(CHARACTER_KEY, profile.character.id);
    writeStorage(HAT_KEY, profile.hat ?? '');
}

/** A friendly default for players who never typed a name. */
export function displayName(profile: LocalProfile): string {
    if (profile.name.trim()) {
        return profile.name.trim().slice(0, 16);
    }

    const generated = `${profile.character.name}${Math.floor(100 + Math.random() * 900)}`;
    profile.name = generated;
    saveProfile(profile);

    return generated;
}
