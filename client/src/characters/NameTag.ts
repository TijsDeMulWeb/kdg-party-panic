import * as THREE from 'three';
import { palette } from '../design/palette';

/**
 * Floating name label above a character, drawn once to a canvas texture.
 * Always faces the camera and ignores depth so it stays readable.
 */
export function createNameTag(text: string, color: number, isLocal = false, size = 1): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const scale = 2;
    canvas.width = 256 * scale;
    canvas.height = 72 * scale;

    if (context) {
        context.scale(scale, scale);
        context.font = '28px "Lilita One", system-ui, sans-serif';
        const width = Math.min(240, context.measureText(text).width + 36);
        const x = (256 - width) / 2;

        context.fillStyle = `#${palette.ink.toString(16).padStart(6, '0')}`;
        roundedRect(context, x, 8, width, 44, 22);
        context.fill();
        context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        roundedRect(context, x + 4, 12, width - 8, 36, 18);
        context.fill();

        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.lineWidth = 6;
        context.strokeStyle = `#${palette.ink.toString(16).padStart(6, '0')}`;
        context.strokeText(text, 128, 31, 220);
        context.fillText(text, 128, 31, 220);

        if (isLocal) {
            context.fillStyle = `#${palette.ink.toString(16).padStart(6, '0')}`;
            context.beginPath();
            context.moveTo(116, 52);
            context.lineTo(140, 52);
            context.lineTo(128, 66);
            context.fill();
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.4 * size, 0.675 * size, 1);
    sprite.position.y = 1.8 + 0.35 * size;
    sprite.renderOrder = 10;

    return sprite;
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
}
