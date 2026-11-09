export type SoundName =
    | 'jump'
    | 'land'
    | 'dash'
    | 'score'
    | 'bonus'
    | 'wrong'
    | 'tick'
    | 'go'
    | 'whistle'
    | 'out'
    | 'pop'
    | 'click'
    | 'win'
    | 'collect'
    | 'bump';

interface Tone {
    type: OscillatorType;
    from: number;
    to?: number;
    start?: number;
    duration: number;
    volume: number;
}

function tone(context: AudioContext, output: AudioNode, { type, from, to, start = 0, duration, volume }: Tone): void {
    const time = context.currentTime + start;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, time);
    if (to !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(to, time + duration);
    }

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    oscillator.connect(gain).connect(output);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
}

let noiseBuffer: AudioBuffer | null = null;

function noise(context: AudioContext, output: AudioNode, duration: number, volume: number, filterFrom: number, filterTo = filterFrom, type: BiquadFilterType = 'lowpass'): void {
    if (!noiseBuffer || noiseBuffer.sampleRate !== context.sampleRate) {
        noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let index = 0; index < data.length; index++) {
            data[index] = Math.random() * 2 - 1;
        }
    }

    const time = context.currentTime;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = noiseBuffer;
    filter.type = type;
    filter.frequency.setValueAtTime(filterFrom, time);
    filter.frequency.exponentialRampToValueAtTime(filterTo, time + duration);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    source.connect(filter).connect(gain).connect(output);
    source.start(time);
    source.stop(time + duration);
}

/** Little synthesised sound effects, tuned to sound toy-like and bright. */
export function playSound(context: AudioContext, output: AudioNode, name: SoundName, intensity: number): void {
    const volume = 0.18 * Math.min(1.5, Math.max(0.2, intensity));

    switch (name) {
        case 'jump':
            tone(context, output, { type: 'square', from: 320, to: 720, duration: 0.12, volume: volume * 0.5 });
            break;
        case 'land':
            noise(context, output, 0.09, volume * 0.8, 900, 200);
            break;
        case 'dash':
            noise(context, output, 0.22, volume, 600, 3000, 'bandpass');
            break;
        case 'score':
            tone(context, output, { type: 'triangle', from: 1046, duration: 0.1, volume });
            tone(context, output, { type: 'triangle', from: 1318, start: 0.07, duration: 0.14, volume });
            break;
        case 'bonus':
            [1046, 1318, 1568, 2093].forEach((from, index) => tone(context, output, { type: 'triangle', from, start: index * 0.06, duration: 0.12, volume }));
            break;
        case 'wrong':
            tone(context, output, { type: 'sawtooth', from: 320, to: 140, duration: 0.3, volume: volume * 0.6 });
            break;
        case 'tick':
            tone(context, output, { type: 'square', from: 880, duration: 0.08, volume: volume * 0.5 });
            break;
        case 'go':
            tone(context, output, { type: 'square', from: 1320, duration: 0.35, volume: volume * 0.5 });
            tone(context, output, { type: 'triangle', from: 660, duration: 0.35, volume });
            break;
        case 'whistle':
            tone(context, output, { type: 'sine', from: 2200, to: 2600, duration: 0.18, volume });
            tone(context, output, { type: 'sine', from: 2600, to: 2100, start: 0.2, duration: 0.4, volume });
            break;
        case 'out':
            tone(context, output, { type: 'triangle', from: 700, to: 90, duration: 0.6, volume });
            noise(context, output, 0.4, volume * 0.5, 2000, 200);
            break;
        case 'pop':
            tone(context, output, { type: 'sine', from: 600, to: 1400, duration: 0.07, volume });
            break;
        case 'click':
            tone(context, output, { type: 'triangle', from: 1200, to: 900, duration: 0.05, volume: volume * 0.6 });
            break;
        case 'win':
            [523, 659, 784, 1046, 784, 1046].forEach((from, index) => tone(context, output, { type: 'square', from, start: index * 0.11, duration: 0.18, volume: volume * 0.45 }));
            break;
        case 'collect':
            tone(context, output, { type: 'sine', from: 500 + Math.random() * 200, to: 1600, duration: 0.09, volume: volume * 0.8 });
            break;
        case 'bump':
            tone(context, output, { type: 'sine', from: 180, to: 80, duration: 0.15, volume });
            break;
    }
}
