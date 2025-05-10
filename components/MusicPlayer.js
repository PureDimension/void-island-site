import { useEffect, useState, useRef, useLayoutEffect } from "react";

const formatTime = (sec) => {
	if (!sec || isNaN(sec)) return "0:00";
	const m = Math.floor(sec / 60);
	const s = Math.floor(sec % 60)
		.toString()
		.padStart(2, "0");
	return `${m}:${s}`;
};

const playModes = [
	{
		mode: "repeat-all",
		icon: (
			// Material Symbols: Repeat
			<svg
				viewBox="0 0 24 24"
				fill="none"
				className="w-5 h-5 inline"
				stroke="currentColor"
				strokeWidth="1.5"
			>
				<path
					d="M7 7V5a1 1 0 0 1 1-1h8m0 0 2 2m-2-2 2-2m-2 2H8a3 3 0 0 0-3 3v2"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M17 17v2a1 1 0 0 1-1 1H8m0 0-2-2m2 2-2 2m2-2h8a3 3 0 0 0 3-3v-2"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		),
		title: "列表循环",
	},
	{
		mode: "repeat-one",
		icon: (
			// Material Symbols: Repeat One
			<svg
				viewBox="0 0 24 24"
				fill="none"
				className="w-5 h-5 inline"
				stroke="currentColor"
				strokeWidth="1.5"
			>
				<path
					d="M7 7V5a1 1 0 0 1 1-1h8m0 0 2 2m-2-2 2-2m-2 2H8a3 3 0 0 0-3 3v2"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M17 17v2a1 1 0 0 1-1 1H8m0 0-2-2m2 2-2 2m2-2h8a3 3 0 0 0 3-3v-2"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<text
					x="12"
					y="16"
					textAnchor="middle"
					fontSize="8"
					fill="currentColor"
				>
					1
				</text>
			</svg>
		),
		title: "单曲循环",
	},
	{
		mode: "shuffle",
		icon: (
			// Material Symbols: Shuffle
			<svg
				viewBox="0 0 24 24"
				fill="none"
				className="w-5 h-5 inline"
				stroke="currentColor"
				strokeWidth="1.5"
			>
				<path
					d="M16 3h5v5"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M4 20l16-16"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M21 16v5h-5"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M15 15l6 6"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		),
		title: "随机播放",
	},
];

// 在线图标按钮
const IconButton = ({ onClick, title, children, className }) => (
	<button
		onClick={onClick}
		title={title}
		className={`p-1.5 bg-transparent hover:bg-gray-700 rounded-full flex items-center justify-center ${
			className || ""
		}`}
		type="button"
	>
		{children}
	</button>
);

export default function MusicPlayer() {
	const [musicList, setMusicList] = useState([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [playModeIdx, setPlayModeIdx] = useState(0); // 0: repeat-all, 1: repeat-one, 2: shuffle
	const audioRef = useRef(null);
	const nameBoxRef = useRef(null);
	const nameTextRef = useRef(null);
	const [shouldScroll, setShouldScroll] = useState(false);
	const currentTrack = musicList[currentIndex];

	useLayoutEffect(() => {
		if (nameBoxRef.current && nameTextRef.current && currentTrack) {
			setShouldScroll(
				nameTextRef.current.scrollWidth > nameBoxRef.current.offsetWidth
			);
		}
	}, [currentTrack?.name]);

	useEffect(() => {
		async function fetchMusicList() {
			const res = await fetch("/api/music-list");
			const data = await res.json();
			setMusicList(data);
		}
		fetchMusicList();
	}, []);

	// 自动播放新歌
	useEffect(() => {
		if (audioRef.current && isPlaying) {
			audioRef.current.play();
		}
		setCurrentTime(0);
	}, [currentIndex]);

	// 切换播放/暂停
	const togglePlay = () => {
		if (!audioRef.current) return;
		if (isPlaying) {
			audioRef.current.pause();
		} else {
			audioRef.current.play();
		}
		setIsPlaying(!isPlaying);
	};

	// 上一首
	const prevTrack = () => {
		if (musicList.length === 0) return;
		let prevIdx;
		if (playModes[playModeIdx].mode === "shuffle" && musicList.length > 1) {
			do {
				prevIdx = Math.floor(Math.random() * musicList.length);
			} while (prevIdx === currentIndex);
		} else {
			prevIdx = (currentIndex - 1 + musicList.length) % musicList.length;
		}
		setCurrentIndex(prevIdx);
		setIsPlaying(true);
	};

	// 下一首
	const nextTrack = () => {
		if (musicList.length === 0) return;
		let nextIdx;
		if (playModes[playModeIdx].mode === "shuffle" && musicList.length > 1) {
			do {
				nextIdx = Math.floor(Math.random() * musicList.length);
			} while (nextIdx === currentIndex);
		} else {
			nextIdx = (currentIndex + 1) % musicList.length;
		}
		setCurrentIndex(nextIdx);
		setIsPlaying(true);
	};

	// 切换播放模式
	const togglePlayMode = () => {
		setPlayModeIdx((playModeIdx + 1) % playModes.length);
	};

	// 进度条拖动
	const handleProgressChange = (e) => {
		const val = Number(e.target.value);
		if (audioRef.current) {
			audioRef.current.currentTime = val;
			setCurrentTime(val);
		}
	};

	// 音频事件
	const onTimeUpdate = () => {
		if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
	};
	const onLoadedMetadata = () => {
		if (audioRef.current) setDuration(audioRef.current.duration);
	};
	const onEnded = () => {
		if (playModes[playModeIdx].mode === "repeat-one") {
			audioRef.current.currentTime = 0;
			audioRef.current.play();
		} else {
			nextTrack();
		}
	};

	if (!currentTrack) return null;

	return (
		<div className="fixed bottom-4 left-4 bg-black text-white border-2 border-white rounded p-4 shadow-lg flex items-center gap-4 z-50 min-w-[320px] max-w-[480px]">
			{currentTrack.icon && (
				<img
					src={currentTrack.icon}
					alt="Icon"
					className="w-8 h-8 object-cover rounded"
				/>
			)}
			<div
				className="relative max-w-[80px] overflow-hidden h-5"
				ref={nameBoxRef}
			>
				<span
					ref={nameTextRef}
					className={`inline-block whitespace-nowrap transition-all ${
						shouldScroll ? "animate-marquee" : ""
					}`}
				>
					{currentTrack.name}
				</span>
			</div>
			<IconButton onClick={prevTrack} title="上一首">
				{/* Tabler: Player Skip Back */}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					className="w-5 h-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M4 6v12M20 6l-8 6 8 6V6z" />
				</svg>
			</IconButton>
			<IconButton onClick={togglePlay} title={isPlaying ? "暂停" : "播放"}>
				{isPlaying ? (
					// Tabler: Player Pause
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="w-6 h-6"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<rect x="6" y="5" width="4" height="14" rx="1" />
						<rect x="14" y="5" width="4" height="14" rx="1" />
					</svg>
				) : (
					// Tabler: Player Play
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="w-6 h-6"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<polygon points="5 3 19 12 5 21 5 3" />
					</svg>
				)}
			</IconButton>
			<IconButton onClick={nextTrack} title="下一首">
				{/* Tabler: Player Skip Forward */}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					className="w-5 h-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M20 18V6M4 6l8 6-8 6V6z" />
				</svg>
			</IconButton>
			<div className="flex items-center gap-1 w-32">
				<span className="text-xs w-8 text-right">
					{formatTime(currentTime)}
				</span>
				<input
					type="range"
					min="0"
					max={duration || 0}
					value={currentTime}
					onChange={handleProgressChange}
					className="w-16 h-1 accent-pink-500 bg-gray-700 rounded-lg"
				/>
				<span className="text-xs w-8 text-left">{formatTime(duration)}</span>
			</div>
			<IconButton onClick={togglePlayMode} title={playModes[playModeIdx].title}>
				{playModes[playModeIdx].icon}
			</IconButton>
			<audio
				ref={audioRef}
				src={currentTrack.file}
				onTimeUpdate={onTimeUpdate}
				onLoadedMetadata={onLoadedMetadata}
				onEnded={onEnded}
				preload="auto"
			/>
		</div>
	);
}
