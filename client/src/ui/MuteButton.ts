import { audio } from '../audio/AudioManager';
import { el } from './dom';

/** Small always-visible sound toggle in the top-right corner. */
export function mountMuteButton(parent: HTMLElement): void {
    const button = el('button', { className: 'mute-button', onClick: () => audio.toggleMute() });

    const render = (muted: boolean): void => {
        const waves = muted ? '<path d="M16 9l5 6M21 9l-5 6"/>' : '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>';
        button.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/>${waves}</svg>`;
        button.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
        button.setAttribute('aria-pressed', String(muted));
    };

    render(audio.isMuted);
    audio.onMuteChange(render);
    parent.append(button);
}
