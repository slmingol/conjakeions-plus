import { useState, useEffect } from 'react';

const STATS_KEY = 'conjakeions-plus-stats';

const getDefaultStats = () => ({
  gamesPlayed: 0,
  gamesWon: 0,
  gamesLost: 0,
  currentStreak: 0,
  maxStreak: 0,
  totalMistakes: 0,
  gamesRevealed: 0,
});

const loadStats = () => {
  try {
    const stored = localStorage.getItem(STATS_KEY);
    if (stored) {
      return { ...getDefaultStats(), ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
  return getDefaultStats();
};

const saveStats = (stats) => {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Error saving stats:', error);
  }
};

export const useStats = () => {
  const [stats, setStats] = useState(loadStats);

  const recordWin = (mistakes) => {
    const newStats = {
      ...stats,
      gamesPlayed: stats.gamesPlayed + 1,
      gamesWon: stats.gamesWon + 1,
      currentStreak: stats.currentStreak + 1,
      maxStreak: Math.max(stats.maxStreak, stats.currentStreak + 1),
      totalMistakes: stats.totalMistakes + mistakes,
    };
    setStats(newStats);
    saveStats(newStats);
  };

  const recordLoss = (mistakes) => {
    const newStats = {
      ...stats,
      gamesPlayed: stats.gamesPlayed + 1,
      gamesLost: stats.gamesLost + 1,
      currentStreak: 0,
      totalMistakes: stats.totalMistakes + mistakes,
    };
    setStats(newStats);
    saveStats(newStats);
  };

  const recordReveal = (mistakes) => {
    const newStats = {
      ...stats,
      gamesPlayed: stats.gamesPlayed + 1,
      gamesRevealed: stats.gamesRevealed + 1,
      currentStreak: 0,
      totalMistakes: stats.totalMistakes + mistakes,
    };
    setStats(newStats);
    saveStats(newStats);
  };

  const resetStats = () => {
    const newStats = getDefaultStats();
    setStats(newStats);
    saveStats(newStats);
  };

  const getWinRate = () => {
    if (stats.gamesPlayed === 0) return 0;
    return Math.round((stats.gamesWon / stats.gamesPlayed) * 100);
  };

  const getAverageMistakes = () => {
    if (stats.gamesPlayed === 0) return 0;
    return (stats.totalMistakes / stats.gamesPlayed).toFixed(1);
  };

  return {
    stats,
    recordWin,
    recordLoss,
    recordReveal,
    resetStats,
    getWinRate,
    getAverageMistakes,
  };
};
