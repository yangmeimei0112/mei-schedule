import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  Tray
} from 'electron';
import path from 'node:path';

let mainWindow: BrowserWindow | null = null;
let trayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function getAppUrl(hashRoute = ''): string {
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    return `${process.env.VITE_DEV_SERVER_URL}${hashRoute}`;
  }
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  return `file://${indexPath}${hashRoute}`;
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 360,
    minHeight: 520,
    title: '咩時光 MeiSchedule',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#F4F9FF',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  void win.loadURL(getAppUrl(''));

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

function createTrayWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 380,
    height: 540,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#F4F9FF',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  void win.loadURL(getAppUrl('#/tray'));

  win.on('blur', () => {
    if (win.isVisible()) {
      win.hide();
    }
  });

  win.on('closed', () => {
    trayWindow = null;
  });

  return win;
}

function toggleTrayPopover(): void {
  if (!trayWindow) {
    trayWindow = createTrayWindow();
  }
  if (trayWindow.isVisible()) {
    trayWindow.hide();
    return;
  }

  if (tray) {
    const trayBounds = tray.getBounds();
    const winBounds = trayWindow.getBounds();
    const x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
    const y =
      process.platform === 'darwin'
        ? Math.round(trayBounds.y + trayBounds.height + 4)
        : Math.max(12, Math.round(trayBounds.y - winBounds.height - 4));
    trayWindow.setPosition(Math.max(0, x), Math.max(0, y), false);
  }
  trayWindow.show();
  trayWindow.focus();
}

function setupTray(): void {
  const iconSvg =
    'data:image/svg+xml;base64,' +
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0284C7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>'
    ).toString('base64');

  const trayIcon = nativeImage.createFromDataURL(iconSvg);
  tray = new Tray(trayIcon);
  tray.setToolTip('咩時光 MeiSchedule — 點擊開啟今日迷你排程');

  tray.on('click', () => {
    toggleTrayPopover();
  });

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '開啟今日迷你行程',
      click: () => toggleTrayPopover()
    },
    {
      label: '開啟完整咩時光視窗',
      click: () => {
        if (!mainWindow) mainWindow = createMainWindow();
        mainWindow.show();
        mainWindow.focus();
      }
    },
    { type: 'separator' },
    {
      label: '結束咩時光',
      click: () => app.quit()
    }
  ]);

  tray.on('right-click', () => {
    tray?.popUpContextMenu(contextMenu);
  });
}

function setupIpcHandlers(): void {
  ipcMain.handle(
    'mei:notify',
    (_event, payload: { title: string; body: string; eventId?: string }) => {
      if (!Notification.isSupported()) return false;
      const notification = new Notification({
        title: String(payload?.title || '咩時光提醒'),
        body: String(payload?.body || '')
      });
      notification.show();
      return true;
    }
  );

  ipcMain.handle('mei:toggle-tray', () => {
    if (trayWindow?.isVisible()) {
      trayWindow.hide();
    }
    if (!mainWindow) {
      mainWindow = createMainWindow();
    }
    mainWindow.show();
    mainWindow.focus();
  });

  ipcMain.handle('mei:platform-info', () => ({
    platform: process.platform,
    version: app.getVersion(),
    isPackaged: app.isPackaged
  }));
}

app.whenReady().then(() => {
  setupIpcHandlers();
  mainWindow = createMainWindow();
  trayWindow = createTrayWindow();
  setupTray();

  // Global Quick-Capture Shortcut (Cmd/Ctrl + Shift + Space)
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (!mainWindow) {
      mainWindow = createMainWindow();
    }
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('mei:quick-capture');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
