import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Mic } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AudioPlayerProps {
    audioUrl: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl }) => {
    const { t } = useTranslation();
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
        };

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    const formatTime = (seconds: number): string => {
        if (!isFinite(seconds) || isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const togglePlay = async () => {
        const audio = audioRef.current;
        if (!audio) return;

        try {
            if (isPlaying) {
                audio.pause();
                setIsPlaying(false);
            } else {
                await audio.play();
                setIsPlaying(true);
            }
        } catch (error) {
            // Handle play() promise rejection (e.g., user hasn't interacted with page)
            if (import.meta.env.DEV) {
                console.warn('Audio playback failed:', error);
            }
            setIsPlaying(false);
        }
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio || !duration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const clickPosition = (e.clientX - rect.left) / rect.width;
        const newTime = clickPosition * duration;
        audio.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (!audio) return;

        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        audio.volume = newVolume;
        setIsMuted(newVolume === 0);
    };

    const toggleMute = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isMuted) {
            audio.volume = volume || 1;
            setIsMuted(false);
        } else {
            audio.volume = 0;
            setIsMuted(true);
        }
    };

    const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const audio = audioRef.current;
        if (!audio) return;

        const newRate = parseFloat(e.target.value);
        setPlaybackRate(newRate);
        audio.playbackRate = newRate;
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <audio ref={audioRef} src={audioUrl} preload="metadata" />

            {/* Header */}
            <div className="flex items-center gap-3 mb-3 text-slate-300">
                <Mic size={18} className="text-red-400" />
                <span className="text-sm font-bold">{t('crisis.audioSaved')}</span>
            </div>

            {/* Progress bar with scrubbing */}
            <div
                className="relative h-2 bg-slate-700 rounded cursor-pointer mb-4 group"
                onClick={handleSeek}
            >
                <div
                    className="absolute h-full bg-cyan-500 rounded transition-all"
                    style={{ width: `${progressPercent}%` }}
                />
                {/* Hover indicator */}
                <div
                    className="absolute w-3 h-3 bg-cyan-400 rounded-full -top-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: `calc(${progressPercent}% - 6px)` }}
                />
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-4">
                {/* Play/Pause button */}
                <button
                    onClick={togglePlay}
                    className="w-10 h-10 bg-cyan-600 hover:bg-cyan-500 rounded-full flex items-center justify-center transition-colors"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? (
                        <Pause size={18} fill="currentColor" />
                    ) : (
                        <Play size={18} fill="currentColor" className="ml-0.5" />
                    )}
                </button>

                {/* Time display */}
                <span className="text-sm font-mono text-slate-300 min-w-[90px]">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                {/* Volume control */}
                <div className="flex items-center gap-2 flex-1">
                    <button
                        onClick={toggleMute}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                        aria-label={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-20 h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-cyan-500"
                        aria-label="Volume"
                    />
                </div>

                {/* Playback speed */}
                <select
                    value={playbackRate}
                    onChange={handleSpeedChange}
                    className="bg-slate-700 text-slate-300 text-sm rounded px-2 py-1 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    aria-label="Playback speed"
                >
                    <option value="0.5">0.5x</option>
                    <option value="0.75">0.75x</option>
                    <option value="1">1x</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2">2x</option>
                </select>
            </div>
        </div>
    );
};
