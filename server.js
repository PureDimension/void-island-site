const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const express = require("express");
const socketHandler = require("./server/state/socketHandler");
const { initLepidEyeDatabase } = require("./server/lepidEye/store");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);
  const io = new Server(httpServer);

  initLepidEyeDatabase();

  // 初始化 Socket.io 逻辑 (包含管理员烧录)
  socketHandler(io);

  // 1. 静态资源优先级处理 (无需通配符字符串)
  server.use((req, res, next) => {
    const parsedUrl = parse(req.url, true);
    const { pathname } = parsedUrl;

    // 显式允许 Next.js 内部资源
    if (pathname.startsWith('/_next') || pathname.startsWith('/static')) {
      return handle(req, res, parsedUrl);
    }
    next();
  });

  // 2. 静态文件目录
  server.use(express.static('public'));

  // 3. 核心修复：路由全接管
  // 不再使用 '*' 字符串，而是使用 .use() 不带路径参数，
  // 这样它会捕获所有到达这里的请求。
  server.use((req, res) => {
    // 排除 API
    
    const parsedUrl = parse(req.url, true);
    return handle(req, res, parsedUrl);
  });

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`---`);
    console.log(`> [Aether Core] Mode: ${dev ? "DEVELOPMENT" : "PRODUCTION"}`);
    console.log(`> [Aether Core] URL: http://localhost:${PORT}`);
    console.log(`---`);
  });
});
