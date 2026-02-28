import { useState, useEffect } from 'react';

const PUZZLE_HISTORY_KEY = 'conjakeions-plus-puzzle-history';

const getDefaultHistory = () => ({});

const loadHistory = () => {
  try {
    const stored = localStorage.getItem(PUZZLE_HISTORY_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading puzzle history:', error);
  }
  return getDefaultHistory();
};

const saveHistory = (history) => {
  try {
    localStorage.setItem(PUZZLE_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Error saving puzzle history:', error);
  }
};

export const usePuzzleHistory = () => {
  const [history, setHistory] = useState(loadHistory);

  const recordAttempt = (puzzleId) => {
    const newHistory = {
      ...history,
      [puzzleId]: {
        ...(history[puzzleId] || { attempts: 0, completions: 0, wins: 0, bestMistakes: null }),
        attempts: (history[puzzleId]?.attempts || 0) + 1,
        lastAttempted: Date.now(),
      },
    };
    setHistory(newHistory);
    saveHistory(newHistory);
  };

  const recordCompletion = (puzzleId, mistakes, won) => {
    const current = history[puzzleId] || { attempts: 0, completions: 0, wins: 0, bestMistakes: null };
    
    const newHistory = {
      ...history,
      [puzzleId]: {
        ...current,
        completions: current.completions + 1,
        wins: won ? (current.wins || 0) + 1 : (current.wins || 0),
        lastCompleted: Date.now(),
        bestMistakes: won 
          ? (current.bestMistakes === null 
              ? mistakes 
              : Math.min(current.bestMistakes, mistakes))
          : current.bestMistakes,
        hasWon: current.hasWon || won,
      },
    };
    setHistory(newHistory);
    saveHistory(newHistory);
  };

  const getPuzzleStats = (puzzleId) => {
    return history[puzzleId] || { 
      attempts: 0, 
      completions: 0,
      wins: 0,
      bestMistakes: null,
      hasWon: false,
      lastAttempted: null,
      lastCompleted: null,
    };
  };

  const hasPlayedBefore = (puzzleId) => {
    return history[puzzleId]?.attempts > 0;
  };

  const hasWonBefore = (puzzleId) => {
    return history[puzzleId]?.hasWon === true;
  };

  const resetHistory = () => {
    const newHistory = getDefaultHistory();
    setHistory(newHistory);
    saveHistory(newHistory);
  };

  const getTotalPuzzlesAttempted = () => {
    return Object.keys(history).length;
  };

  const getTotalPuzzlesWon = () => {
    return Object.values(history).filter(p => p.hasWon).length;
  };

  return {
    history,
    recordAttempt,
    recordCompletion,
    getPuzzleStats,
    hasPlayedBefore,
    hasWonBefore,
    resetHistory,
    getTotalPuzzlesAttempted,
    getTotalPuzzlesWon,
  };
};
