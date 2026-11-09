import { readStorage, writeStorage } from '../utils/storage';
import { Music, type MusicMood } from './music';
import { playSound, type SoundName } from './sounds';

const MUTED_KEY = 'party-panic.muted';

/**
 * All game audio is synthesised with the Web Audio API: no files to load.
 * Browsers only allow audio after a user gesture, so the context is created
 * lazily on the first click or key press.
 */
class AudioManager {
    private context: AudioContext | null = null;
    private master: GainNode | null = null;
    private music: Music | null = null;
    private mood: MusicMood | null = null;
    private muted = readStorage(MUTED_KEY, '0') === '1';
    private readonly listeners = new Set<(muted: boolean) => void>();

    constructor() {
        const unlock = (): void => {
            this.ensureContext();
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
        };
        window.addEventListener('pointerdown', unlock);
        window.addEventListener('keydown', unlock);
    }

    get isMuted(): boolean {
        return this.muted;
    }

    play(name: SoundName, intensity = 1): void {
        const context = this.ensureContext();

        if (!context || !this.master || this.muted) {
            return;
        }

        playSound(context, this.master, name, intensity);
    }

    setMusic(mood: MusicMood | null): void {
        this.mood = mood;
        const context = this.ensureContext();

        if (!context || !this.master) {
            return;
        }

        this.music ??= new Music(context, this.master);
        this.music.play(mood);
    }

    toggleMute(): void {
        this.muted = !this.muted;
        writeStorage(MUTED_KEY, this.muted ? '1' : '0');

        if (this.master && this.context) {
            this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.context.currentTime, 0.05);
        }

        this.listeners.forEach((listener) => listener(this.muted));
    }

    onMuteChange(listener: (muted: boolean) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private ensureContext(): AudioContext | null {
        if (this.context) {
            if (this.context.state === 'suspended') {
                void this.context.resume();
            }
            return this.context;
        }

        if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
            return null;
        }

        try {
            this.context = new AudioContext();
        } catch {
            return null;
        }

        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        this.master.connect(this.context.destination);

        if (this.mood) {
            this.music = new Music(this.context, this.master);
            this.music.play(this.mood);
        }

        return this.context;
    }
}

export const audio = new AudioManager();
