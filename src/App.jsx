import React, { useState, useEffect } from 'react';
import './App.css';
import packageJson from '../package.json';
import { useVersionCheck } from './useVersionCheck';
import { useStats } from './useStats';
import { useGameState } from './useGameState';
import { usePuzzleHistory } from './usePuzzleHistory';
import { useTheme } from './useTheme';
import { useDailyPuzzle } from './useDailyPuzzle';
import StatsModal from './StatsModal';

const MAX_MISTAKES = 4;

function App() {
  const [puzzlesData, setPuzzlesData] = useState([]);
  const [isLoadingPuzzles, setIsLoadingPuzzles] = useState(true);
  
  // Fetch puzzles dynamically at runtime to pick up scheduler updates
  useEffect(() => {
    fetch('/puzzles.json')
      .then(res => res.json())
      .then(data => {
        setPuzzlesData(data);
        setIsLoadingPuzzles(false);
      })
      .catch(err => {
        console.error('Failed to load puzzles:', err);
        // Fallback to empty array
        setPuzzlesData([]);
        setIsLoadingPuzzles(false);
      });
  }, []);
  
  const { newVersionAvailable, reload } = useVersionCheck();
  const { stats, recordWin, recordLoss, recordReveal, resetStats, getWinRate, getAverageMistakes } = useStats();
  const { savedState, saveState, clearState } = useGameState();
  const { recordAttempt, recordCompletion, getPuzzleStats, hasPlayedBefore, hasWonBefore, getTotalPuzzlesAttempted, getTotalPuzzlesWon, resetHistory } = usePuzzleHistory();
  const { theme, setTheme } = useTheme();
  const { dailyPuzzleIndex, isPlayingDaily, returnToDaily, setBrowseMode } = useDailyPuzzle(puzzlesData);
  
  // Initialize with daily puzzle if no saved state, otherwise use saved state
  const initialPuzzleIndex = savedState.currentPuzzleIndex !== 0 || savedState.solved.length > 0 || savedState.mistakes > 0
    ? savedState.currentPuzzleIndex
    : dailyPuzzleIndex;
  
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(initialPuzzleIndex);
  const [puzzleNumberInput, setPuzzleNumberInput] = useState('');
  const [words, setWords] = useState([]);
  const [selected, setSelected] = useState([]);
  const [solved, setSolved] = useState(savedState.solved);
  const [mistakes, setMistakes] = useState(savedState.mistakes);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState('');
  const [revealed, setRevealed] = useState(savedState.revealed);
  const [showStats, setShowStats] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [statsRecorded, setStatsRecorded] = useState(false);
  const [puzzleAttemptRecorded, setPuzzleAttemptRecorded] = useState(false);
  const [proximityHighlight, setProximityHighlight] = useState([]);
  
  // Get current puzzle data (safe to access even when loading)
  const currentPuzzle = puzzlesData.length > 0 ? puzzlesData[currentPuzzleIndex] : null;
  const PUZZLE_DATA = currentPuzzle ? currentPuzzle.categories.map(cat => ({
    category: cat.name,
    words: cat.words,
    difficulty: cat.difficulty,
    color: cat.color
  })) : [];

  // Initialize and shuffle words when puzzle changes
  useEffect(() => {
    if (!currentPuzzle) return; // Skip if no puzzle loaded yet
    
    const allWords = PUZZLE_DATA.flatMap(cat => 
      cat.words.map(word => ({
        text: word,
        category: cat.category,
        difficulty: cat.difficulty,
        color: cat.color
      }))
    );
    
    // Check if we're resuming a saved game
    const isResumingSavedGame = 
      savedState.currentPuzzleIndex === currentPuzzleIndex && 
      (savedState.solved.length > 0 || savedState.mistakes > 0);
    
    if (isResumingSavedGame) {
      // Restore saved state
      setWords(shuffleArray(allWords));
      // solved and mistakes are already set from savedState in initial state
      setPuzzleAttemptRecorded(false); // Allow recording attempt for resumed game
      setMessage('♻️ Resuming saved game...');
      // Clear the resume message after 3 seconds
      setTimeout(() => {
        setMessage('');
      }, 3000);
    } else {
      // Start fresh
      setWords(shuffleArray(allWords));
      setSolved([]);
      setSelected([]);
      setMistakes(0);
      setGameOver(false);
      setMessage('');
      setRevealed(false);
      setStatsRecorded(false);
      setPuzzleAttemptRecorded(false);
      setProximityHighlight([]);
    }
  }, [currentPuzzleIndex]);

  // Record puzzle attempt when user starts playing
  useEffect(() => {
    if (!currentPuzzle) return; // Skip if puzzle not loaded
    if (!puzzleAttemptRecorded && solved.length === 0 && mistakes === 0) {
      recordAttempt(currentPuzzle.id);
      setPuzzleAttemptRecorded(true);
    }
  }, [currentPuzzle, puzzleAttemptRecorded, solved.length, mistakes]);

  // Save game state whenever it changes
  useEffect(() => {
    saveState(currentPuzzleIndex, solved, mistakes, revealed, gameOver);
  }, [currentPuzzleIndex, solved, mistakes, revealed, gameOver]);

  // Check if game is won
  useEffect(() => {
    if (!currentPuzzle) return; // Skip if puzzle not loaded
    const actuallySolved = solved.filter(cat => !cat.revealed).length;
    if (actuallySolved === PUZZLE_DATA.length && !statsRecorded) {
      setGameOver(true);
      setMessage('🎉 Congratulations! You won!');
      recordWin(mistakes);
      recordCompletion(currentPuzzle.id, mistakes, true); // Record puzzle completion
      setStatsRecorded(true);
      clearState(); // Clear saved state on win
    }
  }, [solved, statsRecorded, currentPuzzle]);

  // Check if game is lost
  useEffect(() => {
    if (!currentPuzzle) return; // Skip if puzzle not loaded
    if (mistakes >= MAX_MISTAKES && !revealed && !statsRecorded) {
      setGameOver(true);
      setMessage('Game Over! Better luck next time.');
      recordLoss(mistakes);
      recordCompletion(currentPuzzle.id, mistakes, false); // Record puzzle completion (loss)
      setStatsRecorded(true);
      clearState(); // Clear saved state on loss
      // Reveal all unsolved categories
      const unsolvedCategories = PUZZLE_DATA.filter(
        cat => !solved.some(s => s.category === cat.category)
      );
      setSolved([...solved, ...unsolvedCategories.map(cat => ({ ...cat, revealed: true }))]);
    }
  }, [mistakes, statsRecorded, currentPuzzle]);

  // Close stats modal on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showStats) {
        setShowStats(false);
      }
    };
    
    if (showStats) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [showStats]);

  // Close admin modal on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showAdmin) {
        setShowAdmin(false);
      }
    };
    
    if (showAdmin) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [showAdmin]);

  function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  function handleWordClick(word) {
    if (gameOver || solved.some(s => s.category === word.category)) {
      return;
    }

    if (selected.includes(word.text)) {
      setSelected(selected.filter(w => w !== word.text));
    } else if (selected.length < 4) {
      setSelected([...selected, word.text]);
    }
  }

  function handleShuffle() {
    const unsolvedWords = words.filter(
      w => !solved.some(s => s.category === w.category)
    );
    const solvedWords = words.filter(
      w => solved.some(s => s.category === w.category)
    );
    setWords([...solvedWords, ...shuffleArray(unsolvedWords)]);
    setMessage('');
  }

  function handleClear() {
    setSelected([]);
    setMessage('');
    setProximityHighlight([]);
  }

  function handleSubmit() {
    if (selected.length !== 4) {
      setMessage('Please select exactly 4 words');
      return;
    }

    // Check if selected words form a category
    const selectedWords = words.filter(w => selected.includes(w.text));
    const categories = [...new Set(selectedWords.map(w => w.category))];

    if (categories.length === 1) {
      // Correct guess!
      const category = categories[0];
      const categoryData = PUZZLE_DATA.find(c => c.category === category);
      setSolved([...solved, categoryData]);
      setSelected([]);
      setMessage('Correct! 🎊');
      
      // Remove solved words from the grid
      setTimeout(() => {
        const remainingWords = words.filter(
          w => w.category !== category
        );
        setWords(remainingWords);
        setMessage('');
      }, 1000);
    } else {
      // Check how many words match each category for better feedback
      const categoryCounts = {};
      selectedWords.forEach(w => {
        categoryCounts[w.category] = (categoryCounts[w.category] || 0) + 1;
      });
      
      const maxMatch = Math.max(...Object.values(categoryCounts));
      
      setMistakes(mistakes + 1);
      
      if (maxMatch === 3) {
        // Find the category with 3 matches
        const matchedCategory = Object.entries(categoryCounts).find(([cat, count]) => count === 3)?.[0];
        if (matchedCategory) {
          // Highlight the 3 correct words
          const correctWords = selectedWords.filter(w => w.category === matchedCategory).map(w => w.text);
          setProximityHighlight(correctWords);
        }
        setMessage('🔥 One away!');
      } else if (maxMatch === 2) {
        setMessage('💡 Two away!');
      } else {
        setMessage('Not quite. Keep trying!');
      }
      
      // Auto-clear message and highlights after 3.5 seconds
      setTimeout(() => {
        setMessage('');
        setProximityHighlight([]);
      }, 3500);
      
      setSelected([]);
    }
  }

  function isWordSolved(word) {
    return solved.some(s => s.category === word.category);
  }

  function handlePrevPuzzle() {
    if (currentPuzzleIndex > 0) {
      clearState(); // Clear saved state when manually changing puzzles
      setBrowseMode(); // Switch to browse mode
      setCurrentPuzzleIndex(currentPuzzleIndex - 1);
    }
  }

  function handleNextPuzzle() {
    if (currentPuzzleIndex < puzzlesData.length - 1) {
      clearState(); // Clear saved state when manually changing puzzles
      setBrowseMode(); // Switch to browse mode
      setCurrentPuzzleIndex(currentPuzzleIndex + 1);
    }
  }

  function handleRandomPuzzle() {
    clearState(); // Clear saved state when manually changing puzzles
    setBrowseMode(); // Switch to browse mode
    const randomIndex = Math.floor(Math.random() * puzzlesData.length);
    setCurrentPuzzleIndex(randomIndex);
  }

  function handleResetPuzzle() {
    clearState(); // Clear saved state when resetting
    // Reset current puzzle
    const allWords = PUZZLE_DATA.flatMap(cat => 
      cat.words.map(word => ({
        text: word,
        category: cat.category,
        difficulty: cat.difficulty,
        color: cat.color
      }))
    );
    setWords(shuffleArray(allWords));
    setSolved([]);
    setSelected([]);
    setMistakes(0);
    setGameOver(false);
    setMessage('');
    setRevealed(false);
    setStatsRecorded(false);
  }

  function handleRevealSolution() {
    if (!statsRecorded) {
      recordReveal(mistakes);
      recordCompletion(currentPuzzle.id, mistakes, false); // Record puzzle completion (revealed)
      setStatsRecorded(true);
    }
    clearState(); // Clear saved state when revealing solution
    setRevealed(true);
    setGameOver(true);
    setMessage('Solution revealed');
    // Reveal all unsolved categories
    const unsolvedCategories = PUZZLE_DATA.filter(
      cat => !solved.some(s => s.category === cat.category)
    );
    setSolved([...solved, ...unsolvedCategories.map(cat => ({ ...cat, revealed: true }))]);
  }

  function handleJumpToPuzzle(e) {
    e.preventDefault();
    const puzzleNum = parseInt(puzzleNumberInput);
    if (!isNaN(puzzleNum) && puzzleNum >= 1 && puzzleNum <= puzzlesData.length) {
      clearState(); // Clear saved state when jumping to a new puzzle
      setBrowseMode(); // Switch to browse mode
      setCurrentPuzzleIndex(puzzleNum - 1);
      setPuzzleNumberInput('');
    }
  }

  function handleReturnToDaily() {
    clearState();
    const dailyIndex = returnToDaily();
    setCurrentPuzzleIndex(dailyIndex);
  }

  return (
    <div className="App">
      {/* Show loading state while puzzles are being fetched */}
      {(isLoadingPuzzles || puzzlesData.length === 0) ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          fontSize: '1.5rem',
          color: '#666'
        }}>
          {isLoadingPuzzles ? 'Loading puzzles...' : 'No puzzles available'}
        </div>
      ) : (
        <>
      {newVersionAvailable && (
        <div className="update-banner">
          <span>A new version is available! </span>
          <button onClick={reload} className="update-button">
            Refresh to Update
          </button>
        </div>
      )}
      <header className="header">
        <div className="header-title">
          <img src="/logo.png" alt="Conjakeions+ Logo" className="logo" />
          <h1>Conjakeions+</h1>
        </div>
        <p className="current-date">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
          {isPlayingDaily ? (
            <span className="daily-badge">📅 Today's Daily Puzzle</span>
          ) : (
            <span className="browse-badge">
              📚 Browse Mode
              <button 
                onClick={handleReturnToDaily}
                className="return-daily-link"
              >
                Return to Today's Puzzle
              </button>
            </span>
          )}
        </p>
        <p className="subtitle">
          Create four groups of four! 
          <span className="puzzle-info-inline">
            Puzzle #{currentPuzzle.id} - {currentPuzzle.date}
            {hasPlayedBefore(currentPuzzle.id) && (
              <span className="puzzle-history-badge">
                {hasWonBefore(currentPuzzle.id) ? ' ✓' : ' ↻'} 
                {getPuzzleStats(currentPuzzle.id).wins}x
              </span>
            )}
          </span>
        </p>
        <div className="puzzle-navigation">
          <button 
            onClick={handlePrevPuzzle} 
            disabled={currentPuzzleIndex === 0}
            className="nav-button"
          >
            ← Previous
          </button>
          <span className="puzzle-counter">
            {currentPuzzleIndex + 1} / {puzzlesData.length}
          </span>
          <button 
            onClick={handleNextPuzzle} 
            disabled={currentPuzzleIndex === puzzlesData.length - 1}
            className="nav-button"
          >
            Next →
          </button>
          <button 
            onClick={handleRandomPuzzle}
            className="nav-button random"
          >
            🎲 Random
          </button>
          <form onSubmit={handleJumpToPuzzle} className="puzzle-jump">
            <input
              type="number"
              min="1"
              max={puzzlesData.length}
              value={puzzleNumberInput}
              onChange={(e) => setPuzzleNumberInput(e.target.value)}
              placeholder="Jump to #"
              className="puzzle-input"
            />
            <button type="submit" className="nav-button jump">
              Go
            </button>
          </form>
        </div>
      </header>

      <main className="game-container">
        {/* Solved categories */}
        {solved.map((cat, idx) => (
          <div 
            key={idx}
            className={`solved-category ${cat.revealed ? 'revealed' : ''}`}
            style={{ backgroundColor: cat.color }}
          >
            <div className="category-name">{cat.category}</div>
            <div className="category-words">{cat.words.join(', ')}</div>
          </div>
        ))}

        {/* Word grid */}
        <div className="word-grid">
          {words.filter(w => !isWordSolved(w)).map((word, idx) => (
            <button
              key={idx}
              className={`word-button ${selected.includes(word.text) ? 'selected' : ''} ${proximityHighlight.includes(word.text) ? 'proximity-highlight' : ''}`}
              onClick={() => handleWordClick(word)}
              disabled={gameOver}
            >
              {word.text}
            </button>
          ))}
        </div>

        {/* Mistakes indicator, Admin and Stats buttons */}
        {!gameOver && (
          <div className="bottom-info-row">
            <button 
              onClick={() => setShowAdmin(true)}
              className="admin-button-inline"
              title="Admin Options"
            >
              ⚙️ Admin
            </button>
            <div className="mistakes-display">
              <span className="mistakes-label">Mistakes Remaining:</span>
              <span className="mistakes-number">❌ {MAX_MISTAKES - mistakes}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <a href="/archive.html" className="stats-button-inline archive-button-inline" title="View all puzzles">
                📚
              </a>
              <button 
                onClick={() => setShowStats(true)}
                className="stats-button-inline"
              >
                📊 Stats
              </button>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className={`message ${gameOver ? 'game-over' : 'hint-popup'}`}>
            {message}
          </div>
        )}

        {/* Control buttons */}
        {!gameOver && (
          <div className="controls">
            <div className="controls-left">
              <button onClick={handleShuffle} className="control-button">
                Shuffle
              </button>
              <button 
                onClick={handleClear} 
                className="control-button"
                disabled={selected.length === 0}
              >
                Clear
              </button>
            </div>
            <button 
              onClick={handleSubmit} 
              className="control-button submit"
              disabled={selected.length !== 4}
            >
              Submit
            </button>
          </div>
        )}

        {/* Reveal Solution button */}
        {!gameOver && (
          <div className="reveal-container">
            <button 
              onClick={handleRevealSolution}
              className="control-button reveal-solution"
            >
              Reveal Solution
            </button>
          </div>
        )}

        {gameOver && (
          <div className="game-over-controls">
            <button 
              onClick={handleResetPuzzle} 
              className="control-button restart"
            >
              Try Again
            </button>
            {currentPuzzleIndex < puzzlesData.length - 1 && (
              <button 
                onClick={handleNextPuzzle} 
                className="control-button next-puzzle"
              >
                Next Puzzle →
              </button>
            )}
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Conjakeions+ v{packageJson.version} © 2026</p>
      </footer>

      {showStats && (
        <StatsModal 
          stats={stats}
          getWinRate={getWinRate}
          getAverageMistakes={getAverageMistakes}
          totalPuzzlesAttempted={getTotalPuzzlesAttempted()}
          totalPuzzlesWon={getTotalPuzzlesWon()}
          onClose={() => setShowStats(false)}
          onReset={() => {
            if (window.confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
              resetStats();
              resetHistory();
              clearState();
              // Reset current game state
              setCurrentPuzzleIndex(0);
              setMistakes(0);
              setSolved([]);
              setSelected([]);
              setGameOver(false);
              setMessage('');
              setRevealed(false);
              setStatsRecorded(false);
              setPuzzleAttemptRecorded(false);
              setShowStats(false);
            }
          }}
        />
      )}

      {showAdmin && (
        <div className="modal-overlay" onClick={() => setShowAdmin(false)}>
          <div className="modal-content admin-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAdmin(false)}>
              ✕
            </button>
            <h2>⚙️ Admin Options</h2>
            <div className="admin-options">
              <div className="admin-option">
                <h3>🎨 Theme</h3>
                <p>Choose your preferred color scheme</p>
                <div className="theme-controls">
                  <button 
                    className={`theme-button ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light')}
                  >
                    ☀️ Light
                  </button>
                  <button 
                    className={`theme-button ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark')}
                  >
                    🌙 Dark
                  </button>
                  <button 
                    className={`theme-button ${theme === 'system' ? 'active' : ''}`}
                    onClick={() => setTheme('system')}
                  >
                    💻 System
                  </button>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="danger-zone">
              <h3 className="danger-zone-title">⚠️ Danger Zone</h3>
              <p className="danger-zone-description">
                These actions are permanent and cannot be undone
              </p>
              
              <div className="danger-zone-options">
                <div className="danger-option">
                  <div className="danger-option-content">
                    <h4>Clear Saved Game</h4>
                    <p>Remove any saved progress for the current puzzle</p>
                  </div>
                  <button 
                    className="danger-action-button"
                    onClick={() => {
                      if (window.confirm('Clear your saved game progress? You will start the current puzzle fresh.')) {
                        clearState();
                        // Reset current puzzle to fresh state
                        handleResetPuzzle();
                        setShowAdmin(false);
                        setMessage('✓ Saved game cleared');
                        setTimeout(() => setMessage(''), 3000);
                      }
                    }}
                  >
                    Clear Game
                  </button>
                </div>
                
                <div className="danger-option">
                  <div className="danger-option-content">
                    <h4>Reset All Data</h4>
                    <p>Clear all statistics, history, and saved games</p>
                  </div>
                  <button 
                    className="danger-action-button severe"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to reset ALL data? This includes statistics, puzzle history, and saved games. This cannot be undone.')) {
                        resetStats();
                        resetHistory();
                        clearState();
                        // Reset to initial state
                        setCurrentPuzzleIndex(0);
                        setMistakes(0);
                        setSolved([]);
                        setSelected([]);
                        setGameOver(false);
                        setMessage('');
                        setRevealed(false);
                        setStatsRecorded(false);
                        setPuzzleAttemptRecorded(false);
                        setShowAdmin(false);
                        setMessage('✓ All data reset');
                        setTimeout(() => setMessage(''), 3000);
                      }
                    }}
                  >
                    Reset All
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

export default App;
