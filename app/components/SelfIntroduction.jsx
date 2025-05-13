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
        bottom: isMobile ? "20px" : `140px`, // 电脑端扩展到页面底部，预留播放器高度
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
        <div>
          {sectionsConfig.selfIntroduce.interest_link.map((item, idx) => (
            <p
              key={idx}
              onClick={() => openModal(item.link)} // 点击时打开对应的弹窗
              style={{
                cursor: "pointer",
                textDecoration: "underline",
                color: "lightblue",
              }}
            >
              {item.description}
            </p>
          ))}
        </div>

        {/* 分隔线 */}
        <hr style={{ border: "1px solid white", margin: "10px 0" }} />

        {/* 友情链接 */}
        <div>
          <p style={{ fontWeight: "bold", marginBottom: "5px" }}>友情链接：</p>
          {sectionsConfig.selfIntroduce.friendship_link.map((item, idx) => (
            <p key={idx}>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "lightgreen",
                  textDecoration: "underline",
                }}
              >
                {item.description}
              </a>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}