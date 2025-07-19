// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// 注入全局字体样式（ttf.css）
function injectGlobalFontCSS() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './assets/css/ttf.css'; // 相对路径，相对于 index.html 的位置
    document.head.appendChild(link);
}

// 注入其他全局样式（style.css）
function injectGlobalStyleCSS() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './assets/css/style.css';  // 根据实际路径调整
    document.head.appendChild(link);
}

// 注入 NProgress 并启动
function injectNProgress() {
    // 注入 NProgress CSS
    const nprogressCSS = document.createElement('link');
    nprogressCSS.rel = 'stylesheet';
    nprogressCSS.href = './node_modules/nprogress/nprogress.css';  // 相对路径
    document.head.appendChild(nprogressCSS);

    // 注入 NProgress JS
    const nprogressJS = document.createElement('script');
    nprogressJS.src = './node_modules/nprogress/nprogress.js';  // 相对路径
    nprogressJS.onload = () => {
        window.NProgress.configure({ showSpinner: false });
        window.NProgress.start();

        window.addEventListener('load', () => {
            window.NProgress.done();
        });
    };
    document.body.appendChild(nprogressJS);
}

// 在页面加载前执行注入
window.addEventListener('DOMContentLoaded', () => {
    injectGlobalFontCSS(); // 注入 ttf.css
    injectGlobalStyleCSS(); // 注入 style.css
    injectNProgress();      // 注入 NProgress
});

// 向渲染进程暴露 electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
    closeSetupWindow: () => ipcRenderer.send('close-setup-window'), // 新增的 API
});