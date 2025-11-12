// components/Cutscene.tsx

import React, { useEffect, useState, useRef } from 'react';
import { Pokemon, PokemonRarity } from '../types';

interface CutsceneProps {
  pokemon: Pokemon;
  onEnd: () => void;
}

const Cutscene: React.FC<CutsceneProps> = ({ pokemon, onEnd }) => {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isSPlus = pokemon.rarity === PokemonRarity.S_PLUS;
  const duration = isSPlus ? 5000 : 4000; // 5s for S+, 4s for S
  const fadeOutDuration = 500;

  useEffect(() => {
    // --- Audio setup and fade-in ---
    const source = isSPlus
      ? '/challenger-348770.mp3'
      : '/kanec-348765.mp3';
      
    const audio = new Audio(source);
    audioRef.current = audio;
    audio.volume = 0;
    audio.play().catch(e => console.error("Audio playback failed. User interaction may be required.", e));

    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    fadeIntervalRef.current = setInterval(() => {
      if (audio.volume < 0.99) {
        audio.volume = Math.min(1, audio.volume + 0.1);
      } else {
        audio.volume = 1;
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      }
    }, 100); // Fade in over 1s

    // --- Scene end logic ---
    const handleEndScene = () => {
      // Prevent re-triggering
      window.removeEventListener('keydown', handleKeyDown);

      setIsFadingOut(true);

      // Fade out audio
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      if (audioRef.current) {
        const currentAudio = audioRef.current;
        fadeIntervalRef.current = setInterval(() => {
          if (currentAudio.volume > 0.1) {
            currentAudio.volume = Math.max(0, currentAudio.volume - 0.1);
          } else {
            currentAudio.pause();
            if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          }
        }, 50); // Fade out over ~500ms
      }
      
      // Inform parent component to unmount this component after fade-out
      setTimeout(onEnd, fadeOutDuration);
    };

    const sceneTimer = setTimeout(handleEndScene, duration);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') {
        clearTimeout(sceneTimer);
        handleEndScene();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // --- Cleanup on unmount ---
    return () => {
      clearTimeout(sceneTimer);
      window.removeEventListener('keydown', handleKeyDown);
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      if (audioRef.current) {
        // Immediate stop on abrupt unmount
        audioRef.current.pause();
        audioRef.current.src = ''; // Release resource
      }
    };
  }, [pokemon, onEnd, duration, isSPlus]);

  const sRankStyles = {
    gradient: 'from-blue-500 via-sky-300 to-white',
    textColor: 'text-blue-900',
    badgeGlow: 's-rank-glow-shadow',
    label: 'EPIC DISCOVERY!',
  };

  const sPlusRankStyles = {
    gradient: 'from-purple-800 via-indigo-500 to-yellow-300',
    textColor: 'text-yellow-200',
    badgeGlow: 's-plus-rank-glow-shadow',
    label: 'LEGENDARY DISCOVERY!',
  };

  const styles = isSPlus ? sPlusRankStyles : sRankStyles;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br p-4 transition-opacity duration-500 ${styles.gradient} ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}
      role="dialog"
      aria-modal="true"
      aria-label="New Pokémon Discovery"
    >
      <div className="relative animate-cutscene-image-reveal">
        <img
          src={`data:image/png;base64,${pokemon.imageBase64}`}
          alt={pokemon.name}
          className="w-64 h-64 sm:w-80 sm:h-80 object-contain drop-shadow-2xl"
        />
      </div>

      <div className="text-center mt-8 animate-cutscene-text-fade-in">
        <h2 className={`text-3xl sm:text-4xl font-extrabold uppercase tracking-widest ${styles.textColor} drop-shadow-lg`}>
          {styles.label}
        </h2>
        <p className={`mt-2 text-xl sm:text-2xl font-semibold ${styles.textColor} opacity-90`}>
          You obtained {pokemon.name}!
        </p>
      </div>

      <div className={`absolute top-5 sm:top-10 text-7xl sm:text-9xl font-black text-white animate-cutscene-badge-drop-in ${styles.badgeGlow}`}>
        {pokemon.rarity}
      </div>

      <button onClick={onEnd} className="absolute bottom-5 right-5 text-white/70 hover:text-white transition-colors text-sm">
        [ESC] Skip
      </button>
    </div>
  );
};

export default Cutscene;