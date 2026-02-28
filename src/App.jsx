import React, { useState, useEffect } from 'react';
import './App.css';
import puzzlesData from './puzzles.json';
import packageJson from '../package.json';
import { useVersionCheck } from './useVersionCheck';
import { useStats } from './useStats';
import StatsModal from './StatsModal';

const MAX_MISTAKES = 4;

function App() {
  const { newVersionAvailable, reload } = useVersionCheck();
  const { stats, recordWin, recordLoss, recordReveal, resetStats, getWinRate, getAverageMistakes } = useStats();
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [puzzleNumberInput, setPuzzleNumberInput] = useState('');
  const [words, setWords] = useState([]);
  const [selected, setSelected] = useState([]);
  const [solved, setSolved] = useState([]);
  const [mistakes, setMistakes] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [statsRecorded, setStatsRecorded] = useState(false);
  
  const currentPuzzle = puzzlesData[currentPuzzleIndex];
  const PUZZLE_DATA = currentPuzzle.categories.map(cat => ({
    category: cat.name,
    words: cat.words,
    difficulty: cat.difficulty,
    color: cat.color
  }));

  // Initialize and shuffle words when puzzle changes
  useEffect(() => {
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
  }, [currentPuzzleIndex]);

  // Check if game is won
  useEffect(() => {
    const actuallySolved = solved.filter(cat => !cat.revealed).length;
    if (actuallySolved === PUZZLE_DATA.length && !statsRecorded) {
      setGameOver(true);
      setMessage('🎉 Congratulations! You won!');
      recordWin(mistakes);
      setStatsRecorded(true);
    }
  }, [solved, statsRecorded]);

  // Check if game is lost
  useEffect(() => {
    if (mistakes >= MAX_MISTAKES && !revealed && !statsRecorded) {
      setGameOver(true);
      setMessage('Game Over! Better luck next time.');
      recordLoss(mistakes);
      setStatsRecorded(true);
      // Reveal all unsolved categories
      const unsolvedCategories = PUZZLE_DATA.filter(
        cat => !solved.some(s => s.category === cat.category)
      );
      setSolved([...solved, ...unsolvedCategories.map(cat => ({ ...cat, revealed: true }))]);
    }
  }, [mistakes, statsRecorded]);

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
        setMessage('One away...');
      } else if (maxMatch === 2) {
        setMessage('Try again!');
      } else {
        setMessage('Not quite. Keep trying!');
      }
      
      setSelected([]);
    }
  }

  function isWordSolved(word) {
    return solved.some(s => s.category === word.category);
  }

  function handlePrevPuzzle() {
    if (currentPuzzleIndex > 0) {
      setCurrentPuzzleIndex(currentPuzzleIndex - 1);
    }
  }

  function handleNextPuzzle() {
    if (currentPuzzleIndex < puzzlesData.length - 1) {
      setCurrentPuzzleIndex(currentPuzzleIndex + 1);
    }
  }

  function handleRandomPuzzle() {
    const randomIndex = Math.floor(Math.random() * puzzlesData.length);
    setCurrentPuzzleIndex(randomIndex);
  }

  function handleResetPuzzle() {
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
      setStatsRecorded(true);
    }
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
      setCurrentPuzzleIndex(puzzleNum - 1);
      setPuzzleNumberInput('');
    }
  }

  return (
    <div className="App">
      {newVersionAvailable && (
        <div className="update-banner">
          <span>A new version is available! </span>
          <button onClick={reload} className="update-button">
            Refresh to Update
          </button>
        </div>
      )}
      <header className="header">
        <h1>Conjakeions+</h1>
        <p className="current-date">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
        <p className="subtitle">
          Create four groups of four! 
          <span className="puzzle-info-inline">
            Puzzle #{currentPuzzle.id} - {currentPuzzle.date}
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
              className={`word-button ${selected.includes(word.text) ? 'selected' : ''}`}
              onClick={() => handleWordClick(word)}
              disabled={gameOver}
            >
              {word.text}
            </button>
          ))}
        </div>

        {/* Mistakes indicator and Stats button */}
        {!gameOver && (
          <div className="bottom-info-row">
            <div className="mistakes-display">
              <span className="mistakes-label">Mistakes Remaining:</span>
              <div className="mistakes-dots">
                {[...Array(MAX_MISTAKES)].map((_, index) => (
                  <div 
                    key={index}
                    className={`mistake-dot ${index < mistakes ? 'used' : ''}`}
                  />
                ))}
              </div>
            </div>
            <button 
              onClick={() => setShowStats(true)}
              className="stats-button-inline"
            >
              📊 Stats
            </button>
          </div>
        )}

        {/* Message */}
        {gameOver && message && (
          <div className={`message ${gameOver ? 'game-over' : ''}`}>
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
          onClose={() => setShowStats(false)}
          onReset={() => {
            if (window.confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
              resetStats();
            }
          }}
        />
      )}
    </div>
  );
}

export default App;
