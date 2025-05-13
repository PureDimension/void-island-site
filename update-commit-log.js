// update-commit-log.js
const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'commit-log.txt');
const outputPath = path.join(__dirname, 'commit-log.js');

// 读取全部 commit-log.txt
let lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);

// 去重 + 截取最后 5 行
const unique = [...new Set(lines)].slice(-5);

// 生成 JS 模块，导出路径数组
const content = `export const recentBlogs = ${JSON.stringify(unique, null, 2)};`;

fs.writeFileSync(logPath, unique.join('\n'));
fs.writeFileSync(outputPath, content);

console.log('[DEBUG] commit-log.js updated with recent entries');
