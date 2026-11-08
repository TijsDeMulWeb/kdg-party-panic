/**
 * Party Panic colour palette. Shared by 3D materials and mirrored as CSS
 * custom properties in ui/styles.css so the HUD and the world match.
 */
export const palette = {
    skyTop: 0x3fa9ff,
    skyHorizon: 0xbdeaff,
    fog: 0xc9eeff,

    grass: 0x7ed957,
    grassDark: 0x5bbf3c,
    dirt: 0xc98a5a,
    dirtDark: 0x9c6238,
    rock: 0x9aa7c7,
    cloud: 0xffffff,

    coral: 0xff5a5f,
    sky: 0x3ea6ff,
    sun: 0xffc93c,
    mint: 0x3ddc97,
    grape: 0xa66cff,
    bubblegum: 0xff7ac6,
    tangerine: 0xff9a3c,

    ink: 0x2b2340,
    white: 0xffffff,
} as const;

export const partyColors: readonly number[] = [
    palette.coral,
    palette.sky,
    palette.sun,
    palette.mint,
    palette.grape,
    palette.bubblegum,
    palette.tangerine,
];
