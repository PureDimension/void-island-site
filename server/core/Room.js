const path = require('path');

class Room {
    constructor(roomId, ruleId, hostUser, meta) {
      this.roomId = roomId;
      this.ruleId = ruleId; // 游戏规则标识，如 'rps'
      this.meta = meta; // 额外的房间信息（如创建时间、游戏设置等）
      this.hostId = hostUser.uuid; // 房主 ID
      this.status = 'WAITING'; // WAITING, GAMING, FINISHED
     
      // 座位信息：固定 4 个位置（兼容日麻），存储格式 [UserObj, UserObj, ...]
      // 没人的位置为 null
      this.seats = [null, null, null, null];
     
      // 玩家准备状态 { uuid: boolean }
      this.readyStatus = {};
     
      // --- 游戏引擎核心组件 ---
      this.gameInstance = null; // 存储 Logic.js 的实例
      this.gameState = null;    // 存储后端全量游戏状态（绝对不直接发给前端）
      // ----------------------
     
      // 自动将房主加入 0 号位
      this.addPlayer({ user: hostUser });

      this.destructionTimer = null;
    }
 
    // 开启销毁倒计时
    startDestructionTimer(callback) {
        if (this.destructionTimer) return;
        console.log(`[Room ${this.roomId}] 房间已空，5分钟后自动清理...`);
        this.destructionTimer = setTimeout(() => {
        callback(this.roomId);
        }, 5 * 60 * 1000); // 5分钟
    }

    checkHost(uuid) {
      return this.hostId === uuid;
    }

    // 停止销毁倒计时
    stopDestructionTimer() {
        if (this.destructionTimer) {
        console.log(`[Room ${this.roomId}] 玩家回归，取消清理。`);
        clearTimeout(this.destructionTimer);
        this.destructionTimer = null;
        }
    }

    // 通用分发器：根据函数名调用内部方法
    dispatch(action, data) {
        if (typeof this[action] === 'function') {
        return this[action](data);
        }
        else if (this.status === 'PLAYING' && this.gameInstance) {
          return this.handleGameAction(data.uuid, action, data);
        }
        return { success: false, msg: `未知操作: ${action}` };
    }

    addPlayer({ user }) {
      // 1. 统一标识符
      const requestUuid = user.uuid;

      // 2. 幂等性校验（解决同账号多开/刷新重连）
      // 只要 this.seats[0] 里的 uuid 还是账号A，账号A重连进来时会匹配到这里
      const existingIndex = this.seats.findIndex(s => s && s.uuid === requestUuid);
      if (existingIndex !== -1) {
        return { 
          success: true, 
          seatIndex: existingIndex, 
          msg: "欢迎回来" 
        };
      }

      // 3. 寻找真正的物理空位 (null)
      // 这里保证了账号B不会坐到账号A的位置上，因为 A 还没被“清理”
      const firstEmptyIndex = this.seats.findIndex(s => s === null);

      // 4. 满员检查
      if (firstEmptyIndex === -1) {
        return { success: false, msg: "列车满员，请等待下一班" };
      }

      // 5. 坐下
      this.seats[firstEmptyIndex] = {
        uuid: requestUuid,
        username: user.username,
        avatar: user.current_avatar,
        role: user.role,
        joinedAt: Date.now() 
      };

      // 6. 状态同步
      this.readyStatus[requestUuid] = false;

      return { 
        success: true, 
        seatIndex: firstEmptyIndex 
      };
    }
    // 换座逻辑
    changeSeat({ uuid, newSeatIndex }) {
        if (this.seats[newSeatIndex] !== null) return { success: false, msg: "目标位置非空" };
        const oldIndex = this.seats.findIndex(s => s && s.uuid === uuid);
        if (oldIndex === -1) return { success: false, msg: "未在房间内找到该用户" };
       
        this.seats[newSeatIndex] = this.seats[oldIndex];
        this.seats[oldIndex] = null;
        return { success: true };
    }

    // 离开玩家
    removePlayer({ uuid }) {
        const index = this.seats.findIndex(s => s && s.uuid === uuid);
        if (index !== -1) {
        this.seats[index] = null;
        delete this.readyStatus[uuid];
        return { success: true, isEmpty: this.seats.every(s => s === null) };
        }
        return { success: false };
    }

    // 准备/取消准备
    toggleReady({ uuid }) {
      // 1. 房主不需要准备逻辑（对应我们选定的方案 3）
      if (uuid === this.hostId) {
        return { success: false, msg: "列车长无需准备，请直接发车" };
      }
    
      // 2. 正常切换准备状态
      this.readyStatus[uuid] = !this.readyStatus[uuid];
      
      // 3. 返回 success 告知 action 处理器进行广播
      return { 
        success: true, 
        isReady: this.readyStatus[uuid] 
      };
    }
 
// 修改房间配置（名、游戏、人数上限等）
updateConfig({ uuid, config }) {
  if (!this.checkHost(uuid)) return { success: false, msg: "只有列车长有权调整配置" };
  if (this.status !== 'WAITING') return { success: false, msg: "列车已发车，无法调整配置" };
  
  if (config.ruleId && config.ruleId !== this.ruleId) {
      // 从后端全局变量直接索引 (假设 gameMetaMap 在 Room.js 可访问，或通过构造/参数传入)
      // 建议在 socketHandler 调用此方法时确保全局变量已加载
      const targetMeta = global.gameMetaMap[config.ruleId]; 
      if (!targetMeta) return { success: false, msg: "未知的游戏规则" };

      this.ruleId = config.ruleId;
      this.meta = targetMeta; // 更新内存中的元数据副本
  }
  if (config.maxSeats) {
      const oldMax = this.seats.length;
      const newMax = config.maxSeats;
      const currentPlayers = this.seats.filter(s => s !== null);

      // 1. 基础校验：总坑位数不能少于当前已经在座的人数
      if (newMax < currentPlayers.length) {
          return { success: false, msg: "当前乘客多于目标座位数" };
      }

      if (newMax > oldMax) {
          // 扩充逻辑：直接在末尾补 null
          this.seats = [...this.seats, ...new Array(newMax - oldMax).fill(null)];
      } 
      else if (newMax < oldMax) {
          // 缩减逻辑：从后往前定向剔除空位
          let diff = oldMax - newMax; // 需要删掉的空位数量
          let resultSeats = [...this.seats];

          // 从末尾开始遍历
          for (let i = resultSeats.length - 1; i >= 0 && diff > 0; i--) {
              // 只有这个位置是空的，才允许删掉它
              if (resultSeats[i] === null) {
                  resultSeats.splice(i, 1);
                  diff--; // 删掉一个，指标减一
              }
          }

          // 理论上由于前面 check 了人数，这里 diff 一定会减到 0
          // 但为了逻辑严密，如果 diff 还没扣完，说明空位不够删
          if (diff > 0) {
              return { success: false, msg: "空位不足，无法在不移动乘客的情况下缩减" };
          }

          this.seats = resultSeats;
      }
  }
  return { success: true };
}

  // 踢出玩家
  kickPlayer({ uuid, targetUuid }) {
    if (!this.checkHost(uuid)) return { success: false, msg: "只有列车长能赶人走" };
    if (targetUuid === this.hostId) return { success: false, msg: "不能踢出你自己" };
    return this.removePlayer({ uuid: targetUuid });
  }

  // 转让房主
  transferHost({ uuid, targetUuid }) {
    if (!this.checkHost(uuid)) return { success: false, msg: "只有现任列车长可以转让权限" };
    const isPresent = this.seats.some(s => s && s.uuid === targetUuid);
    if (!isPresent) return { success: false, msg: "目标玩家不在车厢内" };
    
    this.hostId = targetUuid;
    return { success: true };
  }

  // 强制关闭房间
  closeRoom({ uuid }) {
    if (!this.checkHost(uuid)) return { success: false, msg: "无权关闭" };
    this.stopDestructionTimer(); // 既然都要删了，把定时器也关掉
    this.seats = this.seats.map(() => null); // 清空所有人
    return { success: true, isEmpty: true, msg: "房间已解散" };
  }

  // 开始游戏
  startGame({ uuid }) {
    if (!this.checkHost(uuid)) return { success: false, msg: "只有房主可以开始游戏" };
    if (this.status === 'PLAYING') return { success: false, msg: "游戏进行中" };
    if (this.status === 'FINISHED') return { success: false, msg: "请等待游戏结束公布完毕" };
    
    const playerIds = this.seats.filter(s => s !== null).map(s => s.uuid);

    // 基础人数校验
    if (playerIds.length < (this.meta.minPlayers || 1)) {
      return { success: false, msg: `乘客不足，至少需要 ${this.meta.minPlayers} 人` };
    }
    else if(playerIds.length > (this.meta.maxPlayers || 999)) {
      return { success: false, msg: `乘客过多，最多只能有 ${this.meta.maxPlayers} 人` };
    }
    if(playerIds.length < this.seats.length) {
      return { success: false, msg: `请调整人数坐满所有空位` };
    }

    // 检查是否全员准备
    const allReady = playerIds.every(id => id === this.hostId || this.readyStatus[id]);
    if (!allReady) return { success: false, msg: "仍有乘客未准备就绪" };

    try {
      // 动态加载逻辑类 (假设路径: game-scripts/rps/logic.js)
      const logicPath = path.join(process.cwd(), 'game-scripts', this.ruleId, 'logic.js');
      const LogicClass = require(logicPath);
      
      // 实例化引擎并注入当前房间引用
      this.gameInstance = new LogicClass(this);
      
      // 获取游戏初始全量状态
      this.gameState = this.gameInstance.setup();
      
      this.status = 'PLAYING';
      console.log(`[Room ${this.roomId}] 游戏开始: ${this.ruleId}`);
      
      return { success: true };
    } catch (err) {
      console.error(`[Room ${this.roomId}] 启动游戏失败:`, err);
      return { success: false, msg: "游戏引擎装载失败" };
    }
  }

  handleGameAction(uuid, action, data) {
    if (!this.gameInstance || this.status !== 'PLAYING') return { success: false };

    // 调用逻辑实例的操作接口
    // 注意：这里我们使用 async/await 因为逻辑层可能会调用 Python 或数据库
    try {
      const result = this.gameInstance.onAction(this.gameState, { action, data, uuid });
      
      // 如果逻辑层返回了新的状态（或直接在引用上修改了）
      if (result) this.gameState = result;

      return { success: true };
    } catch (err) {
      console.error("游戏逻辑执行错误:", err);
      return { success: false, msg: "指令执行异常" };
    }
  }

  broadcastState() {
    // 这里的具体实现在 socketHandler 中，Room 类仅作为一个触发占位
    // 实际运行时，我们将通过事件或回调把消息发出去
    if (this.onStateChange) this.onStateChange();
  }

  // 结束游戏
  endGame(results = null) {
    console.log(`[Room ${this.roomId}] 游戏结束`);
    this.status = 'FINISHED';
    
    // 如果有最终结果，可以存入 gameState 供前端最后一次读取
    if (results && this.gameState) {
        this.gameState.finalResults = results;
    }

    // 广播最后的状态
    this.broadcastState();

    // 10秒后自动清理游戏实例，切回等待状态
    setTimeout(() => {
        this.gameInstance = null;
        this.gameState = null;
        this.status = 'WAITING';
        // 重置所有人的准备状态
        Object.keys(this.readyStatus).forEach(id => this.readyStatus[id] = false);
        this.broadcastState();
    }, 10000);
  }

  /**
   * 5. 序列化（带脱敏）
   * @param {string} targetUuid 为哪个用户进行序列化
   */
  serialize(targetUuid = null) {
    let filteredGameState = null;

    // 如果在游戏中，根据 targetUuid 进行数据脱敏
    if (this.status === 'PLAYING' && this.gameInstance && this.gameState) {
      if (typeof this.gameInstance.filter === 'function') {
        filteredGameState = this.gameInstance.filter(this.gameState, targetUuid);
      } else {
        // 如果游戏没写 filter，则全量下发（仅限非竞技类游戏）
        filteredGameState = this.gameState;
      }
    } else if (this.status === 'FINISHED') {
        // 游戏结束显示全量结果
        filteredGameState = this.gameState;
    }

    return {
      roomId: this.roomId,
      ruleId: this.ruleId,
      meta: this.meta,
      hostId: this.hostId,
      status: this.status,
      seats: this.seats,
      readyStatus: this.readyStatus,
      // 只下发过滤后的状态
      gameState: filteredGameState 
    };
  }
}
 
  module.exports = Room;
