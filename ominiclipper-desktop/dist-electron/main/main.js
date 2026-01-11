import { app, BrowserWindow, shell, Menu } from "electron";
import path from "path";
import { fileURLToPath } from "url";
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
const isDev = process.env.NODE_ENV === "development";
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "OmniClipper",
    icon: path.join(__dirname$1, "../public/icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname$1, "../dist-electron/preload/index.cjs")
    },
    backgroundColor: "#1e1e1e",
    titleBarStyle: "hiddenInset",
    show: false
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../dist/index.html"));
  }
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("http://localhost:3000")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "New Resource",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow == null ? void 0 : mainWindow.webContents.executeJavaScript('window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true }))');
          }
        },
        {
          label: "Import/Export",
          accelerator: "CmdOrCtrl+E",
          click: () => {
            mainWindow == null ? void 0 : mainWindow.webContents.executeJavaScript('window.dispatchEvent(new KeyboardEvent("keydown", { key: "e", metaKey: true }))');
          }
        },
        { type: "separator" },
        {
          label: "Close",
          accelerator: "CmdOrCtrl+W",
          role: "close"
        }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", role: "undo" },
        { label: "Redo", accelerator: "CmdOrCtrl+Shift+Z", role: "redo" },
        { type: "separator" },
        { label: "Cut", accelerator: "CmdOrCtrl+X", role: "cut" },
        { label: "Copy", accelerator: "CmdOrCtrl+C", role: "copy" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", role: "paste" },
        { label: "Select All", accelerator: "CmdOrCtrl+A", role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Table View",
          accelerator: "CmdOrCtrl+1",
          click: () => {
            mainWindow == null ? void 0 : mainWindow.webContents.executeJavaScript(`document.querySelectorAll("button[title*='Table View']")[0]?.click()`);
          }
        },
        {
          label: "Split View",
          accelerator: "CmdOrCtrl+2",
          click: () => {
            mainWindow == null ? void 0 : mainWindow.webContents.executeJavaScript(`document.querySelectorAll("button[title*='Split View']")[0]?.click()`);
          }
        },
        {
          label: "Grid View",
          accelerator: "CmdOrCtrl+3",
          click: () => {
            mainWindow == null ? void 0 : mainWindow.webContents.executeJavaScript(`document.querySelectorAll("button[title*='Grid View']")[0]?.click()`);
          }
        },
        { type: "separator" },
        { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => mainWindow == null ? void 0 : mainWindow.reload() },
        { label: "Force Reload", accelerator: "CmdOrCtrl+Shift+R", click: () => mainWindow == null ? void 0 : mainWindow.reload() },
        { type: "separator" },
        { label: "Toggle DevTools", accelerator: "CmdOrCtrl+Option+I", click: () => mainWindow == null ? void 0 : mainWindow.webContents.toggleDevTools() }
      ]
    },
    {
      label: "Window",
      submenu: [
        { label: "Minimize", accelerator: "CmdOrCtrl+M", role: "minimize" },
        { label: "Zoom", role: "zoom" },
        { type: "separator" },
        { label: "Bring All to Front", role: "front" }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Documentation",
          click: () => {
            shell.openExternal("https://github.com/omniclipper/omniclipper-all");
          }
        },
        {
          label: "Report Issue",
          click: () => {
            shell.openExternal("https://github.com/omniclipper/omniclipper-all/issues");
          }
        }
      ]
    }
  ];
  if (process.platform === "darwin") {
    template.unshift({
      label: app.getName(),
      submenu: [
        { label: "About OmniClipper", role: "about" },
        { type: "separator" },
        {
          label: "Settings",
          accelerator: "CmdOrCtrl+,",
          click: () => {
            mainWindow == null ? void 0 : mainWindow.webContents.executeJavaScript(`document.querySelector("button[title*='Settings']")?.click()`);
          }
        },
        { type: "separator" },
        { label: "Services", role: "services" },
        { type: "separator" },
        { label: "Hide OmniClipper", accelerator: "Command+H", role: "hide" },
        { label: "Hide Others", accelerator: "Command+Option+H", role: "hideOthers" },
        { label: "Show All", role: "unhide" },
        { type: "separator" },
        { label: "Quit", accelerator: "Command+Q", role: "quit" }
      ]
    });
  }
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
app.whenReady().then(() => {
  createWindow();
  createMenu();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("before-quit", () => {
});
