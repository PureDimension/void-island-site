"use client";
import React from "react";

export default function SelfIntroduction({
  isMobile,
  sectionsConfig,
  openModal,
}) {
  return (
    <div
      style={{
        position: isMobile ? "static" : "fixed", // 手机端为静态布局，电脑端为固定布局
        top: isMobile ? "auto" : "20px",
        left: isMobile ? "auto" : "20px",
        bottom: isMobile ? "auto" : `auto`, // 电脑端扩展到页面底部，预留播放器高度
        backgroundColor: "rgba(100, 100, 100, 0.9)",
        color: "white",
        padding: "15px 20px",
        borderRadius: "10px",
        border: "3px solid white",
        fontWeight: "bold",
        maxWidth: "300px",
        zIndex: 15,
        wordWrap: "break-word",
        textAlign: "center",
        boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
      }}
    >
      {/* 顶部头像 */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "10px",
        }}
      >
        <img
          src={sectionsConfig.selfIntroduce.author_icon}
          alt="Author Icon"
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            border: "3px solid white",
            marginBottom: "10px", // 调整头像和 GitHub 图标的间距
          }}
        />
      </div>

      {/* GitHub 图标和链接 */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "10px",
        }}
      >
        <a
          href={sectionsConfig.selfIntroduce.github}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={sectionsConfig.selfIntroduce.github_svg}
            alt="GitHub"
            style={{
              width: "32px",
              height: "32px",
              marginBottom: "10px",
            }}
          />
        </a>
        {/* <a
          href={sectionsConfig.selfIntroduce.github}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={sectionsConfig.selfIntroduce.x_svg}
            alt="X"
            style={{
              width: "32px",
              height: "32px",
              marginBottom: "10px",
            }}
          />
        </a> */}
      </div>

      {/* 个人描述、兴趣链接、友情链接 */}
      <div
        style={{
          flex: 1, // 占据剩余空间
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between", // 等间隔分布
        }}
      >
        {/* 个人描述 */}
        <div>
          <p>{sectionsConfig.selfIntroduce.description}</p>
        </div>

        {/* 分隔线 */}
        <hr style={{ border: "1px solid white", margin: "10px 0" }} />

        {/* 兴趣链接 */}
        <div
          style={{
            background: "rgba(255,255,255,0.08)",
            borderRadius: "12px",
            padding: "10px",
            boxShadow: "inset 2px 2px 6px rgba(0,0,0,0.3), inset -2px -2px 6px rgba(255,255,255,0.05)",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              marginBottom: "8px",
              opacity: 0.8,
            }}
          >
            🎧 兴趣
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
            }}
          >
            {sectionsConfig.selfIntroduce.interest_link.map((item, idx) => {
              const isStarterHighlight =
                item.description === "新人必看" || item.link === "WebsiteIntroduction";
              const baseShadow = isStarterHighlight
                ? "0 0 0 1px rgba(255,255,255,0.22), 0 0 18px rgba(255, 216, 107, 0.48), 0 0 34px rgba(95, 168, 255, 0.34), 3px 3px 6px rgba(0,0,0,0.4), -2px -2px 5px rgba(255,255,255,0.12)"
                : "3px 3px 6px rgba(0,0,0,0.4), -2px -2px 5px rgba(255,255,255,0.1)";
              const hoverShadow = isStarterHighlight
                ? "0 0 0 1px rgba(255,255,255,0.28), 0 0 22px rgba(255, 216, 107, 0.62), 0 0 42px rgba(95, 168, 255, 0.4), 5px 5px 10px rgba(0,0,0,0.5), -3px -3px 6px rgba(255,255,255,0.16)"
                : "5px 5px 10px rgba(0,0,0,0.5), -3px -3px 6px rgba(255,255,255,0.15)";

              return (
                <div
                  key={idx}
                  onClick={() => openModal(item.link)}
                  style={{
                    cursor: "pointer",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    background: isStarterHighlight
                      ? "linear-gradient(145deg, #d8bf68, #9f7b1f)"
                      : "linear-gradient(145deg, #6a6a6a, #4e4e4e)",
                    border: isStarterHighlight ? "1px solid rgba(255, 236, 168, 0.9)" : "1px solid transparent",
                    boxShadow: baseShadow,
                    fontSize: "12px",
                    textAlign: "center",
                    color: isStarterHighlight ? "#fff6d6" : "white",
                    textShadow: isStarterHighlight ? "0 0 8px rgba(255, 239, 180, 0.35)" : "none",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = hoverShadow;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = baseShadow;
                  }}
                >
                  {item.description}
                </div>
              );
            })}
          </div>
        </div>

        {/* 分隔线 */}
        <hr style={{ border: "1px solid white", margin: "10px 0" }} />

        {/* 友情链接 */}
        <div
          onClick={() => openModal("FriendLinks")}
          style={{
            cursor: "pointer",
            padding: "12px",
            borderRadius: "12px",
            background: "linear-gradient(145deg, #5fa8ff, #3f7fdc)",
            boxShadow:
              "4px 4px 10px rgba(0,0,0,0.4), -2px -2px 6px rgba(255,255,255,0.2)",
            textAlign: "center",
            fontWeight: "600",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow =
              "6px 6px 14px rgba(0,0,0,0.5), -3px -3px 8px rgba(255,255,255,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow =
              "4px 4px 10px rgba(0,0,0,0.4), -2px -2px 6px rgba(255,255,255,0.2)";
          }}
        >
          🌐 友情链接(已有7人！)
        </div>
      </div>
    </div>
  );
}
