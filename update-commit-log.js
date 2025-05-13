// 引入必要的模块
import fs from "fs";
import path from "path";
import matter from "gray-matter";

// 定义文件路径
const commitLogFile = path.join(process.cwd(), "commit-log.txt");
const commitLogJSFile = path.join(process.cwd(), "commit-log.js");

// 1. 清理 commit-log.txt，保留时间戳最新的版本，并只保留 5 条
const cleanCommitLog = () => {
  const rawLog = fs.readFileSync(commitLogFile, "utf-8");
  const lines = rawLog.split("\n").filter(Boolean); // 清除空行

  // 提取文件路径和时间戳
  const logWithTimestamps = lines.map((line) => {
    const filePath = line.trim();
    const fileName = path.basename(filePath); // 获取文件名作为唯一标识
    const fullFilePath = path.join(process.cwd(), filePath); // 获取文件的绝对路径

    // 打印路径调试信息
    console.log("[DEBUG] Checking file path:", fullFilePath);

    // 检查文件是否存在
    if (!fs.existsSync(fullFilePath)) {
      console.error(`[ERROR] File not found: ${fullFilePath}`);
      return null; // 返回 null 表示路径无效
    }

    const stats = fs.statSync(fullFilePath); // 获取文件状态信息
    const timestamp = stats.mtimeMs; // 获取文件修改时间戳
    return { filePath, timestamp, fileName };
  }).filter(Boolean); // 过滤掉路径无效的条目

  // 根据时间戳降序排列
  logWithTimestamps.sort((a, b) => b.timestamp - a.timestamp);

  // 取前 5 条记录
  const latestLogs = logWithTimestamps.slice(0, 5);

  // 清空 commit-log.txt 并保存最新的记录
  const updatedLog = latestLogs.map((log) => log.filePath).join("\n");
  fs.writeFileSync(commitLogFile, updatedLog);
  return latestLogs;
};

// 2. 读取这些 md 文件并获取其元信息
const getBlogMetadata = (logs) => {
  const blogMetadata = [];

  logs.forEach((log) => {
    const filePath = path.join(process.cwd(), log.filePath);
    const fileContent = fs.readFileSync(filePath, "utf-8");

    // 使用 gray-matter 解析 md 文件的元数据
    const { data } = matter(fileContent);
    const metadata = {
      title: data.title || "无标题",
      date: data.date || "未知日期",
      slug: log.fileName.replace(".md", ""), // 文件名作为 slug
    };

    blogMetadata.push(metadata);
  });

  return blogMetadata;
};

// 3. 将获取的元信息写入 commit-log.js
const writeCommitLogJS = (blogMetadata) => {
  const logContent = `export const logs = ${JSON.stringify(blogMetadata, null, 2)};`;
  fs.writeFileSync(commitLogJSFile, logContent);
};

// 主函数执行流程
const updateCommitLog = () => {
  try {
    console.log("[DEBUG] 清理并更新 commit-log.txt");

    // 清理并保留最新 5 条日志
    const latestLogs = cleanCommitLog();

    // 获取这 5 条日志对应的博客元数据
    const blogMetadata = getBlogMetadata(latestLogs);

    // 将元数据写入 commit-log.js
    writeCommitLogJS(blogMetadata);

    console.log("[DEBUG] commit-log.js 已更新成功");
  } catch (error) {
    console.error("[ERROR] 更新 commit-log 失败", error);
  }
};

// 执行主函数
updateCommitLog();
