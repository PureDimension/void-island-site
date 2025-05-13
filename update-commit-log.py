import os
import json
from datetime import datetime

# 定义文件路径
commit_log_file = "commit-log.txt"
commit_log_js_file = "commit-log.js"

# 对文件路径进行转义
def escape_file_paths(file_paths):
    escaped_paths = []
    for path in file_paths:
        escaped_path = bytes(path, 'utf-8').decode('unicode_escape')
        escaped_paths.append(escaped_path)
    return escaped_paths

# 获取文件的元数据，使用 YAML 或 Markdown 文件头解析
def get_metadata(file_path):
    try:
        with open(file_path, "r", encoding="utf-8", errors='ignore') as file:
            lines = file.readlines()

            # 查找 YAML front matter 格式的元数据
            if lines[0].startswith('---'):
                metadata = {}
                for line in lines[1:]:
                    if line.startswith('---'):
                        break
                    key, value = line.split(":", 1)
                    metadata[key.strip()] = value.strip()
                return metadata
            else:
                return None
    except Exception as e:
        print(f"[ERROR] Reading metadata from {file_path} failed: {e}")
        return None

# 清理并获取最新的 5 条记录
def clean_commit_log():
    try:
        with open(commit_log_file, "r", encoding="utf-8", errors='ignore') as file:
            lines = file.readlines()

        # 移除空行并过滤无效路径
        lines = [line.strip() for line in lines if line.strip()]

        # 对路径进行转义
        lines = escape_file_paths(lines)

        # 根据文件的修改时间排序
        logs_with_timestamp = []
        for line in lines:
            file_path = line.strip()
            if os.path.exists(file_path):
                timestamp = os.path.getmtime(file_path)
                logs_with_timestamp.append({
                    'file_path': file_path,
                    'timestamp': timestamp
                })

        # 按照时间戳降序排序，并保留最新的 5 条
        sorted_logs = sorted(logs_with_timestamp, key=lambda x: x['timestamp'], reverse=True)
        latest_logs = sorted_logs[:5]

        # 仅保留文件路径信息
        latest_file_paths = [log['file_path'] for log in latest_logs]

        # 更新 commit-log.txt 文件
        with open(commit_log_file, "w", encoding="utf-8") as file:
            file.write("\n".join(latest_file_paths))

        return latest_logs

    except Exception as e:
        print(f"[ERROR] Failed to clean commit log: {e}")
        return []

# 获取博客的元数据并生成 JavaScript 内容
def write_commit_log_js(blog_metadata):
    try:
        if not blog_metadata:
            print("[ERROR] No metadata to write.")
            return

        # 构建 JavaScript 代码
        logs = [{"title": entry["title"], "date": entry["date"], "slug": entry["slug"]} for entry in blog_metadata]
        js_content = f"export const logs = {json.dumps(logs, indent=2)};"

        # 写入 commit-log.js 文件
        with open(commit_log_js_file, "w", encoding="utf-8") as file:
            file.write(js_content)

        print("[INFO] commit-log.js has been updated successfully.")
    except Exception as e:
        print(f"[ERROR] Failed to write commit-log.js: {e}")

# 获取博客元数据
def get_blog_metadata(latest_logs):
    blog_metadata = []
    for log in latest_logs:
        file_path = log['file_path']
        metadata = get_metadata(file_path)
        if metadata:
            title = metadata.get("title", "No title")
            date = metadata.get("date", "Unknown date")
            slug = os.path.splitext(os.path.basename(file_path))[0]  # 取文件名作为 slug
            blog_metadata.append({
                "title": title,
                "date": date,
                "slug": slug
            })
    return blog_metadata

# 主函数
def update_commit_log():
    try:
        print("[INFO] Cleaning commit-log.txt and retrieving latest blog logs...")

        # 清理 commit-log.txt 并获取最新的 5 条记录
        latest_logs = clean_commit_log()

        if not latest_logs:
            print("[ERROR] No valid blog logs to process.")
            return

        # 获取这些日志对应的元数据
        blog_metadata = get_blog_metadata(latest_logs)

        # 写入 commit-log.js
        write_commit_log_js(blog_metadata)

        print("[INFO] commit-log.js has been updated.")

        # 清空 commit-log.txt
        with open(commit_log_file, "w", encoding="utf-8") as file:
            file.truncate(0)

    except Exception as e:
        print(f"[ERROR] Failed to update commit log: {e}")

# 执行更新操作
if __name__ == "__main__":
    update_commit_log()
