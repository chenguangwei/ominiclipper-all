const { contextBridge } = require('electron');

console.log('!!! DEBUG PRELOAD - DIRECT SOURCE !!!');
console.log('!!! IF YOU SEE THIS, PRELOAD IS WORKING !!!');

try {
    contextBridge.exposeInMainWorld('electronAPI', {
        ping: () => 'pong',
        debug: true
    });
    console.log('!!! EXPOSE SUCCESS !!!');
} catch (e) {
    console.error('!!! EXPOSE FAILED !!!', e);
}
