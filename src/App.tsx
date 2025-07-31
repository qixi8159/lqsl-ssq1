import React, { useState, useEffect, useCallback } from 'react';
import { 
  getAllGameIds,
  createGameId,
  checkIdExists,
  deleteGameId,
  createGameSession,
  validateSession,
  completeGameSession,
  generateBrowserFingerprint,
  GameId,
  GameSession
} from './lib/supabase';
import LoginPanel from './components/LoginPanel';
import AdminPanel from './components/AdminPanel';
import GameView from './components/GameView';
import { SessionHeartbeat } from './components/SessionHeartbeat';

// Constants
const ADMIN_PASSWORD = 'qixi';
const GRID_SIZE = 25;
const MAX_REWARD = 58;
const MINES_COUNT = 3;

type ViewMode = 'login' | 'admin' | 'game';

const App: React.FC = () => {
  // State management
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string>('');
  const [gameIds, setGameIds] = useState<GameId[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [userIdInput, setUserIdInput] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<string>('');
  
  // 新增会话相关状态
  const [currentSessionToken, setCurrentSessionToken] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  
  // Game state
  const [board, setBoard] = useState<string[]>([]);
  const [gameActive, setGameActive] = useState<boolean>(false);
  const [revealedTilesCount, setRevealedTilesCount] = useState<number>(0);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [showWinPopup, setShowWinPopup] = useState<boolean>(false);
  const [winAmount, setWinAmount] = useState<number>(0);
  const [message, setMessage] = useState<string>('地雷数量固定为 3，祝您好运！');
  const [revealedTiles, setRevealedTiles] = useState<Set<number>>(new Set());
  const [gameResult, setGameResult] = useState<string>('');
  const [previousWinnings, setPreviousWinnings] = useState<number>(0);
  const [gameLoading, setGameLoading] = useState<boolean>(false);
  const [gameMessage, setGameMessage] = useState<string>('');

  // Load game IDs from database
  const loadGameIds = useCallback(async () => {
    setLoading(true);
    const ids = await getAllGameIds();
    setGameIds(ids);
    setLoading(false);
  }, []);

  // Generate random 4-digit ID
  const generateRandomId = useCallback(() => {
    let randomId;
    do {
      randomId = Math.floor(1000 + Math.random() * 9000).toString();
    } while (gameIds.some(gameId => gameId.id === randomId));
    return randomId;
  }, [gameIds]);

  // 处理会话失效
  const handleSessionInvalid = useCallback(() => {
    setGameMessage('会话已失效，游戏已在其他浏览器中进行或已结束');
    setGameActive(false);
    setCurrentSessionToken(null);
    setCurrentSession(null);
    
    // 显示所有格子
    const allTiles = new Set<number>();
    for (let i = 0; i < GRID_SIZE; i++) {
      allTiles.add(i);
    }
    setRevealedTiles(allTiles);
  }, []);

  // Check URL parameters on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id');
    const statusFromUrl = urlParams.get('status');
    const amountFromUrl = urlParams.get('amount');

    if (idFromUrl) {
      // Check ID in database
      checkIdExists(idFromUrl).then(async (gameIdData) => {
        if (!gameIdData) {
          setLoginError("ID不存在或已失效");
          setViewMode('login');
          return;
        }

        // If there's status in URL, show the result
        if (statusFromUrl && amountFromUrl) {
          setCurrentId(idFromUrl);
          setViewMode('game');
          setGameStarted(true);
          setGameActive(false);
          
          const amount = parseFloat(amountFromUrl);
          if (statusFromUrl === 'cashed_out') {
            setGameMessage(`恭喜！您成功领取了 ${amount.toFixed(2)} 元奖金！`);
            setGameResult(`游戏已结束 - ID ${idFromUrl} 已兑奖 ${amount.toFixed(2)} 元`);
          } else if (statusFromUrl === 'busted') {
            setGameMessage('真不幸，踩到地雷！奖金已清零。');
            setGameResult(`游戏已结束 - ID ${idFromUrl} 已踩雷`);
          }
          
          // Show all tiles
          const allTiles = new Set<number>();
          for (let i = 0; i < GRID_SIZE; i++) {
            allTiles.add(i);
          }
          setRevealedTiles(allTiles);
          
          return;
        }

        // 检查游戏是否已完成
        if (gameIdData.status === 'cashed_out' || gameIdData.status === 'busted') {
          const statusText = gameIdData.status === 'cashed_out' 
            ? `已兑奖 ${gameIdData.amount.toFixed(2)} 元` 
            : '已踩雷';
          setLoginError(`此ID已被使用 - ${statusText}`);
          setViewMode('login');
          return;
        }

        // 尝试创建新会话
        const browserFingerprint = generateBrowserFingerprint();
        const sessionResult = await createGameSession(
          idFromUrl, 
          browserFingerprint,
          undefined, // IP地址
          navigator.userAgent
        );

        if (!sessionResult.success) {
          if (sessionResult.error?.includes('其他浏览器中使用')) {
            setGameMessage(sessionResult.error);
            setViewMode('game');
            setGameStarted(true);
            setGameActive(false);
            
            // 显示所有格子
            const allTiles = new Set<number>();
            for (let i = 0; i < GRID_SIZE; i++) {
              allTiles.add(i);
            }
            setRevealedTiles(allTiles);
          } else {
            setLoginError(sessionResult.error || '无法创建游戏会话');
            setViewMode('login');
          }
          setViewMode('login');
          return;
        }

        // 会话创建成功，进入游戏
        setCurrentId(idFromUrl);
        setCurrentSessionToken(sessionResult.sessionToken!);
        setViewMode('game');
      });
    }
  }, []);

  // Load game IDs on component mount
  useEffect(() => {
    loadGameIds();
  }, [loadGameIds]);

  // Utility functions
  const calculateWinnings = useCallback((count: number): number => {
    if (count === 0) return 0;
    const totalSafeTiles = GRID_SIZE - MINES_COUNT;
    const progress = count / totalSafeTiles;
    let winnings = MAX_REWARD * Math.pow(progress, 2);
    if (count === totalSafeTiles) {
      winnings = MAX_REWARD;
    }
    return winnings;
  }, []);

  // 数字滚动效果
  const triggerNumberRoll = useCallback(() => {
    const winningsElement = document.getElementById('winnings-display');
    if (winningsElement) {
      winningsElement.classList.remove('number-roll');
      setTimeout(() => {
        winningsElement.classList.add('number-roll');
      }, 10);
    }
  }, []);

  // 监听奖金变化，触发动画
  useEffect(() => {
    const currentWinnings = calculateWinnings(revealedTilesCount);
    if (currentWinnings !== previousWinnings && currentWinnings > 0) {
      triggerNumberRoll();
      setPreviousWinnings(currentWinnings);
    }
  }, [revealedTilesCount, calculateWinnings, previousWinnings, triggerNumberRoll]);

  const showLoginError = useCallback((message: string) => {
    setLoginError(message);
    setTimeout(() => setLoginError(''), 3000);
  }, []);

  const updateUrlWithResult = useCallback((id: string, status: 'cashed_out' | 'busted', amount: number) => {
    const newUrl = `${window.location.origin}${window.location.pathname}?id=${id}&status=${status}&amount=${amount.toFixed(2)}`;
    window.history.replaceState({}, '', newUrl);
  }, []);

  // Copy to clipboard function
  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(`ID ${id} 链接已复制！`);
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      setCopySuccess('复制失败，请手动复制');
      setTimeout(() => setCopySuccess(''), 2000);
    }
  }, []);

  // Admin functions
  const handleGenerateId = useCallback(async () => {
    setLoading(true);
    const newId = generateRandomId();
    const success = await createGameId(newId);
    
    if (success) {
      await loadGameIds();
      
      // Auto-copy the link and show success message
      const gameLink = `${window.location.origin}${window.location.pathname}?id=${newId}`;
      try {
        await navigator.clipboard.writeText(gameLink);
        setCopySuccess(`ID ${newId} 链接已生成并复制！`);
      } catch {
        setCopySuccess(`ID ${newId} 已生成，请手动复制链接`);
      }
      setTimeout(() => setCopySuccess(''), 3000);
    } else {
      setCopySuccess('生成失败，请重试');
      setTimeout(() => setCopySuccess(''), 3000);
    }
    
    setLoading(false);
  }, [generateRandomId, loadGameIds]);

  const handleDeleteId = useCallback(async (idToDelete: string) => {
    setLoading(true);
    const success = await deleteGameId(idToDelete);
    if (success) {
      await loadGameIds();
    }
    setLoading(false);
  }, [loadGameIds]);

  // Login functions
  const handleAdminLogin = useCallback(() => {
    const password = adminPasswordInput.trim();
    console.log('输入的密码:', `"${password}"`);
    console.log('预期密码:', `"${ADMIN_PASSWORD}"`);
    console.log('密码长度:', password.length);
    console.log('密码匹配:', password === ADMIN_PASSWORD);
    
    if (password === ADMIN_PASSWORD) {
      setViewMode('admin');
      setAdminPasswordInput('');
      setLoginError('');
      return;
    }

    showLoginError("管理员密码错误");
  }, [adminPasswordInput, showLoginError]);

  const handleUserLogin = useCallback(async () => {
    const id = userIdInput.trim();
    
    if (!id) {
      showLoginError("请输入ID");
      return;
    }

    if (!/^\d{4}$/.test(id)) {
      showLoginError("ID必须是4位数字");
      return;
    }

    setGameLoading(true);

    // 尝试创建游戏会话
    const browserFingerprint = generateBrowserFingerprint();
    const sessionResult = await createGameSession(
      id, 
      browserFingerprint,
      undefined, // IP地址
      navigator.userAgent
    );
    setGameLoading(false);
    
    if (!sessionResult.success) {
      showLoginError(sessionResult.error || '无法创建游戏会话');
      return;
    }

    // 会话创建成功，更新URL并跳转
    setCurrentSessionToken(sessionResult.sessionToken!);
    const newUrl = `${window.location.origin}${window.location.pathname}?id=${id}`;
    window.location.href = newUrl;
  }, [userIdInput, showLoginError]);

  const handleLogout = useCallback(() => {
    setCurrentId(null);
    setViewMode('login');
    setGameActive(false);
    setGameStarted(false);
    setRevealedTilesCount(0);
    setRevealedTiles(new Set());
    setGameMessage('');
    setGameResult('');
    setCurrentSessionToken(null);
    setCurrentSession(null);
    
    // Clear URL parameters
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  // Game functions
  const placeMines = useCallback(() => {
    const newBoard = Array(GRID_SIZE).fill('safe');
    let minesPlaced = 0;
    while (minesPlaced < MINES_COUNT) {
      const randomIndex = Math.floor(Math.random() * GRID_SIZE);
      if (newBoard[randomIndex] === 'safe') {
        newBoard[randomIndex] = 'mine';
        minesPlaced++;
      }
    }
    setBoard(newBoard);
  }, []);

  const startGame = useCallback(() => {
    if (gameActive) return;
    setGameLoading(true);
    
    if (currentId && currentSessionToken) {
      // 验证会话是否仍然有效
      validateSession(currentId, currentSessionToken).then(validationResult => {
        if (!validationResult.valid) {
          setGameMessage(validationResult.error || '会话已失效');
          setGameLoading(false);
          return;
        }
        
        // 会话有效，开始游戏
        setCurrentSession(validationResult.session!);
        setGameActive(true);
        setGameStarted(true);
        setRevealedTilesCount(0);
        setRevealedTiles(new Set());
        setGameMessage('请点击方块...');
        setGameResult('');
        placeMines();
        
        setTimeout(() => {
          setGameLoading(false);
        }, 300);
      });
    } else {
      setGameLoading(false);
    }
  }, [gameActive, currentId, currentSessionToken, placeMines]);

  const endGame = useCallback(async (isWin: boolean, cashedOutAmount?: number) => {
    setGameActive(false);
    
    let finalResult: 'cashed_out' | 'busted' = 'busted';
    let finalAmount = 0;
    let resultMessage = '';

    if (cashedOutAmount !== undefined) {
      finalResult = 'cashed_out';
      finalAmount = cashedOutAmount;
      setWinAmount(finalAmount);
      setShowWinPopup(true);
      resultMessage = `恭喜！成功兑奖 ${finalAmount.toFixed(2)} 元`;
    } else if (isWin) {
      finalResult = 'cashed_out';
      finalAmount = calculateWinnings(revealedTilesCount);
      setWinAmount(finalAmount);
      setShowWinPopup(true);
      resultMessage = `恭喜！获得满额奖金 ${finalAmount.toFixed(2)} 元`;
    } else {
      setGameMessage('真不幸，踩到地雷！奖金已清零。');
      resultMessage = '踩到地雷，奖金清零';
    }
    
    // 完成游戏会话
    if (currentSessionToken) {
      await completeGameSession(currentSessionToken, finalResult, finalAmount);
      updateUrlWithResult(currentId!, finalResult, finalAmount);
      setGameResult(`请告知管理员：ID ${currentId} 已使用，结果：${resultMessage}`);
      
      // 重新加载游戏ID列表以反映更改
      await loadGameIds();
    }
  }, [currentId, currentSessionToken, revealedTilesCount, calculateWinnings, updateUrlWithResult, loadGameIds]);

  const handleTileClick = useCallback((index: number) => {
    if (!gameActive || revealedTiles.has(index)) return;

    const newRevealedTiles = new Set(revealedTiles);
    newRevealedTiles.add(index);
    setRevealedTiles(newRevealedTiles);

    if (board[index] === 'mine') {
      // 踩雷时显示所有格子
      const allTiles = new Set<number>();
      for (let i = 0; i < GRID_SIZE; i++) {
        allTiles.add(i);
      }
      setRevealedTiles(allTiles);
      endGame(false);
    } else {
      const newCount = revealedTilesCount + 1;
      setRevealedTilesCount(newCount);
      if (newCount === GRID_SIZE - MINES_COUNT) {
        endGame(true);
      }
    }
  }, [gameActive, revealedTiles, board, revealedTilesCount, endGame]);

  const handleCashOut = useCallback(() => {
    if (!gameActive || revealedTilesCount === 0) return;
    const winnings = calculateWinnings(revealedTilesCount);
    
    // 领取奖金后显示所有格子
    const allTiles = new Set<number>();
    for (let i = 0; i < GRID_SIZE; i++) {
      allTiles.add(i);
    }
    setRevealedTiles(allTiles);
    
    endGame(false, winnings);
  }, [gameActive, revealedTilesCount, calculateWinnings, endGame]);

  const triggerConfetti = useCallback(() => {
    const confettiContainer = document.getElementById('confetti-container');
    if (!confettiContainer) return;
    
    confettiContainer.innerHTML = '';
    const items = ['🎊', '🧧', '🎉', '💰'];
    
    for (let i = 0; i < 50; i++) {
      const item = document.createElement('div');
      item.classList.add('falling-item');
      item.innerHTML = items[Math.floor(Math.random() * items.length)];
      item.style.left = Math.random() * 100 + 'vw';
      item.style.animationDuration = (Math.random() * 3 + 2) + 's';
      item.style.animationDelay = Math.random() * 2 + 's';
      item.style.fontSize = (Math.random() * 1.5 + 1) + 'rem';
      
      setTimeout(() => {
        item.remove();
      }, 7000);

      confettiContainer.appendChild(item);
    }
  }, []);

  useEffect(() => {
    if (showWinPopup) {
      triggerConfetti();
    }
  }, [showWinPopup, triggerConfetti]);

  return (
    <div className="app-container">
      {/* 会话心跳检测组件 */}
      <SessionHeartbeat 
        sessionToken={currentSessionToken}
        onSessionInvalid={handleSessionInvalid}
      />
      
      {viewMode === 'login' && (
        <LoginPanel
          userIdInput={userIdInput}
          setUserIdInput={setUserIdInput}
          adminPasswordInput={adminPasswordInput}
          setAdminPasswordInput={setAdminPasswordInput}
          loading={gameLoading}
          loginError={loginError}
          handleUserLogin={handleUserLogin}
          handleAdminLogin={handleAdminLogin}
        />
      )}
      {viewMode === 'admin' && (
        <AdminPanel
          gameIds={gameIds}
          loading={loading}
          copySuccess={copySuccess}
          handleGenerateId={handleGenerateId}
          copyToClipboard={copyToClipboard}
          handleDeleteId={handleDeleteId}
          setViewMode={setViewMode}
        />
      )}
      {viewMode === 'game' && (
        <GameView
          gameActive={gameActive}
          gameStarted={gameStarted}
          gameLoading={gameLoading}
          revealedTilesCount={revealedTilesCount}
          board={board}
          revealedTiles={revealedTiles}
          gameMessage={gameMessage}
          gameResult={gameResult}
          calculateWinnings={calculateWinnings}
          startGame={startGame}
          handleCashOut={handleCashOut}
          handleLogout={handleLogout}
          handleTileClick={handleTileClick}
        />
      )}
      
      {/* Win Popup */}
      {showWinPopup && (
        <div className="win-popup-overlay visible">
          <div className="win-popup">
            <h3>恭喜您！</h3>
            <div className="amount">{winAmount.toFixed(2)} 元</div>
            <button
              onClick={() => setShowWinPopup(false)}
              className="btn close-btn"
            >
              <span>太棒了！</span>
            </button>
          </div>
        </div>
      )}
      
      <div id="confetti-container"></div>
    </div>
  );
};

export default App;