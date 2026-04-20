import { useState, useEffect, useRef } from 'react';

/**
 * Normalize date to YYYY-MM-DD format for comparison (uses local timezone)
 * Note: Fixed infinite loop in useEffect (v2.16.36) - use [puzzles.length] not [puzzles]
 */
const normalizeDate = (dateStr) => {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    // Use local timezone, not UTC, to match user's current day
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
  // Use local timezone format for comparison
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  
  // Try to find exact date match (normalize puzzle dates for comparison)
  const exactMatch = puzzles.findIndex(p => normalizeDate(p.date) === todayStr);
  if (exactMatch !== -1) {
    return exactMatch;
  }
  
  // If no exact match, find the most recent puzzle (latest date <= today)
  // Start by assuming the last puzzle in the array is the most recent
  let latestIndex = puzzles.length - 1;
  let latestDate = new Date(normalizeDate(puzzles[latestIndex].date));
  
  // If the last puzzle is in the future, search backwards for the most recent past/today puzzle
  if (latestDate > today) {
    for (let i = puzzles.length - 1; i >= 0; i--) {
      const puzzleDate = new Date(normalizeDate(puzzles[i].date));
      if (puzzleDate <= today) {
        latestIndex = i;
        break;
      }
    }
  }
  
  return latestIndex;
};

/**
 * Hook to manage daily puzzle state
 * Calculate daily index once when puzzles loads, never update during session
 */
export const useDailyPuzzle = (puzzles) => {
  const [dailyPuzzleIndex, setDailyPuzzleIndex] = useState(0);
  const [isPlayingDaily, setIsPlayingDaily] = useState(true);
  const hasInitialized = useRef(false);

  // Calculate daily puzzle index ONCE when puzzles first loads
  // Using a ref to ensure this only happens once, ever
  useEffect(() => {
    if (puzzles.length > 0 && !hasInitialized.current) {
      setDailyPuzzleIndex(getDailyPuzzleIndex(puzzles));
      hasInitialized.current = true;
    }
  }, [puzzles.length]); // Only depend on length, not the full array

  // Set up midnight reload timer (runs once on mount)
  useEffect(() => {
    if (puzzles.length === 0) return;
    
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow - now;
    
    const timer = setTimeout(() => {
      // Reload the page to reset the game at midnight
      window.location.reload();
    }, msUntilMidnight);
    
    return () => clearTimeout(timer);
  }, []); // Empty deps - set timer once on mount

  const returnToDaily = () => {
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
