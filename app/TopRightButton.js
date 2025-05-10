'use client';
import { useFilter } from './FilterContext';

export default function TopRightButton() {
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
      <span style={{
        color: 'white',
        fontSize: '36px',
        fontWeight: 'bold',
        marginRight: '10px',
        textShadow: '2px 2px 5px #000',
      }}>
        认知滤网
      </span>
      <div
        onClick={() => setFilterOn(!filterOn)}
        style={{
          width: '100px',
          height: '40px',
          backgroundColor: filterOn ? '#ffa500' : '#444',
          borderRadius: '35px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '5px',
          cursor: 'pointer',
          boxShadow: filterOn ? '0 0 15px 5px rgba(255,165,0,0.6)' : '0 0 5px rgba(0,0,0,0.5)',
          position: 'relative',
        }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: filterOn ? 'calc(100% - 40px)' : '0px',
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
          transition: 'left 0.3s ease',
        }}>
          {filterOn ? 'ON' : 'OFF'}
        </div>
      </div>
    </div>
  );
}
