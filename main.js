const { app, BrowserWindow } = require("electron");
const path = require("path");

const allowedPlatforms = new Set(["win32", "darwin", "linux"]);
if (!allowedPlatforms.has(process.platform)) {
  app.quit();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 800,
    minHeight: 520,
    backgroundColor: "#040509",
    title: "VOID-09 // DESKTOP SYSTEM",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.removeMenu();
  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  if (!allowedPlatforms.has(process.platform)) {
    app.quit();
    return;
  }
  createWindow();

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