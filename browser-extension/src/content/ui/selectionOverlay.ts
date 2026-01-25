/**
 * Selection Overlay Logic
 */
import { captureArea } from '../capture/screenshot';

let selectionOverlay: HTMLDivElement | null = null;
let selectionBox: HTMLDivElement | null = null;
let isSelecting = false;
let startX = 0, startY = 0;

/**
 * Create screenshot selection overlay
 */
export function createSelectionOverlay() {
    if (selectionOverlay) return; // Already active

    // Create overlay
    selectionOverlay = document.createElement('div');
    selectionOverlay.id = 'omniclipper-selection-overlay';
    selectionOverlay.style.cssText = `
     position: fixed;
     top: 0;
     left: 0;
     width: 100%;
     height: 100%;
     background: rgba(0, 0, 0, 0.3);
     z-index: 2147483647;
     cursor: crosshair;
   `;

    // Create selection box
    selectionBox = document.createElement('div');
    selectionBox.id = 'omniclipper-selection-box';
    selectionBox.style.cssText = `
     position: fixed;
     border: 2px dashed #667eea;
     background: rgba(102, 126, 234, 0.1);
     pointer-events: none;
     display: none;
     z-index: 2147483648;
   `;

    // Create instruction text
    const instruction = document.createElement('div');
    instruction.style.cssText = `
     position: fixed;
     top: 20px;
     left: 50%;
     transform: translateX(-50%);
     background: rgba(0, 0, 0, 0.8);
     color: white;
     padding: 12px 24px;
     border-radius: 8px;
     font-size: 14px;
     font-family: -apple-system, BlinkMacSystemFont, sans-serif;
     z-index: 2147483649;
   `;
    instruction.textContent = 'Drag to select area • Press ESC to cancel';
    selectionOverlay.appendChild(instruction);

    document.body.appendChild(selectionOverlay);
    document.body.appendChild(selectionBox);

    // Event handlers
    selectionOverlay.addEventListener('mousedown', startSelection);
    selectionOverlay.addEventListener('mousemove', updateSelection);
    selectionOverlay.addEventListener('mouseup', endSelection);
    document.addEventListener('keydown', handleKeydown);
}

function startSelection(e: MouseEvent) {
    if (!selectionBox) return;
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.display = 'block';
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
}

function updateSelection(e: MouseEvent) {
    if (!isSelecting || !selectionBox) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
}

function endSelection(e: MouseEvent) {
    if (!isSelecting || !selectionBox) return;
    isSelecting = false;

    const rect = {
        x: parseInt(selectionBox.style.left),
        y: parseInt(selectionBox.style.top),
        width: parseInt(selectionBox.style.width),
        height: parseInt(selectionBox.style.height)
    };

    cleanupSelection();

    if (rect.width > 10 && rect.height > 10) {
        captureArea(rect);
    }
}

function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
        cleanupSelection();
    }
}

function cleanupSelection() {
    if (selectionOverlay) {
        selectionOverlay.remove();
        selectionOverlay = null;
    }
    if (selectionBox) {
        selectionBox.remove();
        selectionBox = null;
    }
    document.removeEventListener('keydown', handleKeydown);
    isSelecting = false;
}
