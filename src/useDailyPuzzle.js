import { useState, useEffect } from 'react';

/**
 * Normalize date to YYYY-MM-DD format for comparison
 */
const normalizeDate = (dateStr) => {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
};

/**
 * Find the daily puzzle index by matching today's date with puzzle dates
 * Returns the puzzle that matches today's date, or the most recent puzzle if none match
 */
export const getDailyPuzzleIndex = (puzzles) => {
  // Handle empty puzzles array
  if (!puzzles || puzzles.length === 0) {
    return 0;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Try to find exact date match (normalize puzzle dates for comparison)
  const exactMatch = puzzles.findIndex(p => normalizeDate(p.date) === todayStr);
  if (exactMatch !== -1) {
    return exactMatch;
  }
  
  // If no exact match, find the most recent puzzle (latest date <= today)
  let latestIndex = 0;
  let latestDate = new Date(puzzles[0].date);
  
  for (let i = 1; i < puzzles.length; i++) {
    const puzzleDate = new Date(puzzles[i].date);
    if (puzzleDate <= today && puzzleDate > latestDate) {
      latestDate = puzzleDate;
      latestIndex = i;
    }
  }
  
  return latestIndex;
};

/**
 * Hook to manage daily puzzle state
 */
export const useDailyPuzzle = (puzzles) => {
  const [dailyPuzzleIndex, setDailyPuzzleIndex] = useState(() => 
    getDailyPuzzleIndex(puzzles)
  );
  const [isPlayingDaily, setIsPlayingDaily] = useState(true);

  // Update daily puzzle index when puzzles are loaded
  useEffect(() => {
    if (puzzles && puzzles.length > 0) {
      setDailyPuzzleIndex(getDailyPuzzleIndex(puzzles));
    }
  }, [puzzles.length]);

  // Update daily puzzle at midnight
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow - now;
    
    const timer = setTimeout(() => {
      setDailyPuzzleIndex(getDailyPuzzleIndex(puzzles));
      // Reload the page to reset the game at midnight
      window.location.reload();
    }, msUntilMidnight);
    
    return () => clearTimeout(timer);
  }, [puzzles.length]);

  const returnToDaily = () => {
    setDailyPuzzleIndex(getDailyPuzzleIndex(puzzles));
    setIsPlayingDaily(true);
    return dailyPuzzleIndex;
  };

  const setBrowseMode = () => {
    setIsPlayingDaily(false);
  };

  return {
    dailyPuzzleIndex,
    isPlayingDaily,
    returnToDaily,
    setBrowseMode,
  };
};
