import React from 'react';

interface GameViewProps {
  gameActive: boolean;
  gameStarted: boolean;
  gameLoading: boolean;
  revealedTilesCount: number;
  board: string[];
  revealedTiles: Set<number>;
  gameMessage: string;
  gameResult: string;
  calculateWinnings: (count: number) => number;
  startGame: () => void;
  handleCashOut: () => void;
  handleLogout: () => void;
  handleTileClick: (index: number) => void;
}

const GameView: React.FC<GameViewProps> = React.memo(({
  gameActive,
  gameStarted,
  gameLoading,
  revealedTilesCount,
  board,
  revealedTiles,
  gameMessage,
  gameResult,
  calculateWinnings,
  startGame,
  handleCashOut,
  handleLogout,
  handleTileClick,
}) => {
  const GRID_SIZE = 25;

  return (
    <div className="panel game-view-layout">
      <div className="game-intro">
        <div className="game-title">
          《扫雷游戏》目前雷数量为3最高彩金58
        </div>
        <div className="contact-info">
          中奖私信乐球经理ID：（22222）
        </div>
      </div>
      
      <div className="game-area">
        {gameMessage && (
          <div className="message-box">{gameMessage}</div>
        )}
        <div className="game-grid">
          {Array.from({ length: GRID_SIZE }).map((_, index) => (
            <div
              key={index}
              className={`tile ${revealedTiles.has(index) ? 'revealed' : ''} ${
                revealedTiles.has(index) ? (board[index] === 'mine' ? 'mine' : 'safe') : ''
              }`}
              onClick={() => handleTileClick(index)}
            >
              {revealedTiles.has(index) && (board[index] === 'mine' ? '💣' : '⚽️')}
            </div>
          ))}
        </div>
      </div>
      
      <div className="controls">
        <div className="info-box">
          <div className="label">可领取金额</div>
          <div className={`value winnings-display ${gameActive && revealedTilesCount > 0 ? 'pulse-effect' : ''}`} id="winnings-display">
            {calculateWinnings(revealedTilesCount).toFixed(2)}
          </div>
        </div>
        
        <button
          onClick={startGame}
          className="btn btn-primary"
          disabled={gameStarted || gameLoading}
        >
          <span>{gameLoading ? "开始游戏..." : gameStarted ? (gameActive ? "游戏中..." : "游戏结束") : "开始游戏"}</span>
        </button>
        
        <button
          onClick={handleCashOut}
          className={`btn cashout-btn ${gameActive && revealedTilesCount > 0 ? 'breathe-active' : ''}`}
          disabled={!gameActive || revealedTilesCount === 0 || gameLoading}
        >
          <span>领取奖金</span>
        </button>
        
        {gameResult && (
          <div style={{
            backgroundColor: 'var(--bg-color)',
            padding: '15px',
            borderRadius: 'var(--border-radius)',
            marginTop: '10px',
            border: '2px solid var(--accent-color)',
            textAlign: 'center',
            fontSize: '0.9rem',
            color: 'var(--accent-color)',
            fontWeight: '500'
          }}>
            {gameResult}
          </div>
        )}
        
        <button
          onClick={handleLogout}
          className={`btn btn-danger ${!gameStarted || gameActive || gameLoading ? 'hidden' : ''}`}
        >
          <span>退出游戏</span>
        </button>
      </div>
    </div>
  );
});

GameView.displayName = 'GameView';

export default GameView;