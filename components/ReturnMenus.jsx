"use client";

import Link from "next/link";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTheme } from "../lib/theme"; // 请根据你的路径调整

export default function ReturnMenus() {
  const returnStringRef = useRef(null);
  const returnAnchorRef = useRef(null);
  const toggleStringRef = useRef(null);
  const toggleAnchorRef = useRef(null);

  const { isDarkMode, toggleTheme } = useTheme();

  useEffect(() => {
    let angle = 0;
    let velocity = 0.02;
    let frame;

    const swing = () => {
      angle += velocity;
      const swingOffset = Math.sin(angle) * 5;

      if (returnStringRef.current && returnAnchorRef.current) {
        returnStringRef.current.style.transform = `translateX(${swingOffset}px)`;
        returnAnchorRef.current.style.transform = `translateX(${swingOffset}px)`;
      }

      if (toggleStringRef.current && toggleAnchorRef.current) {
        toggleStringRef.current.style.transform = `translateX(${swingOffset}px)`;
        toggleAnchorRef.current.style.transform = `translateX(${swingOffset}px)`;
      }

      frame = requestAnimationFrame(swing);
    };

    swing();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="fixed top-0 right-6 z-10 flex flex-row items-start space-x-4 z-20">
      {/* 日夜切换按钮 */}
      <div className="flex flex-col items-center">
        <div
          ref={toggleStringRef}
          className={`w-px h-8 transition-transform duration-100 ${isDarkMode ? "bg-white" : "bg-black"}`}
        />
        <div ref={toggleAnchorRef} className="transition-transform duration-100">
          <button
            onClick={toggleTheme}
            className="
              w-10 h-10
              rounded-full
              border-[3px] border-white
              bg-[rgba(0,0,0,0.5)]
              text-white
              flex items-center justify-center
              shadow-md
              hover:bg-white hover:text-black
              active:scale-95
              focus:outline-none focus:outline-none
              transition
            "
            aria-label="切换日夜模式"
          >
            {isDarkMode ? (
              <Sun size={20} strokeWidth={2} fill="none" />
            ) : (
              <Moon size={20} strokeWidth={2} fill="none" />
            )}
          </button>
        </div>
      </div>

      {/* 返回按钮 */}
      <div className="flex flex-col items-center">
        <div
          ref={returnStringRef}
          className={`w-px h-8 transition-transform duration-100 ${isDarkMode ? "bg-white" : "bg-black"}`}
        />
        <div ref={returnAnchorRef} className="transition-transform duration-100">
          <Link href="/" aria-label="返回主页">
            <button
              className="
                w-10 h-10
                rounded-full
                border-[3px]  border-white
                bg-[rgba(0,0,0,0.5)]
                text-white
                flex items-center justify-center
                shadow-md
                hover:bg-white hover:text-black
                active:scale-95
                focus:outline-none focus:outline-none
                transition
              "
            >
              <ArrowLeft size={20} />
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
