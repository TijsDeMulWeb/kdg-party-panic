/**
 * Snapshots carry one flat number array (`e`) for minigame data. Games that
 * send several kinds of data (throws, hits, claims) pack them into numbered
 * sections: [sectionId, length, ...values, sectionId, length, ...values].
 */
export function packSections(sections: Record<number, number[]>): number[] {
    const packed: number[] = [];

    for (const [id, values] of Object.entries(sections)) {
        if (values.length > 0) {
            packed.push(Number(id), values.length, ...values);
        }
    }

    return packed;
}

export function unpackSections(packed: number[] | undefined): Map<number, number[]> {
    const sections = new Map<number, number[]>();

    if (!packed) {
        return sections;
    }

    let index = 0;
    while (index + 1 < packed.length) {
        const id = packed[index];
        const length = packed[index + 1];
        sections.set(id, packed.slice(index + 2, index + 2 + length));
        index += 2 + length;
    }

    return sections;
}
