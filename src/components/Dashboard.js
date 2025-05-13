import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TradeForm from './TradeForm';
import TradeAnalytics from './TradeAnalytics';
import Papa from 'papaparse';
import { motion } from 'framer-motion';

function Dashboard({ supabase }) {
  const [userId, setUserId] = useState(null);
  const [trades, setTrades] = useState([]);
  const [habits, setHabits] = useState([]);
  const [tagFilter, setTagFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [historyFilter, setHistoryFilter] = useState('today');
  const [rrMin, setRrMin] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalImage, setModalImage] = useState(null);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'neon');
  const [prices, setPrices] = useState({ btc: 'Loading...', gold: 'Loading...' });
  const [livePrice, setLivePrice] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const fetchUserAndData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login');
          return;
        }
        setUserId(user.id);

        const [tradesData, habitsData] = await Promise.all([
          supabase
            .from('trades')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('habits')
            .select('*')
            .eq('user_id', user.id),
        ]);

        if (tradesData.error) throw new Error(tradesData.error.message);
        if (habitsData.error) throw new Error(habitsData.error.message);

        setTrades(tradesData.data.map(trade => ({
          ...trade,
          tags: Array.isArray(trade.tags) ? trade.tags : trade.tags ? [trade.tags] : [],
        })));
        setHabits(habitsData.data);

        const streakData = calculateStreak(tradesData.data);
        await supabase.from('user_records').upsert({
          user_id: user.id,
          best_unbroken_trades: streakData.maxTrades,
          best_unbroken_days: streakData.maxDays,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        setError(`Failed to load data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    const fetchPrices = async () => {
      try {
        const btcResponse = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
        if (!btcResponse.ok) throw new Error('Failed to fetch BTC price');
        const btcData = await btcResponse.json();
        const btcPrice = btcData.price ? parseFloat(btcData.price).toFixed(2) : 'N/A';

        const goldResponse = await fetch(`https://metals-api.com/api/latest?access_key=${process.env.METALS_API_KEY || 'your-api-key'}&base=USD&symbols=XAU`);
        if (!goldResponse.ok) throw new Error('Failed to fetch XAU price');
        const goldData = await goldResponse.json();
        const goldPrice = goldData.rates?.XAU ? (1 / goldData.rates.XAU).toFixed(2) : 'N/A';

        setPrices({ btc: btcPrice, gold: goldPrice });
      } catch (err) {
        console.error('Price fetch error:', err);
        setPrices({ btc: 'N/A', gold: 'N/A' });
      }
    };

    fetchUserAndData();
    fetchPrices();
  }, [supabase, navigate]);

  const fetchLivePrice = async (pair) => {
    try {
      if (pair.toUpperCase() === 'XAU/USD') {
        const response = await fetch(`https://metals-api.com/api/latest?access_key=${process.env.METALS_API_KEY || 'your-api-key'}&base=USD&symbols=XAU`);
        const data = await response.json();
        return data.rates?.XAU ? (1 / data.rates.XAU).toFixed(2) : 'N/A';
      } else {
        const symbol = pair.toUpperCase().replace('/', '');
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        const data = await response.json();
        return data.price ? parseFloat(data.price).toFixed(2) : 'N/A';
      }
    } catch (err) {
      console.error('Live price fetch error:', err);
      return 'N/A';
    }
  };

  useEffect(() => {
    if (selectedTrade?.trade?.status === 'in_progress') {
      const interval = setInterval(async () => {
        const price = await fetchLivePrice(selectedTrade.trade.pair);
        setLivePrice(price);
      }, 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [selectedTrade]);

  const handleEditTrade = async (tradeId, updatedData) => {
    try {
      const { error: tradeError } = await supabase
        .from('trades')
        .update(updatedData)
        .eq('id', tradeId)
        .eq('user_id', userId);
      if (tradeError) throw new Error(tradeError.message);

      const updatedTrades = trades.map(trade =>
        trade.id === tradeId ? { ...trade, ...updatedData } : trade
      );
      setTrades(updatedTrades);
      setSelectedTrade({
        trade: { ...selectedTrade.trade, ...updatedData },
        habit: selectedTrade.habit,
      });
    } catch (err) {
      setError(`Failed to edit trade: ${err.message}`);
    }
  };

  const calculateStreak = (trades) => {
    let currentTrades = 0;
    let maxTrades = 0;
    let currentDays = new Set();
    let maxDays = 0;
    let lastDate = null;

    trades.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(trade => {
      const tradeDate = new Date(trade.created_at).toDateString();
      if (trade.was_gamble) {
        currentTrades = 0;
        currentDays.clear();
      } else {
        currentTrades += 1;
        currentDays.add(tradeDate);
        if (lastDate && tradeDate !== lastDate) {
          currentDays.add(tradeDate);
        }
        maxTrades = Math.max(maxTrades, currentTrades);
        maxDays = Math.max(maxDays, currentDays.size);
      }
      lastDate = tradeDate;
    });

    return { currentTrades, currentDays: currentDays.size, maxTrades, maxDays };
  };

  const handleTradeAdded = async () => {
    try {
      const [tradesData, habitsData] = await Promise.all([
        supabase
          .from('trades')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('habits')
          .select('*')
          .eq('user_id', userId),
      ]);

      if (tradesData.error) throw new Error(tradesData.error.message);
      if (habitsData.error) throw new Error(habitsData.error.message);

      setTrades(tradesData.data.map(trade => ({
        ...trade,
        tags: Array.isArray(trade.tags) ? trade.tags : trade.tags ? [trade.tags] : [],
      })));
      setHabits(habitsData.data);

      const streakData = calculateStreak(tradesData.data);
      await supabase.from('user_records').upsert({
        user_id: userId,
        best_unbroken_trades: streakData.maxTrades,
        best_unbroken_days: streakData.maxDays,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      setError(`Failed to refresh data: ${err.message}`);
    }
  };

  const handleDeleteTrade = async (tradeId) => {
    if (!window.confirm('Delete this trade?')) return;
    try {
      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', tradeId)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
      setTrades(trades.filter(trade => trade.id !== tradeId));
      setHabits(habits.filter(habit => habit.trade_id !== tradeId));

      const streakData = calculateStreak(trades.filter(trade => trade.id !== tradeId));
      await supabase.from('user_records').upsert({
        user_id: userId,
        best_unbroken_trades: streakData.maxTrades,
        best_unbroken_days: streakData.maxDays,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      setError(`Failed to delete trade: ${err.message}`);
    }
  };

  const handleExport = () => {
    const enrichedTrades = trades.map(trade => {
      const habit = habits.find(h => h.trade_id === trade.id);
      return {
        ...trade,
        had_plan: habit?.had_plan || false,
        plan_followed: habit?.plan_followed || false,
        was_gamble: habit?.was_gamble || false,
        streak: habit?.streak || 0,
        leverage: trade.leverage || 'N/A',
        profit: trade.profit || 'N/A',
      };
    });
    const csv = Papa.unparse(enrichedTrades);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'trades.csv');
    link.click();
    setIsMenuOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
    setIsMenuOpen(false);
  };

  const filteredTrades = trades.filter(trade => {
    const tradeDate = new Date(trade.created_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = today;
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(today.getMonth() - 1);

    let matchesTime = true;
    if (historyFilter === 'today') {
      matchesTime = tradeDate.toDateString() === startOfToday.toDateString();
    } else if (historyFilter === 'weekly') {
      matchesTime = tradeDate >= oneWeekAgo && tradeDate <= today;
    } else if (historyFilter === 'monthly') {
      matchesTime = tradeDate >= oneMonthAgo && tradeDate <= today;
    } else if (historyFilter === 'all') {
      matchesTime = true;
    }

    const matchesTag = tagFilter ? trade.tags.includes(tagFilter) : true;
    const matchesOutcome = outcomeFilter ? trade.outcome === outcomeFilter : true;
    const matchesRr = rrMin ? (trade.rr_ratio || 0) >= parseFloat(rrMin) : true;
    return matchesTime && matchesTag && matchesOutcome && matchesRr;
  });

  const groupTradesByDay = () => {
    const grouped = {};
    filteredTrades.forEach(trade => {
      const date = new Date(trade.created_at).toLocaleDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(trade);
    });

    return Object.entries(grouped).map(([date, trades]) => {
      const outcomes = trades.reduce(
        (acc, trade) => {
          if (trade.outcome === 'Win') acc.wins += 1;
          else if (trade.outcome === 'Loss') acc.losses += 1;
          else if (trade.outcome === 'Breakeven') acc.breakevens += 1;
          return acc;
        },
        { wins: 0, losses: 0, breakevens: 0 }
      );
      const totalTrades = trades.length;
      const avgRr = trades.reduce((sum, trade) => sum + (trade.rr_ratio || 0), 0) / totalTrades || 0;
      let message = '';
      if (outcomes.wins > outcomes.losses) {
        message = 'Great job dominating the market today!';
      } else if (outcomes.losses >= 3) {
        message = 'Tough day, but every loss is a lesson. Keep refining your strategy!';
      }

      return { date, trades, outcomes, totalTrades, avgRr: avgRr.toFixed(2), message };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const dailyGroups = groupTradesByDay();
  const streakData = calculateStreak(trades);

  const TradeCard = ({ trade }) => {
    const habit = habits.find(h => h.trade_id === trade.id);
    const cardRef = useRef(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e) => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        setMousePosition({ x: x / 30, y: y / 30 });
      }
    };

    return (
      <motion.div
        ref={cardRef}
        className="futuristic-card holographic-border p-4 grid grid-cols-2 gap-2 text-xs min-h-[160px] cursor-pointer"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        whileHover={{ scale: 1.02 }}
        style={{
          transform: `perspective(1000px) rotateX(${mousePosition.y}deg) rotateY(${mousePosition.x}deg)`,
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMousePosition({ x: 0, y: 0 })}
        onClick={() => setSelectedTrade({ trade, habit })}
      >
        <p className="font-medium">Pair</p>
        <p>{trade.pair || 'N/A'}</p>
        <p className="font-medium">Outcome</p>
        <p>{trade.outcome || 'N/A'}</p>
        <p className="font-medium">RR</p>
        <p>{trade.rr_ratio?.toFixed(2) || 'N/A'}</p>
        <p className="font-medium">Leverage</p>
        <p>{trade.leverage?.toFixed(0)}x</p>
        <p className="font-medium">Profit</p>
        <p>{trade.profit?.toFixed(2) || 'N/A'}</p>
        <p className="font-medium">Plan</p>
        <p>{habit?.had_plan ? 'Yes' : 'No'}</p>
        <div className="col-span-2 flex gap-2 mt-2">
          <motion.button
            onClick={(e) => { e.stopPropagation(); setSelectedTrade({ trade, habit }); }}
            className="futuristic-button flex-1 text-xs py-1.5"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            View
          </motion.button>
          <motion.button
            onClick={(e) => { e.stopPropagation(); handleDeleteTrade(trade.id); }}
            className="futuristic-button from-red-500 to-red-600 flex-1 text-xs py-1.5"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Delete
          </motion.button>
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="container py-8 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-bold">Loading...</h2>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container py-8 relative">
      <motion.div
        className="flex justify-between items-center mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl font-extrabold" aria-label="Dashboard">
          Trading Journal
        </h2>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 rounded-lg bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)]"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </motion.div>
      <div className="mb-6 text-xs">
        <p>BTC/USD: ${prices.btc}</p>
        <p>XAU/USD: ${prices.gold}</p>
      </div>
      {isMenuOpen && (
        <div className="absolute top-16 right-4 left-auto futuristic-card holographic-border p-4 w-48 z-50">
          <div className="flex flex-col gap-2 text-xs">
            <motion.button
              onClick={handleExport}
              className="futuristic-button text-left py-2 px-3"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Export Trades
            </motion.button>
            <motion.button
              onClick={handleLogout}
              className="futuristic-button from-red-500 to-red-600 text-left py-2 px-3"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Logout
            </motion.button>
            <div className="border-t border-[var(--color-glass-border)] my-2"></div>
            <p className="font-medium">Trade History</p>
            <select
              value={historyFilter}
              onChange={(e) => { setHistoryFilter(e.target.value); setIsMenuOpen(false); }}
              className="futuristic-select text-xs py-2"
            >
              <option value="today">Today</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="all">All</option>
            </select>
            <p className="font-medium mt-2">Theme</p>
            <select
              value={theme}
              onChange={(e) => { setTheme(e.target.value); setIsMenuOpen(false); }}
              className="futuristic-select text-xs py-2"
            >
              <option value="neon">Neon</option>
              <option value="white">White</option>
              <option value="black">Black</option>
              <option value="grey">Grey</option>
            </select>
          </div>
        </div>
      )}
      {error && (
        <motion.div
          className="futuristic-card p-4 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-red-400 text-sm" role="alert">{error}</p>
        </motion.div>
      )}
      {!userId ? (
        <motion.div
          className="futuristic-card p-4 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-red-400 text-sm" role="alert">
            User not authenticated. Please log in.
          </p>
        </motion.div>
      ) : (
        <>
          <TradeForm supabase={supabase} userId={userId} onTradeAdded={handleTradeAdded} />
          <TradeAnalytics trades={trades} streakData={streakData} supabase={supabase} userId={userId} />
          <motion.div
            className="futuristic-card holographic-border p-6 mb-16 sm:mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h3 className="text-xl font-bold mb-4" aria-label="Trade History">
              Trade History
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <input
                type="text"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="Filter by tag (e.g., Scalping)"
                className="futuristic-input"
                aria-label="Tag filter input"
              />
              <select
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value)}
                className="futuristic-select"
                aria-label="Outcome filter input"
              >
                <option value="">All Outcomes</option>
                <option value="Win">Win</option>
                <option value="Loss">Loss</option>
                <option value="Breakeven">Breakeven</option>
              </select>
              <input
                type="number"
                value={rrMin}
                onChange={(e) => setRrMin(e.target.value)}
                placeholder="Min RR Ratio"
                className="futuristic-input"
                step="0.01"
                aria-label="Min RR filter"
              />
            </div>
            {dailyGroups.length === 0 ? (
              <p className="text-sm text-center">No trades match the filter.</p>
            ) : (
              <div className="space-y-4">
                {dailyGroups.map(group => (
                  <motion.div
                    key={group.date}
                    className="futuristic-card holographic-border p-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <h4 className="text-lg font-bold mb-3">
                      {group.date}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-sm">
                      <p>
                        <span className="font-medium">Total Trades:</span> {group.totalTrades}
                      </p>
                      <p>
                        <span className="font-medium">Wins:</span> {group.outcomes.wins}
                      </p>
                      <p>
                        <span className="font-medium">Losses:</span> {group.outcomes.losses}
                      </p>
                      <p>
                        <span className="font-medium">Breakevens:</span> {group.outcomes.breakevens}
                      </p>
                      <p>
                        <span className="font-medium">Average RR:</span> {group.avgRr}
                      </p>
                    </div>
                    {group.message && (
                      <p className="text-sm font-medium mb-3">
                        {group.message}
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-3">
                      {group.trades.map(trade => (
                        <TradeCard key={trade.id} trade={trade} />
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
          {modalImage && (
            <motion.div
              className="fixed inset-0 bg-[var(--color-bg-dark)] bg-opacity-80 flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalImage(null)}
            >
              <img
                src={modalImage}
                alt="Full trade screenshot"
                className="max-w-[90%] max-h-[90%] rounded-2xl"
              />
            </motion.div>
          )}
          {selectedTrade && (
            <motion.div
              className="fixed inset-0 bg-[var(--color-bg-dark)] bg-opacity-80 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTrade(null)}
            >
              <div
                className="futuristic-card holographic-border p-6 max-w-md w-full"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-xl font-bold mb-4">Trade Details</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p className="font-medium">Pair</p>
                  <p>{selectedTrade.trade.pair || 'N/A'}</p>
                  {selectedTrade.trade.status === 'in_progress' && (
                    <>
                      <p className="font-medium">Current Price</p>
                      <p>{livePrice ? `${selectedTrade.trade.pair}: $${livePrice}` : 'Fetching...'}</p>
                    </>
                  )}
                  <p className="font-medium">Position Size</p>
                  <p>{selectedTrade.trade.position_size?.toFixed(2) || 'N/A'}</p>
                  <p className="font-medium">Entry</p>
                  <p>{selectedTrade.trade.entry?.toFixed(2) || 'N/A'}</p>
                  <p className="font-medium">Stop Loss</p>
                  <p>{selectedTrade.trade.sl?.toFixed(2) || 'N/A'}</p>
                  <p className="font-medium">Take Profit</p>
                  <p>{selectedTrade.trade.tp?.toFixed(2) || 'N/A'}</p>
                  <p className="font-medium">Direction</p>
                  <p>{selectedTrade.trade.direction || 'N/A'}</p>
                  <p className="font-medium">Status</p>
                  <p>{selectedTrade.trade.status || 'N/A'}</p>
                  <p className="font-medium">Outcome</p>
                  <p>{selectedTrade.trade.outcome || 'N/A'}</p>
                  <p className="font-medium">RR Ratio</p>
                  <p>{selectedTrade.trade.rr_ratio?.toFixed(2) || 'N/A'}</p>
                  <p className="font-medium">Leverage</p>
                  <p>{selectedTrade.trade.leverage?.toFixed(0)}x</p>
                  <p className="font-medium">Profit</p>
                  <p>{selectedTrade.trade.profit?.toFixed(2) || 'N/A'}</p>
                  <p className="font-medium">Had Plan</p>
                  <p>{selectedTrade.habit?.had_plan ? 'Yes' : 'No'}</p>
                  <p className="font-medium">Plan Followed</p>
                  <p>{selectedTrade.habit?.plan_followed ? 'Yes' : 'No'}</p>
                  <p className="font-medium">Was Gamble</p>
                  <p>{selectedTrade.habit?.was_gamble ? 'Yes' : 'No'}</p>
                  <p className="font-medium">Tags</p>
                  <p>{selectedTrade.trade.tags?.join(', ') || 'N/A'}</p>
                  {selectedTrade.trade.screenshot_url && (
                    <>
                      <p className="font-medium">Screenshot</p>
                      <button onClick={() => setModalImage(selectedTrade.trade.screenshot_url)}>
                        <img
                          src={selectedTrade.trade.screenshot_url}
                          alt="Trade screenshot"
                          className="rounded-lg w-16 h-16 object-cover border border-[var(--color-glass-border)]"
                        />
                      </button>
                    </>
                  )}
                </div>
                {selectedTrade.trade.status === 'in_progress' && !selectedTrade.trade.is_edited && (
                  <motion.button
                    onClick={() => {
                      const outcome = determineOutcome(selectedTrade.trade);
                      handleEditTrade(selectedTrade.trade.id, {
                        status: 'completed',
                        outcome,
                        is_edited: true,
                      });
                    }}
                    className="futuristic-button w-full mt-4"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Mark as Completed
                  </motion.button>
                )}
                <motion.button
                  onClick={() => setSelectedTrade(null)}
                  className="futuristic-button w-full mt-4"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

const determineOutcome = (trade) => {
  const { entry, tp, sl, direction } = trade;
  const entryPrice = parseFloat(entry);
  const takeProfit = parseFloat(tp);
  const stopLoss = parseFloat(sl);

  if (direction === 'long') {
    if (takeProfit > entryPrice) return 'Win';
    if (stopLoss < entryPrice) return 'Loss';
  } else if (direction === 'short') {
    if (takeProfit < entryPrice) return 'Win';
    if (stopLoss > entryPrice) return 'Loss';
  }
  return 'Breakeven';
};

export default Dashboard;