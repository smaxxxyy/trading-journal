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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [rrMin, setRrMin] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalImage, setModalImage] = useState(null);
  const navigate = useNavigate();

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
    fetchUserAndData();
  }, [supabase, navigate]);

  const calculateStreak = (trades) => {
    let currentTrades = 0;
    let maxTrades = 0;
    let currentDays = new Set();
    let maxDays = 0;
    let lastDate = null;

    trades.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(trade => {
      const tradeDate = new Date(trade.created_at).toDateString();
      if (trade.rule_broken) {
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
      };
    });
    const csv = Papa.unparse(enrichedTrades);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'trades.csv');
    link.click();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const filteredTrades = trades.filter(trade => {
    const matchesTag = tagFilter ? trade.tags.includes(tagFilter) : true;
    const matchesOutcome = outcomeFilter ? trade.outcome === outcomeFilter : true;
    const matchesDate = (
      (!dateFrom || new Date(trade.created_at) >= new Date(dateFrom)) &&
      (!dateTo || new Date(trade.created_at) <= new Date(dateTo))
    );
    const matchesRr = rrMin ? (trade.rr_ratio || 0) >= parseFloat(rrMin) : true;
    return matchesTag && matchesOutcome && matchesDate && matchesRr;
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
        className="futuristic-card holographic-border p-4 grid grid-cols-2 gap-2 text-xs min-h-[160px]"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        whileHover={{ scale: 1.02 }}
        style={{
          transform: `perspective(1000px) rotateX(${mousePosition.y}deg) rotateY(${mousePosition.x}deg)`,
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMousePosition({ x: 0, y: 0 })}
      >
        <p className="text-gray-100 font-medium">Pair</p>
        <p className="text-[var(--color-neon-blue)]">{trade.pair || 'N/A'}</p>
        <p className="text-gray-100 font-medium">Outcome</p>
        <p className="text-[var(--color-neon-blue)]">{trade.outcome || 'N/A'}</p>
        <p className="text-gray-100 font-medium">RR</p>
        <p className="text-gray-100">{trade.rr_ratio?.toFixed(2) || 'N/A'}</p>
        <p className="text-gray-100 font-medium">Plan</p>
        <p className="text-gray-100">{habit?.had_plan ? 'Yes' : 'No'}</p>
        <p className="text-gray-100 font-medium">Followed</p>
        <p className="text-gray-100">{habit?.plan_followed ? 'Yes' : 'No'}</p>
        <p className="text-gray-100 font-medium">Gamble</p>
        <p className="text-gray-100">{habit?.was_gamble ? 'Yes' : 'No'}</p>
        {trade.screenshot_url && (
          <>
            <p className="text-gray-100 font-medium">Screenshot</p>
            <button
              onClick={() => setModalImage(trade.screenshot_url)}
              className="flex"
              aria-label="View trade screenshot"
            >
              <img
                src={trade.screenshot_url}
                alt="Trade screenshot thumbnail"
                className="rounded-lg w-8 h-8 object-cover border border-[var(--color-glass-border)]"
              />
            </button>
          </>
        )}
        {trade.rule_broken && (
          <>
            <p className="text-gray-100 font-medium">Rule</p>
            <p className="text-red-400 font-medium">Broken</p>
          </>
        )}
        <div className="col-span-2 mt-2">
          <motion.button
            onClick={() => handleDeleteTrade(trade.id)}
            className="futuristic-button from-red-500 to-red-600 w-full text-xs py-1.5"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Delete trade button"
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
          <h2 className="text-2xl font-bold text-gray-100">Loading...</h2>
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
        <h2 className="text-2xl font-extrabold text-[var(--color-neon-purple)]" aria-label="Dashboard">
          Trading Journal
        </h2>
        {/* Desktop Buttons (Hidden on Mobile) */}
        <div className="hidden sm:flex gap-3">
          <motion.button
            onClick={handleExport}
            className="futuristic-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Export Trades
          </motion.button>
          <motion.button
            onClick={handleLogout}
            className="futuristic-button from-red-500 to-red-600"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Logout
          </motion.button>
        </div>
      </motion.div>
      {/* Mobile Buttons (Bottom Bar, Hidden on Desktop) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-[var(--color-glass-bg)] backdrop-blur-lg border-t border-[var(--color-glass-border)] p-4 flex justify-between gap-2 z-10">
        <motion.button
          onClick={handleExport}
          className="futuristic-button flex-1 text-xs py-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Export
        </motion.button>
        <motion.button
          onClick={handleLogout}
          className="futuristic-button from-red-500 to-red-600 flex-1 text-xs py-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Logout
        </motion.button>
      </div>
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
            <h3 className="text-xl font-bold text-[var(--color-neon-blue)] mb-4" aria-label="Trade History">
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
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="futuristic-input"
                aria-label="Date from filter"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="futuristic-input"
                aria-label="Date to filter"
              />
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
              <p className="text-gray-100 text-sm text-center">No trades match the filter.</p>
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
                    <h4 className="text-lg font-bold text-[var(--color-neon-purple)] mb-3">
                      {group.date}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-sm">
                      <p className="text-gray-100">
                        <span className="font-medium">Total Trades:</span> {group.totalTrades}
                      </p>
                      <p className="text-gray-100">
                        <span className="font-medium">Wins:</span> {group.outcomes.wins}
                      </p>
                      <p className="text-gray-100">
                        <span className="font-medium">Losses:</span> {group.outcomes.losses}
                      </p>
                      <p className="text-gray-100">
                        <span className="font-medium">Breakevens:</span> {group.outcomes.breakevens}
                      </p>
                      <p className="text-gray-100">
                        <span className="font-medium">Average RR:</span> {group.avgRr}
                      </p>
                    </div>
                    {group.message && (
                      <p className="text-[var(--color-neon-blue)] text-sm font-medium mb-3">
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
              className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
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
        </>
      )}
    </div>
  );
}

export default Dashboard;