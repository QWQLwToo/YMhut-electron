const { app, BrowserWindow, Menu, shell, ipcMain, session, dialog, autoUpdater } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const checkFilesExist = require('./assets/check/integrityChecker');
const fileManifest = require('./assets/check/fileManifest');
const packageJson = require('./package.json'); // 引入 package.json 来获取应用版本

// 配置自动更新服务器地址
const UPDATE_SERVER_URL = 'https://';

let mainWindow;
let splashWindow;
let setupWindow; // 声明 setupWindow 以便在 ipcMain 中访问
let windows = [];
let downloads = [];

function createWindow(url = 'https://') {
    let newWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'assets/js/preload.js')
        },
    });
    newWindow.loadURL(url);
    newWindow.on('closed', () => {
        const index = windows.indexOf(newWindow);
        if (index > -1) {
            windows.splice(index, 1);
        }
    });
    windows.push(newWindow);
    return newWindow;
}

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 400,
        height: 300,
        frame: false,
        transparent: true,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, 'assets/js/preload.js')
        }
    });
    splashWindow.loadFile(path.join(__dirname, 'page/splash.html'));
    splashWindow.center();
    setTimeout(() => {
        splashWindow.close();
        handleFirstRun();
    }, 2000);
}

function createMainWindow() {
    mainWindow = createWindow();
    // 添加主窗口关闭时的逻辑，不影响其他窗口
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createMenuTemplate() {
    return [
        {
            label: '操作',
            submenu: [
                { role: 'reload', label: '刷新' },
                { role: 'forcereload', label: '强制刷新' },
                { role: 'undo', label: '撤销' },
                { role: 'redo', label: '重做' },
                { type: 'separator' },
                { role: 'cut', label: '剪切' },
                { role: 'copy', label: '复制' },
                { role: 'paste', label: '粘贴' },
            ],
        },
        {
            label: '工具',
            submenu: [
                {
                    label: '打开下载文件夹',
                    click: async () => {
                        shell.openPath(app.getPath('downloads'));
                    },
                },
                { role: 'toggledevtools', label: '切换开发者工具' },
            ],
        },
        {
            label: '窗口',
            role: 'window',
            submenu: [
                { type: 'separator' },
                { role: 'resetzoom', label: '恢复缩放' },
                { role: 'zoomin', label: '放大' },
                { role: 'zoomout', label: '缩小' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: '切换全屏' },
                { role: 'minimize', label: '最小化' },
                { role: 'close', label: '关闭' },
                { type: 'separator' },
                {
                    label: '退出应用',
                    click: () => {
                        quitApplication();
                    }
                }
            ],
        },
        {
            label: '帮助',
            role: 'help',
            submenu: [
                {
                    label: '检查更新...',
                    click: async () => {
                        checkForUpdates(true);
                    },
                },
                {
                    label: '更新日志',
                    click: async () => {
                        showChangelog();
                    },
                },
                {
                    label: '关于本软件',
                    click: async () => {
                        const aboutWin = new BrowserWindow({
                            width: 400,
                            height: 420,
                            modal: false,
                            resizable: false,
                            minimizable: false,
                            maximizable: false,
                            title: '关于本软件',
                            webPreferences: {
                                contextIsolation: true,
                                preload: path.join(__dirname, 'assets/js/preload.js')
                            },
                            autoHideMenuBar: true,
                        });
                        aboutWin.loadFile(path.join(__dirname, 'page/about.html'));
                    },
                },
            ],
        },
    ];
}

function showChangelog() {
    const changelogWindow = new BrowserWindow({
        width: 500,
        height: 400,
        title: "更新日志",
        resizable: false,
        minimizable: true,
        maximizable: false,
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, 'assets/js/changelog-preload.js'),
        }
    });
    changelogWindow.loadFile(path.join(__dirname, 'page/changelog.html'));
}

function handleDownload(item) {
    const downloadInfo = {
        filename: item.getFilename(),
        status: '下载中',
        path: item.getSavePath(),
        item: item
    };
    downloads.push(downloadInfo);
    mainWindow.webContents.send('update-downloads', downloads);
    item.on('done', (e, state) => {
        if (state === 'completed') {
            downloadInfo.status = '已完成';
        } else {
            downloadInfo.status = '已取消';
        }
        mainWindow.webContents.send('update-downloads', downloads);
    });
}

function isAppFirstRun() {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'config.ini');
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, 'firstRun=false\nversion=1.0.0');
        return true;
    }
    return false;
}

function handleFirstRun() {
    if (isAppFirstRun()) {
        setupWindow = new BrowserWindow({
            width: 500,
            height: 500,
            title: '欢迎使用',
            // 移除模态属性，使其独立
            modal: false,
            resizable: false,
            minimizable: false,
            maximizable: false,
            autoHideMenuBar: true,
            alwaysOnTop: true,
            webPreferences: {
                contextIsolation: true,
                preload: path.join(__dirname, 'assets/js/preload.js')
            }
        });
        setupWindow.loadFile(path.join(__dirname, 'page/setup.html'));
        setupWindow.webContents.on('did-finish-load', () => {
            setupWindow.webContents.send('init-setup-page');
        });
        setupWindow.on('closed', () => {
            setupWindow = null;
            createMainWindow();
        });
    } else {
        createMainWindow();
    }
}

// 配置自动更新
function setupAutoUpdater() {
    // 设置更新服务器URL
    const feedURL = `${UPDATE_SERVER_URL}/update/${process.platform}/${app.getVersion()}`;
    autoUpdater.setFeedURL({ url: feedURL });
    
    // 监听更新事件
    autoUpdater.on('checking-for-update', () => {
        console.log('正在检查更新...');
    });
    
    autoUpdater.on('update-available', (info) => {
        console.log('发现更新', info);
        dialog.showMessageBox({
            type: 'info',
            title: '发现新版本',
            message: `发现新版本 ${info.version}，是否立即下载更新？`,
            buttons: ['下载更新', '稍后再说']
        }).then(result => {
            if (result.response === 0) {
                // 用户选择下载更新
                mainWindow.webContents.send('update-download-started');
            }
        });
    });
    
    autoUpdater.on('update-not-available', (info) => {
        console.log('已是最新版本', info);
    });
    
    autoUpdater.on('error', (err) => {
        console.error('更新过程中发生错误:', err);
        dialog.showErrorBox('更新错误', `更新过程中发生错误: ${err.message}`);
    });
    
    autoUpdater.on('download-progress', (progressObj) => {
        console.log(`下载进度: ${progressObj.percent}%`);
        mainWindow.webContents.send('update-download-progress', progressObj);
    });
    
    autoUpdater.on('update-downloaded', (info) => {
        console.log('更新下载完成', info);
        dialog.showMessageBox({
            type: 'info',
            title: '更新下载完成',
            message: '更新已下载完成，应用将在重启后更新到最新版本。是否立即重启应用？',
            buttons: ['立即重启', '稍后重启']
        }).then(result => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });
}

app.whenReady().then(() => {
    verifyApplicationIntegrity(); // 添加完整性检查
    const customCachePath = path.join(app.getPath('userData'), 'customCache');
    app.setPath('cache', customCachePath);
    session.defaultSession.on('will-download', (event, item, webContents) => {
        handleDownload(item);
    });
    
    // 配置自动更新
    setupAutoUpdater();
    
    createSplashWindow();
    const menu = Menu.buildFromTemplate(createMenuTemplate());
    Menu.setApplicationMenu(menu);

    // 启动时检查更新
    checkForUpdates(false);
});

// 改进的更新检查函数
async function checkForUpdates(userInitiated = false) {
    try {
        // 先通过API获取更新信息
        const response = await axios.get('https://update-info.json');
        const latestVersion = response.data.version;
        const currentVersion = app.getVersion();
        
        // 比较版本号
        if (compareVersions(latestVersion, currentVersion) > 0) {
            console.log(`发现新版本 ${latestVersion}，当前版本 ${currentVersion}`);
            
            if (userInitiated) {
                // 用户手动触发更新检查，显示更新信息对话框
                dialog.showMessageBox({
                    type: 'info',
                    title: '发现新版本',
                    message: `发现新版本 ${latestVersion}。
您当前使用的版本为 ${currentVersion}。
${response.data.notes}`,
                    buttons: ['现在更新', '稍后再说']
                }).then(result => {
                    if (result.response === 0) {
                        // 开始下载更新
                        autoUpdater.checkForUpdates();
                    }
                });
            } else {
                // 自动检查更新，让autoUpdater处理后续流程
                autoUpdater.checkForUpdates();
            }
        } else {
            if (userInitiated) {
                // 用户手动检查，告知已是最新版本
                dialog.showMessageBox({
                    type: 'info',
                    title: '已是最新版本',
                    message: `当前已是最新版本(v${currentVersion})
服务器上的版本为(v${latestVersion})`,
                    buttons: ['确定']
                });
            } else {
                console.log('已是最新版本');
            }
        }
    } catch (error) {
        console.error('检查更新失败:', error.message);
        if (userInitiated) {
            dialog.showErrorBox(
                '更新检查失败',
                '无法连接到更新服务器，请检查网络或稍后再试。'
            );
        }
    }
}

function compareVersions(v1, v2) {
    const s1 = v1.split('.');
    const s2 = v2.split('.');
    for (let i = 0; i < Math.max(s1.length, s2.length); i++) {
        let n1 = parseInt(s1[i] || "0", 10);
        let n2 = parseInt(s2[i] || "0", 10);
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
}

ipcMain.handle('load-changelog', async () => {
    const logFilePath = path.join(__dirname, 'assets', 'version.log');
    try {
        const data = await fs.promises.readFile(logFilePath, 'utf-8');
        return data;
    } catch (error) {
        throw new Error(`读取 version.log 失败: ${error.message}`);
    }
});

// 修改窗口关闭事件处理，完全移除强制退出逻辑
app.on('window-all-closed', () => {
    // 不再退出应用，让所有窗口独立存在
    // 如果你需要在所有窗口关闭后执行某些操作，可以在这里添加
});

// 添加手动退出应用的函数
function quitApplication() {
    // 关闭所有窗口
    BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
            window.close();
        }
    });
    // 退出应用
    app.quit();
}

// 修改激活事件处理
app.on('activate', () => {
    // 只有当没有窗口打开时才创建新窗口
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

// 新增：应用程序完整性校验函数
function verifyApplicationIntegrity() {
    const missingFiles = checkFilesExist(fileManifest);
    if (missingFiles.length > 0) {
        const message = `检测到以下关键文件缺失，请重新下载安装以保证软件正常运行：
${missingFiles.join('\n')}`;
        console.error(message);
        // 弹窗提示用户并提供跳转到更新页面的选项
        dialog.showMessageBox({
            type: 'error',
            title: '文件缺失',
            message: '检测到关键文件缺失，请重新下载安装以保证软件正常运行。',
            detail: missingFiles.join('\n'),
            buttons: ['退出', '前往下载']
        }).then(({ response }) => {
            if (response === 1) {
                shell.openExternal('https:// Setup 1.0.4.exe'); // 备用下载链接
            }
            app.quit(); // 无论用户选择哪个按钮，都退出应用
        });
        return false;
    }
    console.log('✅ 所有关键文件完整');
    return true;
}    