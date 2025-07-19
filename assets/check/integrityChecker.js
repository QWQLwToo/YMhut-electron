const fs = require('fs');
const path = require('path');

function checkFilesExist(fileList) {
    const missingFiles = [];

    fileList.forEach(relativePath => {
        const fullPath = path.join(__dirname, '../..', relativePath); // 调整路径以适应新的目录结构
        if (!fs.existsSync(fullPath)) {
            missingFiles.push(relativePath);
        }
    });

    return missingFiles;
}

module.exports = checkFilesExist;