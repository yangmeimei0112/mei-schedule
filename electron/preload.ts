import { contextBridge, ipcRenderer } from 'electron';

const desktopBridge = {
  isElectron: true,
  platform: process.platform,
  sendNativeNotification: (payload: { title: string; body: string; eventId?: string }) =>
    ipcRenderer.invoke('mei:notify', payload) as Promise<boolean>,
  toggleTrayWindow: () => ipcRenderer.invoke('mei:toggle-tray') as Promise<void>,
  getPlatformInfo: () =>
    ipcRenderer.invoke('mei:platform-info') as Promise<{
      platform: string;
      version: string;
      isPackaged: boolean;
    }>,
  onQuickCaptureTriggered: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('mei:quick-capture', handler);
    return () => {
      ipcRenderer.removeListener('mei:quick-capture', handler);
    };
  }
};

contextBridge.exposeInMainWorld('MeiDesktop', desktopBridge);
