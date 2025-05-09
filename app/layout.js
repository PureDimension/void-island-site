'use client';

import { FilterProvider, useFilter } from './FilterContext';
import './globals.css';
function TopRightButton() {
  const { filterOn, setFilterOn } = useFilter();

  return (
    <div style={{
      position: 'fixed',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: '20px',
      borderRadius: '10px',
      top: '50px',
      right: '50px',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
    }}>
      {/* 文字 "认知滤网" 在方框外的左侧 */}
      <span style={{
        color: 'white',
        fontSize: '36px',
        fontWeight: 'bold',
        marginRight: '10px', // 为按钮腾出一些空间
        textShadow: '2px 2px 5px #000',
      }}>
        认知滤网
      </span>
      <div
        onClick={() => setFilterOn(!filterOn)}
        style={{
          width: '100px',            // 按钮宽度
          height: '40px',            // 按钮高度
          backgroundColor: filterOn ? '#ffa500' : '#444',
          borderRadius: '35px',      // 圆角
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '5px',
          cursor: 'pointer',
          boxShadow: filterOn ? '0 0 15px 5px rgba(255,165,0,0.6)' : '0 0 5px rgba(0,0,0,0.5)',
          transition: 'all 0.3s ease',
          position: 'relative',      // 为滑块定位做准备
        }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: filterOn ? 'calc(100% - 40px)' : '0px', // 滑块的滑动位置
          transform: 'translateY(-50%)',
          width: '40px',
          height: '40px',
          borderRadius: '35px',
          backgroundColor: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          color: filterOn ? '#ffa500' : '#444',
          boxShadow: '0 0 5px rgba(0,0,0,0.3)',
          transition: 'left 0.3s ease', // 滑动的动画效果
        }}>
          {filterOn ? 'ON' : 'OFF'}
        </div>
        <span style={{
          color: 'white',
          fontSize: '24px',
          fontWeight: 'bold',
          transition: 'color 0.3s ease', // 动画
        }}>
        </span>
      </div>
    </div>
  );
}

function LayoutContent({ children }) {
  const { filterOn } = useFilter();

  return (
    <div
      style={{
        minHeight: '100vh',
        position: 'relative', // 为叠加背景层做准备
        overflow: 'hidden', // 防止内容溢出
      }}
    >
      {/* 背景层 1：filterOn 的背景 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg,rgb(151, 139, 123),rgb(79, 97, 125))', // 白灰渐变
          opacity: filterOn ? 1 : 0, // 根据 filterOn 切换透明度
          transition: 'opacity 0.3s ease', // 渐变动画
          zIndex: 0,
        }}
      ></div>

      {/* 背景层 2：!filterOn 的背景 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg,rgb(249, 235, 215),rgb(175, 205, 254))', // 橙蓝渐变
          opacity: filterOn ? 0 : 1, // 根据 filterOn 切换透明度
          transition: 'opacity 0.3s ease', // 渐变动画
          zIndex: 0,
        }}
      ></div>

      {/* 内容层 */}
      <div
        style={{
          position: 'relative',
          zIndex: 1, // 确保内容在背景层之上
          color: 'white',
        }}
      >
        <TopRightButton />
        {children}
      </div>
    </div>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <FilterProvider>
          <LayoutContent>{children}</LayoutContent>
        </FilterProvider>
      </body>
    </html>
  );
}