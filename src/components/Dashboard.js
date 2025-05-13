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
      } catch (err) {
        setError(`Failed to load data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchUserAndData();
  }, [supabase, navigate]);

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

  const TradeCard = ({ trade }) => {
    const habit = habits.find(h => h.trade_id === trade.id);
    const cardRef = useRef(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e) => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        setMousePosition({ x: x / 20, y: y / 20 });
      }
    };

    return (
      <motion.div
        ref={cardRef}
        className="futuristic-card holographic-border p-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        style={{
          transform: `perspective(1000px) rotateX(${mousePosition.y}deg) rotateY(${mousePosition.x}deg)`,
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMousePosition({ x: 0, y: 0 })}
      >
        <p className="text-gray-100 text-lg">
          <span className="font-semibold">Pair:</span> {trade.pair || 'N/A'}
        </p>
        <p className="text-gray-100 text-lg">
          <span className="font-semibold">Entry:</span> {trade.entry || 'N/A'}
        </p>
        <p className="text-gray-100 text-lg">
          <span className="font-semibold">TP:</span> {trade.tp || 'N/A'}
        </p>
        <p className="text-gray-100 text-lg">
          <span className="font-semibold">SL:</span> {trade.sl || 'N/A'}
        </p>
        <p className="text-gray-100 text-lg">
          <span className="font-semibold">RR Ratio:</span> {trade.rr_ratio || 'N/A'}
        </p>
        <p className="text-gray-100 text-lg">
          <span className="font-semibold">Position Size:</span> {trade.position_size || 'N/A'} {trade.position_unit || ''}
        </p>
        <p className="text-gray-100 text-lg">
          <span className="font-semibold">Outcome:</span> {trade.outcome || 'N/A'}
        </p>
        <p className="text-gray-100 text-lg">
          <span className="font-semibold">Emotions:</span> {trade.emotions || 'None'}
        </p>
        <p className="text-gray-100 text-lg">
          <span className="font-semibold">Tags:</span> {trade.tags.length > 0 ? trade.tags.join(', ') : 'None'}
        </p>
        <p className="text-gray-100 text-lg">
          <span className="font-semibold">Notes:</span> {trade.notes || 'None'}
        </p>
        <p className="text-gray-100 text-lg">
          <span className="font-semibold">Had Plan:</span> {habit?.had_plan ? 'Yes' : 'No'}
        </p>
        <p className="text-gray-100 text-lg">
          <span className="font-semibold">Plan Followed:</span> {habit?.plan_followed ? 'Yes' : 'No'}
        </p>
        <p className="text-gray-100 text-lg">
          <span className="font-semibold">Was Gamble:</span> {habit?.was_gamble ? 'Yes' : 'No'}
        </p>
        <p className="text-gray-100 text-lg">
          <span className="font-semibold">Streak:</span> {habit?.streak || 0} trades
        </p>
        {trade.screenshot_url && (
          <button
            onClick={() => setModalImage(trade.screenshot_url)}
            className="mt-4"
            aria-label="View trade screenshot"
          >
            <img
              src={trade.screenshot_url}
              alt="Trade screenshot thumbnail"
              className="rounded-xl w-24 h-24 object-cover border-2 border-gray-200"
            />
          </button>
        )}
        {trade.rule_broken && (
          <p className="text-red-400 font-semibold mt-4 text-lg">Rule Broken</p>
        )}
        <motion.button
          onClick={() => handleDeleteTrade(trade.id)}
          className="futuristic-button from-red-500 to-red-600 mt-4 w-full"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          aria-label="Delete trade button"
        >
          Delete Trade
        </motion.button>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="container py-20 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-gray-100">Loading...</h2>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container py-20">
      <motion.div
        className="flex flex-col sm:flex-row justify-between items-center mb-12 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-5xl font-extrabold text-[var(--neon-purple)]" aria-label="Dashboard">
          Trading Journal
        </h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <motion.button
            onClick={handleExport}
            className="futuristic-button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            Export Trades
          </motion.button>
          <motion.button
            onClick={handleLogout}
            className="futuristic-button from-red-500 to-red-600"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            Logout
          </motion.button>
        </div>
      </motion.div>
      {error && (
        <motion.div
          className="futuristic-card p-6 mb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-red-400 text-lg" role="alert">{error}</p>
        </motion.div>
      )}
      {!userId ? (
        <motion.div
          className="futuristic-card p-6 mb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-red-400 text-lg" role="alert">
            User not authenticated. Please log in.
          </p>
        </motion.div>
      ) : (
        <>
          <TradeForm supabase={supabase} userId={userId} onTradeAdded={handleTradeAdded} />
          <TradeAnalytics trades={trades} />
          <motion.div
            className="futuristic-card holographic-border p-10"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-3xl font-bold text-[var(--neon-blue)] mb-8" aria-label="Trade History">
              Trade History
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 justify-center">
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
                className="futuristic-select w-32"
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
              <p className="text-gray-100 text-lg text-center">No trades match the filter.</p>
            ) : (
              <div className="space-y-8">
                {dailyGroups.map(group => (
                  <motion.div
                    key={group.date}
                    className="futuristic-card holographic-border p-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <h4 className="text-2xl font-bold text-[var(--neon-purple)] mb-4">
                      {group.date}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <p className="text-gray-100 text-lg">
                        <span className="font-semibold">Total Trades:</span> {group.totalTrades}
                      </p>
                      <p className="text-gray-100 text-lg">
                        <span className="font-semibold">Wins:</span> {group.outcomes.wins}
                      </p>
                      <p className="text-gray-100 text-lg">
                        <span className="font-semibold">Losses:</span> {group.outcomes.losses}
                      </p>
                      <p className="text-gray-100 text-lg">
                        <span className="font-semibold">Breakevens:</span> {group.outcomes.breakevens}
                      </p>
                      <p className="text-gray-100 text-lg">
                        <span className="font-semibold">Average RR:</span> {group.avgRr}
                      </p>
                    </div>
                    {group.message && (
                      <p className="text-[var(--neon-blue)] text-lg font-semibold mb-4">
                        {group.message}
                      </p>
                    )}
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 justify-center">
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
                className="max-w-[90%] max-h-[90%] rounded-xl"
              />
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

export default Dashboard;