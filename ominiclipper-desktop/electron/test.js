// Simple test to check electron exports
console.log('Electron test');
console.log('typeof app:', typeof app);
console.log('typeof shell:', typeof shell);
console.log('Available keys:', Object.keys({app, shell, BrowserWindow, Menu}).join(', '));
