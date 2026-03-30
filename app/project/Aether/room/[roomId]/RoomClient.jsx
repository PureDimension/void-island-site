"use client";
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useRouter } from "next/navigation";
import { 
  Play, CheckCircle, Crown, Settings, 
  BookOpen, LogOut, Loader2, UserMinus, ChevronDown, Users
} from "lucide-react";

export default function RoomClientPage({ roomId }) {
  const router = useRouter();
  const socketRef = useRef(null);
  const [roomData, setRoomData] = useState(null);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("CONNECTING");
  const [availableGames, setAvailableGames] = useState([]);

  useEffect(() => {
    const savedSessionId = localStorage.getItem("AETHER_SESSION_ID");
    if (!savedSessionId) { router.push("/project/Aether"); return; }

    const socket = io({ transports: ["websocket"], upgrade: false, reconnectionAttempts: 5 });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("auth-request", { sessionId: savedSessionId }));
    socket.on("auth-success", (userData) => {
      setUser(userData);
      socket.emit("get-available-games");
      socket.emit("room-action", { sessionId: savedSessionId, uuid: userData.uuid, action: "addPlayer", roomId });
    });
    socket.on("available-games-list", (list) => {
      setAvailableGames(list);
    });
    socket.on("room-info-update", (data) => { setRoomData(data); setStatus("READY"); });
    socket.on("room-closed", () => router.push("/project/Aether"));
    
    socket.on("op-feedback", ({ type, message }) => {
      console.log(`[Server Feedback] ${type}: ${message}`);
      if (type === 'error') alert(message); // 或者用更优雅的 toast
    });

    return () => socket.disconnect();
  }, [roomId, router]);

  const dispatch = (action, data = {}) => {
    if (!socketRef.current || !user) return;
    socketRef.current.emit("room-action", {
      sessionId: localStorage.getItem("AETHER_SESSION_ID"),
      uuid: user.uuid, action, roomId, data
    });
  };

  const GameView = useMemo(() => {
    const isInGame = roomData?.status === "PLAYING" || roomData?.status === "FINISHED";
    if (!isInGame || !roomData?.ruleId) return null;
    
    return dynamic(() => import(`@/game-scripts/${roomData.ruleId}/view.jsx`), {
      loading: () => (
        <div className="flex flex-col items-center justify-center h-full text-blue-400 font-mono text-xs">
          <Loader2 className="animate-spin mb-2" size={20} />
          LOADING ENGINE...
        </div>
      ),
      ssr: false // 必须禁用 SSR，因为游戏视图依赖浏览器 Socket
    });
  }, [roomData?.status, roomData?.ruleId]);

  const sendGameAction = (action, data = {}) => {
    if (!socketRef.current) return;
    socketRef.current.emit("game-action", { action, data });
  };

  if (status !== "READY" || !roomData) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#f0f4f8] text-blue-400 font-mono text-xs">
        <Loader2 className="animate-spin mr-2" size={14} /> INITIALIZING STATION...
      </div>
    );
  }

  const isHost = user?.uuid === roomData.hostId;
  const myReadyStatus = roomData.readyStatus[user?.uuid];
  const playerCount = roomData.seats.filter(s => s !== null).length;

  return (
    <div className="h-screen w-full bg-gradient-to-tr from-[#e0eafc] to-[#cfdef3] text-slate-600 flex flex-col font-sans overflow-hidden">
      
      {/* 1. 顶部管理横幅 */}
      <section className="h-[30%] min-h-[220px] w-full p-6 flex flex-col relative z-30">
        <div className="max-w-6xl mx-auto w-full h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] shadow-[0_10px_40px_rgba(148,163,184,0.1)] p-6 flex gap-8 relative overflow-hidden">
          
          {/* 左侧：房间基础信息 */}
          <div className="flex-[1.5] flex flex-col justify-between border-r border-blue-200/50 pr-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500"><Settings size={18}/></div>
                <input 
                  type="text" 
                  defaultValue={`#${roomData.roomId} 站台`}
                  disabled={!isHost}
                  className="bg-transparent text-xl font-black focus:outline-none placeholder:text-blue-300 w-full text-slate-700"
                  onBlur={(e) => isHost && dispatch("updateConfig", { config: { roomName: e.target.value } })}
                />
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                <div className="flex flex-col">
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest leading-tight">当前状态</span>
                  <span className={`text-xs font-black ${roomData.status === "WAITING" ? "text-blue-500" : "text-indigo-600"}`}>
                    {roomData.status === "WAITING" ? "等待中" : "已开始游戏"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest leading-tight">乘客人数</span>
                  <div className="flex items-center gap-1 h-[20px]">
                    <Users size={12} className="text-blue-400"/>
                    {isHost ? (
                      /* 房主模式：显示下拉选择框以调整上限 */
                      <div className="relative flex items-center group">
                        <select 
                          className="appearance-none bg-blue-400/5 border border-transparent hover:border-blue-300/50 rounded px-1 pr-4 text-xs font-black text-slate-700 focus:outline-none cursor-pointer transition-all"
                          value={roomData.seats.length}
                          disabled={!isHost || roomData.status !== "WAITING"}
                          onChange={(e) => dispatch("updateConfig", { config: { maxSeats: parseInt(e.target.value) } })}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                            <option key={num} value={num} disabled={num < playerCount}>{num} 人</option>
                          ))}
                        </select>
                        <div className="absolute right-1.5 pointer-events-none text-blue-500/60">
                          <ChevronDown size={10} strokeWidth={4} />
                        </div>
                      </div>
                    ) : (
                      /* 乘客模式：仅显示静态文本 */
                      <span className="text-xs font-black text-slate-700">{playerCount} / {roomData.seats.length}</span>
                    )}
                  </div>
                </div>
                {/* 1. 父容器增加 items-center，确保子元素（标题和选择框）中轴线对齐 */}
                <div className="flex flex-col items-center">
                  
                  {/* 2. 标题增加 text-center */}
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest leading-tight text-center">
                    游戏规则选择
                  </span>
                  
                  {/* 3. 移除多余的嵌套 div，保持结构清晰 */}
                  <div className="relative flex items-center">
                    <select 
                      disabled={!isHost || roomData.status !== "WAITING"}
                      className={`
                        appearance-none 
                        /* 高度调节：h-[20px] | 宽度定死：w-[78px] */
                        h-[20px] w-[100px]
                        bg-blue-400/10 backdrop-blur-md 
                        border border-blue-300/50 
                        /* 稍微调整 padding 为箭头留出空间 */
                        pl-2 pr-5 rounded-md text-[11px] font-black 
                        focus:outline-none text-slate-900 cursor-pointer 
                        transition-all hover:bg-blue-400/20 hover:border-blue-400/60
                        leading-none
                      `}
                      value={roomData.ruleId}
                      onChange={(e) => dispatch("updateConfig", { config: { ruleId: e.target.value } })}
                    >
                    {availableGames.map(game => (
                        <option key={game.id} value={game.id} className="text-slate-900 bg-white">
                          {game.name}
                        </option>
                      ))}
                    </select>
                    
                    {/* 下拉小箭头 */}
                    {!isHost || (
                      <div className="absolute right-1.5 pointer-events-none text-blue-500/60">
                        <ChevronDown size={10} strokeWidth={4} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => {
                if (isHost) {
                  // 房主：直接解散房间
                  dispatch("closeRoom");
                } else {
                  // 乘客：永久离开
                  dispatch("removePlayer");
                }
                // 动作发出后，由于后端会触发 room-closed 或 update-room-list，
                // 我们在 useEffect 里的监听会自动把用户导向首页。
              }}
              className={`w-fit flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-[10px] font-black ${
                "bg-red-100/50 text-red-400 hover:bg-red-500 hover:text-white" 
              }`}
            >
              <LogOut size={12} /> 
              {isHost ? "关闭站台" : "离开站台"}
            </button>
          </div>

          {/* 右侧：规则主体区 */}
          <div className="flex-[4] h-full flex flex-col overflow-hidden">
            
            {/* 原有的“游戏规则说明” div 已删除，此处直接开始容器 */}
            
            <div className="flex-1 bg-blue-900/5 rounded-[1.8rem] border border-blue-200/20 shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 p-5 overflow-y-auto aether-scrollbar">
                <div className="text-xs leading-relaxed text-slate-500 font-medium">
                  
                  {/* 动态标题：保持顶格展示 */}
                  <p className="mb-3 text-slate-600 text-sm font-black flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                    {roomData.meta?.name || "加载协议中..."} 
                    <span className="text-[12px] font-normal opacity-40 ml-auto uppercase tracking-tighter">
                      Version v{roomData.meta?.version || "1.0"}
                    </span>
                  </p>

                  {/* 核心描述：增加稍微明显的对比度 */}
                  <div className="space-y-4 text-slate-500/90 whitespace-pre-line text-[11px]">
                    {roomData.meta?.description || "正在读取列车运行规程..."}
                  </div>

                  {/* 人数限制标签：缩小内边距以节省空间 */}
                  <div className="mt-4 flex gap-2">
                    <div className="px-2 py-0.5 bg-blue-500/5 rounded-md border border-blue-200/30 text-[9px] text-blue-400 font-bold">
                      最少游玩人数: {roomData.meta?.minPlayers || 1}
                    </div>
                    <div className="px-2 py-0.5 bg-indigo-500/5 rounded-md border border-indigo-200/30 text-[9px] text-indigo-400 font-bold">
                      最多游玩人数: {roomData.meta?.maxPlayers || 12}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 中心区域 & 3. 底部操作保持 */}
      <main className="flex-1 w-full max-w-6xl mx-auto flex items-center px-6 gap-6 relative"> 
      {roomData.status === "WAITING" ? (
      <div className="flex-1 w-full max-w-6xl mx-auto flex items-center px-6 gap-6">
        <div className="flex-1 flex items-center justify-center relative scale-[0.75] origin-center">
          <div className="relative w-[260px] h-[260px]">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white to-blue-50 shadow-[15px_15px_40px_rgba(148,163,184,0.15)] flex items-center justify-center border border-white">
              <div className="w-[85%] h-[85%] rounded-full border border-blue-100 shadow-inner bg-white/20 flex items-center justify-center">
                <span className="text-xl font-black opacity-[0.05] tracking-[0.3em] text-blue-900">AETHER</span>
              </div>
            </div>
            {roomData.seats.map((seat, i) => {
              const angle = i * (360 / roomData.seats.length);
              const radius = 190;
              return (
                <div key={i} className="absolute left-1/2 top-1/2" style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius}px) rotate(-${angle}deg)` }}>
                  <div className="flex flex-col items-center group">
                    <span className="text-[14px] font-black text-blue-300 mb-1">{i+1}</span>
                    <div 
                      onClick={() => !seat && dispatch("changeSeat", { newSeatIndex: i })}
                      className={`w-16 h-16 rounded-2xl p-0.5 transition-all cursor-pointer shadow-lg relative ${
                        seat ? (roomData.readyStatus[seat.uuid] ? "bg-emerald-400" : "bg-blue-400") : "bg-white/50 border-2 border-dashed border-blue-200"
                      }`}
                    >
                      <div className="w-full h-full rounded-[0.85rem] overflow-hidden bg-white/80">
                        {seat ? (
                          <>
                            <img src={`/avatar/${seat.avatar}.png`} className={`w-full h-full object-cover ${roomData.readyStatus[seat.uuid] ? 'opacity-30 blur-[1px]' : ''}`} />
                            {seat.uuid === roomData.hostId && (
                              <div className="absolute -top-2 -left-2 bg-amber-400 p-1 rounded-lg shadow-sm">
                                <Crown size={12} className="text-white" fill="currentColor"/>
                              </div>
                            )}
                          </>
                        ) : (
                        <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
                          <div className="opacity-10 text-blue-300 group-hover:opacity-0 transition-opacity">
                            <Users size={24}/>
                          </div>
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                            <span className="text-[10px] font-black text-blue-500 tracking-tighter">MOVE</span>
                            <ChevronDown size={14} className="text-blue-500 -mt-1 animate-bounce" />
                          </div>
                        </div> 
                        )}
                      </div>
                    </div>
                    <span className="text-[14px] font-bold mt-2 text-slate-500 bg-white/30 px-2 rounded-full backdrop-blur-sm truncate max-w-[120px]">
                      {seat?.username || "EMPTY"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* 找到右侧侧边栏区域，修改为如下结构 */}
        <div className="w-[340px] h-full max-h-[360px] flex flex-col relative group/sidebar">
          {/* h-full 和 max-h-[520px] 确保它不会无限拉长，
            max-h 的值可以根据你桌子的 scale(0.75) 后的视觉高度微调
          */}
          <div className="flex-1 overflow-y-auto pr-2 aether-scrollbar">
            <div className="flex flex-col gap-2.5">
              {roomData.seats.map((seat, i) => (
                <div key={i} className={`
                  relative p-3 rounded-2xl border transition-all duration-300 flex items-center gap-4 cursor-pointer backdrop-blur-md shrink-0
                  ${seat 
                      ? seat.uuid === roomData.hostId 
                        ? "bg-amber-50/80 border-amber-200 shadow-sm" 
                        : "bg-white/50 border-white shadow-sm" 
                      : "bg-white/10 border-dashed border-blue-200 opacity-60"}
                `}>
                  <div className="relative z-10">
                    <div className={`w-10 h-10 rounded-xl overflow-hidden border-2 ${
                      seat?.uuid === roomData.hostId 
                        ? 'border-amber-400' 
                        : roomData.readyStatus[seat?.uuid] ? 'border-emerald-400' : 'border-white'
                    }`}>
                      {seat && <img src={`/avatar/${seat.avatar}.png`} className={`w-full h-full object-cover ${roomData.readyStatus[seat.uuid] ? 'opacity-40' : ''}`} />}
                    </div>
                    {seat && seat.uuid !== roomData.hostId && roomData.readyStatus[seat.uuid] && (
                      <CheckCircle className="absolute inset-0 m-auto text-emerald-500" size={20}/>
                    )}
                  </div>

                  <div className="flex-1 z-10 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-black italic text-slate-700 truncate">{seat?.username || "待加入"}</span>
                      {seat && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-md font-black shadow-sm tracking-wider whitespace-nowrap ${
                          seat.uuid === roomData.hostId ? "bg-amber-400 text-white" : 
                          roomData.readyStatus[seat.uuid] ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                        }`}>
                          {seat.uuid === roomData.hostId ? "房主" : roomData.readyStatus[seat.uuid] ? "已准备" : "未准备"}
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] font-mono text-blue-500 tracking-tighter italic">
                      ID: {seat?.uuid.slice(0,8) || "--------"}
                    </div>
                  </div>

                  {isHost && seat && seat.uuid !== user.uuid && (
                    <button onClick={(e) => {e.stopPropagation(); dispatch("kickPlayer", { targetUuid: seat.uuid });}} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
                      <UserMinus size={22}/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* 装饰性渐变：当人数多产生滚动时，底部边缘会显得更平滑 */}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#cfdef3]/50 to-transparent pointer-events-none rounded-b-2xl"></div>
        </div>
      </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center animate-in fade-in zoom-in duration-700">
          {GameView ? (
            <GameView 
              gameState={roomData.gameState} 
              players={roomData.seats}
              myUuid={user.uuid}
              onAction={sendGameAction} 
            />
          ) : (
            <div className="text-blue-400 font-mono text-xs animate-pulse">
              INITIALIZING GAME ENGINE...
            </div>
          )}
        </div>
        )}
      </main>
      {roomData.status === "WAITING" && (
        <footer className="h-24 flex justify-center items-center pb-6">
        {isHost ? (
          <button onClick={() => dispatch("startGame")} className="px-16 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-2xl font-black text-lg shadow-[0_10px_25px_rgba(59,130,246,0.3)] transition-all active:scale-95 flex items-center gap-3 tracking-[0.1em]">
            <Play fill="white" size={18}/> 游戏开始
          </button>
        ) : (
          <button onClick={() => dispatch("toggleReady")} className={`px-16 py-3.5 rounded-2xl font-black text-lg transition-all active:scale-95 shadow-md border-2 bg-white border-blue-400 text-blue-500`}>
            {myReadyStatus ? "取消准备" : "准备就绪"}
          </button>
        )}
      </footer>
      )}
      <style jsx global>{`
        .aether-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .aether-scrollbar::-webkit-scrollbar-track {
          background: transparent;
          margin: 10px 0;
        }
        .aether-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.2);
          border-radius: 10px;
        }
        .aether-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.4);
        }
        .aether-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(59, 130, 246, 0.2) transparent;
        }
      `}</style>
    </div>
  );
}
