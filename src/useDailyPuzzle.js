import { useState, useEffect } from 'react';

/**
 * Normalize date to YYYY-MM-DD format for comparison
 * Note: Fixed infinite loop in useEffect (v2.16.36) - use [puzzles.length] not [puzzles]
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
 * Note: puzzles should be a stable reference (from useState) to avoid infinite re-renders
 */
export const useDailyPuzzle = (puzzles) => {
  const [dailyPuzzleIndex, setDailyPuzzleIndex] = useState(() => 
    getDailyPuzzleIndex(puzzles)
  );
  const [isPlayingDaily, setIsPlayingDaily] = useState(true);

  // Update daily puzzle index when puzzles are loaded
  // This only runs once when puzzles.length changes from 0 to populated
  useEffect(() => {
    if (puzzles && puzzles.length > 0) {
      const newIndex = getDailyPuzzleIndex(puzzles);
      setDailyPuzzleIndex(newIndex);
    }
    // NOTE: Only using puzzles.length to avoid infinite loop
    // puzzles comes from App state and should be stable after initial fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzles.length]);

  // Set up midnight reload timer
  // Runs when puzzles load (length changes from 0 to populated)
  // Timer just reloads the page, doesn't access puzzles, so safe to use length-only dep
  useEffect(() => {
    if (!puzzles || puzzles.length === 0) return;
    
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
    // Only puzzles.length: we don't access puzzles content in timer, just reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
