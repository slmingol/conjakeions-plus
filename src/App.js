import React, { useState, useEffect } from 'react';
import './App.css';
import puzzlesData from './puzzles.json';

const MAX_MISTAKES = 4;

function App() {
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [puzzleNumberInput, setPuzzleNumberInput] = useState('');
  const [words, setWords] = useState([]);
  const [selected, setSelected] = useState([]);
  const [solved, setSolved] = useState([]);
  const [mistakes, setMistakes] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState('');
  
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
  }, [currentPuzzleIndex]);

  // Check if game is won
  useEffect(() => {
    if (solved.length === PUZZLE_DATA.length) {
      setGameOver(true);
      setMessage('🎉 Congratulations! You won!');
    }
  }, [solved]);

  // Check if game is lost
  useEffect(() => {
    if (mistakes >= MAX_MISTAKES) {
      setGameOver(true);
      setMessage('Game Over! Better luck next time.');
    }
  }, [mistakes]);

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
    } else if (categories.length === 2) {
      // Close! 3 out of 4 correct
      setMistakes(mistakes + 1);
      setMessage('One away...');
      setSelected([]);
    } else {
      // Wrong guess
      setMistakes(mistakes + 1);
      setMessage('Not quite. Try again!');
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
      <header className="header">
        <h1>Connections</h1>
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
            className="solved-category"
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

        {/* Mistakes indicator */}
        {!gameOver && (
          <div className="mistakes-container">
            <div className="mistakes">
              {mistakes} Incorrect
            </div>
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
        <p>A Connections game clone © 2026</p>
      </footer>
    </div>
  );
}

export default App;
