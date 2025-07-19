const { ipcRenderer } = require('electron');

let countdown = 3;
const closeBtn = document.getElementById('closeBtn');

function updateButtonText() {
    closeBtn.textContent = `我知道了 (${countdown})`;
}

function startCountdown() {
    const intervalId = setInterval(() => {
        countdown--;
        updateButtonText();
        if (countdown <= 0) {
            clearInterval(intervalId);
            closeSetupWindow();
        }
    }, 1000);
}

function closeSetupWindow() {
    ipcRenderer.send('close-setup-window');
}

document.addEventListener('DOMContentLoaded', () => {
    startCountdown();

    closeBtn.addEventListener('click', () => {
        closeSetupWindow();
    });
});