import React from 'react';
import './StatsModal.css';

function StatsModal({ stats, getWinRate, getAverageMistakes, totalPuzzlesAttempted, totalPuzzlesWon, onClose, onReset }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Statistics</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">{stats.gamesPlayed}</div>
            <div className="stat-label">Played</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{getWinRate()}%</div>
            <div className="stat-label">Win Rate</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.currentStreak}</div>
            <div className="stat-label">Current Streak</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.maxStreak}</div>
            <div className="stat-label">Max Streak</div>
          </div>
        </div>

        <div className="puzzle-stats-section">
          <h3>Unique Puzzles</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{totalPuzzlesAttempted}</div>
              <div className="stat-label">Attempted</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{totalPuzzlesWon}</div>
              <div className="stat-label">Won</div>
            </div>
          </div>
        </div>

        <div className="stats-details">
          <div className="detail-row">
            <span className="detail-label">Games Won:</span>
            <span className="detail-value">{stats.gamesWon}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Games Lost:</span>
            <span className="detail-value">{stats.gamesLost}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Solutions Revealed:</span>
            <span className="detail-value">{stats.gamesRevealed}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Average Mistakes:</span>
            <span className="detail-value">{getAverageMistakes()}</span>
          </div>
        </div>

        <div className="modal-actions">
          <button className="reset-stats-button" onClick={onReset}>
            Reset Statistics
          </button>
        </div>
      </div>
    </div>
  );
}

export default StatsModal;
