import './ui/styles.css';
import { Game } from './core/Game';
import { GameManager } from './core/GameManager';
import { mountMuteButton } from './ui/MuteButton';

const container = document.getElementById('app');
const uiRoot = document.getElementById('ui');

if (!container || !uiRoot) {
    throw new Error('Missing #app or #ui root element.');
}

const game = new Game(container, uiRoot);
const manager = new GameManager(game);
mountMuteButton(uiRoot);

void manager.start();
game.start();
