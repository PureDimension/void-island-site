"use client";
import { useFilter } from "./FilterContext";
import { useEffect, useState } from "react";

export default function TopRightButton({ isMobile }) {
    const { filterOn, setFilterOn } = useFilter();
    const [buttonStyle, setButtonStyle] = useState({
        width: 100,
        height: 40,
        top: 50,
        right: 50,
    }); // 默认按钮大小和位置

    useEffect(() => {
        // 根据传入的 isMobile 动态调整按钮大小和位置
        setButtonStyle({
            width: isMobile ? 80 : 100, // 手机屏幕宽度为 80px，桌面为 100px
            height: isMobile ? 28 : 40, // 手机屏幕高度为 28px，桌面为 40px
            top: isMobile ? 20 : 50, // 手机屏幕距离顶部为 20px，桌面为 50px
            right: isMobile ? 20 : 50, // 手机屏幕距离右侧为 20px，桌面为 50px
            fontSize: isMobile ? 18 : 36, // 手机屏幕字体大小为 18pt，桌面为 36pt
            innerFontSize: isMobile ? 10 : 14, // 手机屏幕内文字大小为 10pt，桌面为 14pt
        });
    }, [isMobile]);

    return (
        <div
            style={{
                position: "fixed",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                padding: "20px",
                borderRadius: "10px",
                top: `${buttonStyle.top}px`, // 动态顶部距离
                right: `${buttonStyle.right}px`, // 动态右侧距离
                display: "flex",
                alignItems: "center",
            }}
        >
            <span
                style={{
                    color: "white",
                    fontSize: `${buttonStyle.fontSize}px`,
                    fontWeight: "bold",
                    marginRight: "10px",
                    textShadow: "2px 2px 5px #000",
                }}
            >
                认知滤网
            </span>
            <div
                onClick={() => setFilterOn(!filterOn)}
                style={{
                    width: `${buttonStyle.width}px`, // 动态宽度
                    height: `${buttonStyle.height}px`, // 动态高度
                    backgroundColor: filterOn ? "#ffa500" : "#444",
                    borderRadius: `${buttonStyle.height / 2}px`, // 保持按钮为圆角
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "5px",
                    cursor: "pointer",
                    boxShadow: filterOn
                        ? "0 0 15px 5px rgba(255,165,0,0.6)"
                        : "0 0 5px rgba(0,0,0,0.5)",
                    position: "relative",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: filterOn
                            ? `calc(100% - ${buttonStyle.height}px)` // 动态调整滑块位置
                            : "0px",
                        transform: "translateY(-50%)",
                        width: `${buttonStyle.height}px`, // 滑块宽度与按钮高度一致
                        height: `${buttonStyle.height}px`, // 滑块高度与按钮高度一致
                        borderRadius: "50%", // 保持滑块为圆形
                        backgroundColor: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "bold",
                        fontSize: `${buttonStyle.innerFontSize}px`, // 动态字体大小
                        color: filterOn ? "#ffa500" : "#444",
                        boxShadow: "0 0 5px rgba(0,0,0,0.3)",
                        transition: "left 0.3s ease",
                    }}
                >
                    {filterOn ? "ON" : "OFF"}
                </div>
            </div>
        </div>
    );
}