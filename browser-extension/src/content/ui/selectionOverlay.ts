/**
 * Selection Overlay Logic - Enhanced with resize handles and confirm/cancel
 */
import { captureArea } from '../capture/screenshot';

// Internationalization helper
const isChineseLocale = () => {
    const lang = navigator.language || (navigator as any).userLanguage || 'en';
    return lang.startsWith('zh');
};

const i18n = {
    get dragToSelect() { return isChineseLocale() ? '拖动选择区域 · 按 ESC 取消' : 'Drag to select area · Press ESC to cancel'; },
    get adjustSize() { return isChineseLocale() ? '拖动边角调整大小 · Enter 确认 · Esc 取消' : 'Drag corners to resize · Enter to confirm · Esc to cancel'; },
    get save() { return isChineseLocale() ? '保存' : 'Save'; },
    get cancel() { return isChineseLocale() ? '取消' : 'Cancel'; },
};

let selectionOverlay: HTMLDivElement | null = null;
let selectionBox: HTMLDivElement | null = null;
let toolbarEl: HTMLDivElement | null = null;
let isSelecting = false;
let isResizing = false;
let resizeHandle = '';
let startX = 0, startY = 0;
let boxStartX = 0, boxStartY = 0, boxStartW = 0, boxStartH = 0;

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
        z-index: 2147483646;
        cursor: crosshair;
    `;

    // Create selection box
    selectionBox = document.createElement('div');
    selectionBox.id = 'omniclipper-selection-box';
    selectionBox.style.cssText = `
        position: fixed;
        border: 2px solid #007AFF;
        background: rgba(0, 122, 255, 0.08);
        display: none;
        z-index: 2147483647;
        box-sizing: border-box;
        box-shadow: 0 0 0 1px rgba(0, 122, 255, 0.3);
    `;

    // Create resize handles
    const handles = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
    handles.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = 'omniclipper-resize-handle';
        handle.dataset.handle = pos;

        let cursor = 'default';
        let top = '0', left = '0', right = 'auto', bottom = 'auto';
        let transform = '';

        switch(pos) {
            case 'nw': cursor = 'nw-resize'; top = '0'; left = '0'; transform = 'translate(-50%, -50%)'; break;
            case 'n': cursor = 'n-resize'; top = '0'; left = '50%'; transform = 'translate(-50%, -50%)'; break;
            case 'ne': cursor = 'ne-resize'; top = '0'; right = '0'; left = 'auto'; transform = 'translate(50%, -50%)'; break;
            case 'w': cursor = 'w-resize'; top = '50%'; left = '0'; transform = 'translate(-50%, -50%)'; break;
            case 'e': cursor = 'e-resize'; top = '50%'; right = '0'; left = 'auto'; transform = 'translate(50%, -50%)'; break;
            case 'sw': cursor = 'sw-resize'; bottom = '0'; top = 'auto'; left = '0'; transform = 'translate(-50%, 50%)'; break;
            case 's': cursor = 's-resize'; bottom = '0'; top = 'auto'; left = '50%'; transform = 'translate(-50%, 50%)'; break;
            case 'se': cursor = 'se-resize'; bottom = '0'; top = 'auto'; right = '0'; left = 'auto'; transform = 'translate(50%, 50%)'; break;
        }

        handle.style.cssText = `
            position: absolute;
            width: 8px;
            height: 8px;
            background: #007AFF;
            border: 1.5px solid white;
            border-radius: 50%;
            cursor: ${cursor};
            top: ${top};
            left: ${left};
            right: ${right};
            bottom: ${bottom};
            transform: ${transform};
            z-index: 2147483649;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
            transition: transform 0.1s ease;
        `;

        handle.addEventListener('mousedown', startResize);
        selectionBox.appendChild(handle);
    });

    // Create instruction text
    const instruction = document.createElement('div');
    instruction.id = 'omniclipper-instruction';
    instruction.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(30, 30, 30, 0.9);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        color: rgba(255, 255, 255, 0.95);
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 500;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
        letter-spacing: -0.01em;
        z-index: 2147483650;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), inset 0 0 0 0.5px rgba(255, 255, 255, 0.1);
    `;
    instruction.textContent = i18n.dragToSelect;
    selectionOverlay.appendChild(instruction);

    document.body.appendChild(selectionOverlay);
    document.body.appendChild(selectionBox);

    // Event handlers
    selectionOverlay.addEventListener('mousedown', startSelection);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeydown);
}

function startSelection(e: MouseEvent) {
    // Don't start new selection if clicking on handles or toolbar
    if ((e.target as HTMLElement).closest('.omniclipper-resize-handle') ||
        (e.target as HTMLElement).closest('#omniclipper-toolbar')) {
        return;
    }

    if (!selectionBox) return;

    // Remove existing toolbar
    if (toolbarEl) {
        toolbarEl.remove();
        toolbarEl = null;
    }

    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.display = 'block';
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';

    // Hide resize handles while drawing
    selectionBox.querySelectorAll('.omniclipper-resize-handle').forEach(h => {
        (h as HTMLElement).style.display = 'none';
    });
}

function startResize(e: MouseEvent) {
    e.stopPropagation();
    isResizing = true;
    resizeHandle = (e.target as HTMLElement).dataset.handle || '';
    startX = e.clientX;
    startY = e.clientY;

    if (selectionBox) {
        boxStartX = parseInt(selectionBox.style.left);
        boxStartY = parseInt(selectionBox.style.top);
        boxStartW = parseInt(selectionBox.style.width);
        boxStartH = parseInt(selectionBox.style.height);
    }
}

function handleMouseMove(e: MouseEvent) {
    if (isSelecting && selectionBox) {
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
    } else if (isResizing && selectionBox) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newX = boxStartX;
        let newY = boxStartY;
        let newW = boxStartW;
        let newH = boxStartH;

        // Handle resize based on which handle is being dragged
        if (resizeHandle.includes('e')) {
            newW = Math.max(20, boxStartW + dx);
        }
        if (resizeHandle.includes('w')) {
            newW = Math.max(20, boxStartW - dx);
            newX = boxStartX + (boxStartW - newW);
        }
        if (resizeHandle.includes('s')) {
            newH = Math.max(20, boxStartH + dy);
        }
        if (resizeHandle.includes('n')) {
            newH = Math.max(20, boxStartH - dy);
            newY = boxStartY + (boxStartH - newH);
        }

        selectionBox.style.left = newX + 'px';
        selectionBox.style.top = newY + 'px';
        selectionBox.style.width = newW + 'px';
        selectionBox.style.height = newH + 'px';

        updateToolbarPosition();
    }
}

function handleMouseUp(e: MouseEvent) {
    if (isSelecting && selectionBox) {
        isSelecting = false;

        const width = parseInt(selectionBox.style.width);
        const height = parseInt(selectionBox.style.height);

        if (width > 10 && height > 10) {
            // Show resize handles
            selectionBox.querySelectorAll('.omniclipper-resize-handle').forEach(h => {
                (h as HTMLElement).style.display = 'block';
            });

            // Show toolbar with confirm/cancel buttons
            showToolbar();

            // Update instruction
            const instruction = document.getElementById('omniclipper-instruction');
            if (instruction) {
                instruction.textContent = i18n.adjustSize;
            }
        }
    }

    if (isResizing) {
        isResizing = false;
    }
}

function showToolbar() {
    if (!selectionBox || toolbarEl) return;

    toolbarEl = document.createElement('div');
    toolbarEl.id = 'omniclipper-toolbar';
    toolbarEl.style.cssText = `
        position: fixed;
        display: flex;
        gap: 8px;
        padding: 6px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 8px;
        box-shadow: 0 2px 20px rgba(0, 0, 0, 0.15), 0 0 0 0.5px rgba(0, 0, 0, 0.05);
        z-index: 2147483651;
    `;

    // Save button
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = i18n.save;
    confirmBtn.title = 'Enter';
    confirmBtn.style.cssText = `
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        background: #007AFF;
        color: white;
        font-size: 13px;
        font-weight: 500;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
        cursor: pointer;
        transition: all 0.15s ease;
    `;
    confirmBtn.onmouseover = () => {
        confirmBtn.style.background = '#0066DD';
    };
    confirmBtn.onmouseout = () => {
        confirmBtn.style.background = '#007AFF';
    };
    confirmBtn.onmousedown = () => confirmBtn.style.transform = 'scale(0.95)';
    confirmBtn.onmouseup = () => confirmBtn.style.transform = 'scale(1)';
    confirmBtn.onclick = confirmCapture;

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = i18n.cancel;
    cancelBtn.title = 'Esc';
    cancelBtn.style.cssText = `
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.06);
        color: #333;
        font-size: 13px;
        font-weight: 500;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
        cursor: pointer;
        transition: all 0.15s ease;
    `;
    cancelBtn.onmouseover = () => {
        cancelBtn.style.background = 'rgba(0, 0, 0, 0.1)';
    };
    cancelBtn.onmouseout = () => {
        cancelBtn.style.background = 'rgba(0, 0, 0, 0.06)';
    };
    cancelBtn.onmousedown = () => cancelBtn.style.transform = 'scale(0.95)';
    cancelBtn.onmouseup = () => cancelBtn.style.transform = 'scale(1)';
    cancelBtn.onclick = cleanupSelection;

    toolbarEl.appendChild(confirmBtn);
    toolbarEl.appendChild(cancelBtn);
    document.body.appendChild(toolbarEl);

    updateToolbarPosition();
}

function updateToolbarPosition() {
    if (!toolbarEl || !selectionBox) return;

    const boxRect = selectionBox.getBoundingClientRect();
    const toolbarRect = toolbarEl.getBoundingClientRect();

    // Position toolbar below the selection box
    let top = boxRect.bottom + 10;
    let left = boxRect.left + (boxRect.width - toolbarRect.width) / 2;

    // If toolbar would go off bottom of screen, position above
    if (top + toolbarRect.height > window.innerHeight) {
        top = boxRect.top - toolbarRect.height - 10;
    }

    // Keep within horizontal bounds
    left = Math.max(10, Math.min(left, window.innerWidth - toolbarRect.width - 10));

    toolbarEl.style.top = top + 'px';
    toolbarEl.style.left = left + 'px';
}

function confirmCapture() {
    if (!selectionBox) return;

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
    } else if (e.key === 'Enter') {
        confirmCapture();
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
    if (toolbarEl) {
        toolbarEl.remove();
        toolbarEl = null;
    }
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('keydown', handleKeydown);
    isSelecting = false;
    isResizing = false;
}
