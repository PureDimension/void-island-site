import { useEffect, useState, useRef } from 'react';

export default function MusicPlayer() {
  const [musicList, setMusicList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    async function fetchMusicList() {
      const res = await fetch('/api/music-list');
      const data = await res.json();
      setMusicList(data);
    }
    fetchMusicList();
  }, []);

  const currentTrack = musicList[currentIndex];

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const nextTrack = () => {
    const nextIndex = (currentIndex + 1) % musicList.length;
    setCurrentIndex(nextIndex);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.play();
    }
  }, [currentIndex]);

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-4 left-4 bg-black text-white border-2 border-white rounded p-4 shadow-lg flex items-center gap-4 z-50">
      {currentTrack.icon && (
        <img
          src={currentTrack.icon}
          alt="Icon"
          className="w-8 h-8 object-cover"
        />
      )}
      <div className="text-sm font-bold">{currentTrack.name}</div>
      <button onClick={togglePlay} className="bg-white text-black px-2 py-1 rounded">
        {isPlaying ? '暂停' : '播放'}
      </button>
      <button onClick={nextTrack} className="bg-gray-300 text-black px-2 py-1 rounded">
        下一首
      </button>
      <audio
        ref={audioRef}
        src={currentTrack.file}
        onEnded={nextTrack}
        preload="auto"
      />
    </div>
  );
}
