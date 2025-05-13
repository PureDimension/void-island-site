import os
import json
import codecs
from datetime import datetime

commit_log_file = "commit-log.txt"
commit_log_js_file = "commit-log.js"

# 对文件路径进行转义解码，同时保留原始路径
def decode_and_map_paths(raw_paths):
    decoded_map = []
    for raw in raw_paths:
        try:
            decoded_bytes = codecs.escape_decode(raw.encode())[0]
            decoded = decoded_bytes.decode('utf-8')
        except Exception as e:
            print(f"[ERROR] Failed to decode: {raw} - {e}")
            decoded = raw  # 如果失败，仍然用原始串
        decoded_map.append((raw, decoded))
    return decoded_map

# 获取文件的元数据，使用 YAML 或 Markdown 文件头解析
def get_metadata(file_path):
    try:
        with open(file_path, "r", encoding="utf-8", errors='ignore') as file:
            lines = file.readlines()

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

# 获取最新 5 个 commit，返回原始路径 + 解码路径
def clean_commit_log():
    try:
        with open(commit_log_file, "r", encoding="utf-8", errors='ignore') as file:
            raw_lines = [line.strip() for line in file if line.strip()]

        decoded_pairs = decode_and_map_paths(raw_lines)
        logs_with_time = []

        for raw, decoded in decoded_pairs:
            if os.path.exists(decoded):
                timestamp = os.path.getmtime(decoded)
                logs_with_time.append({
                    'raw': raw,
                    'decoded': decoded,
                    'timestamp': timestamp
                })

        sorted_logs = sorted(logs_with_time, key=lambda x: x['timestamp'], reverse=True)
        latest_logs = sorted_logs[:5]

        return latest_logs

    except Exception as e:
        print(f"[ERROR] Failed to clean commit log: {e}")
        return []

# 获取博客元数据
def get_blog_metadata(latest_logs):
    blog_metadata = []
    for log in latest_logs:
        decoded_path = log['decoded']
        metadata = get_metadata(decoded_path)
        if metadata:
            title = metadata.get("title", "No title")
            date = metadata.get("date", "Unknown date")
            slug = os.path.splitext(os.path.basename(decoded_path))[0]
            blog_metadata.append({
                "title": title,
                "date": date,
                "slug": slug
            })
    return blog_metadata

# 写入 commit-log.js
def write_commit_log_js(blog_metadata):
    try:
        if not blog_metadata:
            print("[ERROR] No metadata to write.")
            return

        logs = [{"title": e["title"], "date": e["date"], "slug": e["slug"]} for e in blog_metadata]
        js_content = f"export const logs = {json.dumps(logs, indent=2)};"

        with open(commit_log_js_file, "w", encoding="utf-8") as file:
            file.write(js_content)

        print("[INFO] commit-log.js has been updated successfully.")
    except Exception as e:
        print(f"[ERROR] Failed to write commit-log.js: {e}")

# 主逻辑
def update_commit_log():
    try:
        print("[INFO] Cleaning commit-log.txt and retrieving latest blog logs...")
        latest_logs = clean_commit_log()
        if not latest_logs:
            print("[ERROR] No valid blog logs to process.")
            return

        blog_metadata = get_blog_metadata(latest_logs)
        write_commit_log_js(blog_metadata)

        print("[INFO] commit-log.js has been updated.")
        # 不再清空 commit-log.txt
    except Exception as e:
        print(f"[ERROR] Failed to update commit log: {e}")

# 执行
if __name__ == "__main__":
    update_commit_log()
