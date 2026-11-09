import { seasonTheme, type Season } from '../design/season';

export type MusicMood = 'menu' | 'game';

interface Pattern {
    tempo: number;
    /** Sleigh-bell style shimmer on every eighth (Christmas). */
    bells?: boolean;
    /** Bass notes per eighth (MIDI numbers, 0 = rest). */
    bass: number[];
    /** Chord roots per bar. */
    chords: number[][];
    lead: number[];
}

const PATTERNS: Record<MusicMood, Pattern> = {
    menu: {
        tempo: 112,
        bass: [48, 0, 55, 0, 52, 0, 55, 0, 45, 0, 52, 0, 48, 0, 52, 0, 41, 0, 48, 0, 45, 0, 48, 0, 43, 0, 50, 0, 47, 0, 50, 0],
        chords: [
            [60, 64, 67],
            [57, 60, 64],
            [53, 57, 60],
            [55, 59, 62],
        ],
        lead: [72, 0, 76, 79, 0, 76, 74, 0, 72, 0, 69, 72, 0, 74, 76, 0, 77, 0, 76, 74, 0, 72, 69, 0, 71, 0, 74, 0, 79, 0, 0, 0],
    },
    game: {
        tempo: 140,
        bass: [45, 45, 57, 45, 45, 57, 45, 57, 41, 41, 53, 41, 41, 53, 41, 53, 43, 43, 55, 43, 43, 55, 43, 55, 40, 40, 52, 40, 44, 56, 44, 56],
        chords: [
            [57, 60, 64],
            [53, 57, 60],
            [55, 59, 62],
            [52, 56, 59],
        ],
        lead: [69, 0, 72, 0, 76, 0, 72, 74, 0, 72, 69, 0, 65, 0, 69, 0, 67, 0, 71, 0, 74, 0, 71, 72, 0, 71, 68, 0, 64, 0, 0, 0],
    },
};

/** Seasonal replacements for the menu tune; in-game music only gets the extra layer. */
const SEASONAL_MENU: Partial<Record<Season, Pattern>> = {
    christmas: {
        tempo: 116,
        bells: true,
        bass: [43, 0, 50, 0, 47, 0, 50, 0, 40, 0, 47, 0, 43, 0, 47, 0, 36, 0, 43, 0, 40, 0, 43, 0, 38, 0, 45, 0, 42, 0, 45, 0],
        chords: [
            [55, 59, 62],
            [52, 55, 59],
            [48, 52, 55],
            [50, 54, 57],
        ],
        lead: [74, 0, 74, 76, 74, 0, 71, 0, 72, 0, 72, 74, 72, 0, 67, 0, 69, 0, 71, 72, 74, 0, 79, 0, 78, 0, 76, 0, 74, 0, 0, 0],
    },
    halloween: {
        tempo: 96,
        bass: [45, 0, 45, 52, 0, 45, 51, 0, 41, 0, 41, 48, 0, 41, 47, 0, 40, 0, 40, 47, 0, 40, 46, 0, 45, 0, 44, 0, 45, 0, 40, 0],
        chords: [
            [57, 60, 64],
            [53, 57, 60],
            [52, 56, 59],
            [57, 60, 63],
        ],
        lead: [69, 0, 72, 0, 71, 70, 69, 0, 0, 65, 0, 68, 0, 69, 0, 0, 64, 0, 68, 71, 0, 70, 0, 69, 0, 0, 68, 0, 69, 0, 0, 0],
    },
    easter: {
        tempo: 120,
        bells: true,
        bass: [41, 0, 48, 0, 45, 0, 48, 0, 46, 0, 53, 0, 50, 0, 53, 0, 43, 0, 50, 0, 46, 0, 50, 0, 48, 0, 55, 0, 52, 0, 55, 0],
        chords: [
            [53, 57, 60],
            [58, 62, 65],
            [55, 58, 62],
            [60, 64, 67],
        ],
        lead: [77, 0, 81, 0, 84, 0, 81, 79, 0, 77, 79, 0, 81, 0, 0, 0, 79, 0, 77, 76, 0, 74, 0, 76, 77, 0, 72, 0, 77, 0, 0, 0],
    },
};

const frequency = (note: number): number => 440 * Math.pow(2, (note - 69) / 12);

/**
 * Tiny step sequencer: bass, off-beat chord stabs, a lead and a hi-hat,
 * scheduled slightly ahead of time so it never stutters.
 */
export class Music {
    private readonly output: GainNode;
    private pattern: Pattern | null = null;
    private step = 0;
    private nextTime = 0;
    private timer = 0;

    constructor(private readonly context: AudioContext, destination: AudioNode) {
        this.output = context.createGain();
        this.output.gain.value = 0.07;
        this.output.connect(destination);
    }

    play(mood: MusicMood | null): void {
        const seasonal = mood === 'menu' ? SEASONAL_MENU[seasonTheme().season] : undefined;
        const base = mood ? PATTERNS[mood] : null;
        const next = seasonal ?? (base && seasonTheme().season === 'christmas' ? { ...base, bells: true } : base);

        if (next === this.pattern || (next && this.pattern && next.lead === this.pattern.lead && next.tempo === this.pattern.tempo)) {
            return;
        }

        this.pattern = next;
        window.clearInterval(this.timer);

        if (!next) {
            return;
        }

        this.step = 0;
        this.nextTime = this.context.currentTime + 0.1;
        this.timer = window.setInterval(() => this.schedule(), 50);
    }

    private schedule(): void {
        const pattern = this.pattern;

        if (!pattern) {
            return;
        }

        const eighth = 60 / pattern.tempo / 2;

        while (this.nextTime < this.context.currentTime + 0.2) {
            const step = this.step % pattern.bass.length;
            const time = this.nextTime;
            const bar = Math.floor(step / 8) % pattern.chords.length;

            if (pattern.bass[step]) {
                this.note(frequency(pattern.bass[step]), time, eighth * 0.9, 'triangle', 1.1);
            }

            if (step % 4 === 2) {
                pattern.chords[bar].forEach((note) => this.note(frequency(note), time, eighth * 0.6, 'square', 0.18));
            }

            if (pattern.lead[step]) {
                this.note(frequency(pattern.lead[step]), time, eighth * 1.6, 'sine', 0.45);
            }

            this.hat(time, step % 2 === 0 ? 0.25 : 0.12);

            if (pattern.bells) {
                this.note(frequency(96 + (step % 3) * 2), time, eighth * 0.4, 'triangle', 0.08);
            }

            this.nextTime += eighth;
            this.step++;
        }
    }

    private note(hz: number, time: number, duration: number, type: OscillatorType, volume: number): void {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = type;
        oscillator.frequency.value = hz;
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(volume, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        oscillator.connect(gain).connect(this.output);
        oscillator.start(time);
        oscillator.stop(time + duration + 0.02);
    }

    private hat(time: number, volume: number): void {
        const buffer = this.context.createBuffer(1, this.context.sampleRate * 0.03, this.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let index = 0; index < data.length; index++) {
            data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
        }
        const source = this.context.createBufferSource();
        const filter = this.context.createBiquadFilter();
        const gain = this.context.createGain();
        source.buffer = buffer;
        filter.type = 'highpass';
        filter.frequency.value = 7000;
        gain.gain.value = volume;
        source.connect(filter).connect(gain).connect(this.output);
        source.start(time);
    }
}
