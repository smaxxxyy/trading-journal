import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TradeForm from './TradeForm';
import HabitTracker from './HabitTracker';
import TradeAnalytics from './TradeAnalytics';
import Papa from 'papaparse';
import { motion } from 'framer-motion';

function Dashboard({ supabase }) {
  const [userId, setUserId] = useState(null);
  const [trades, setTrades] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [tagFilter, setTagFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserAndTrades = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      setUserId(user.id);

      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error) {
        setTrades(data);
      }
    };
    fetchUserAndTrades();
  }, [supabase, navigate]);

  const handleTradeAdded = async () => {
    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setTrades(data);
  };

  const handleReset = async () => {
    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setTrades(data);
  };

  const handleExport = () => {
    const csv = Papa.unparse(trades);
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

  const filteredTrades = tagFilter ? trades.filter(trade => trade.tags?.includes(tagFilter)) : trades;

  return (
    <div className={`container py-20 ${darkMode ? 'dark' : ''}`}>
      <motion.div
        className="flex flex-col sm:flex-row justify-between items-center mb-12 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-5xl font-extrabold text-gray-900 dark:text-white" aria-label="Dashboard">
          Trading Journal
        </h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <motion.button
            onClick={() => setDarkMode(!darkMode)}
            className="futuristic-button from-gray-500 to-gray-600"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </motion.button>
          <motion.button
            onClick={handleExport}
            className="futuristic-button from-green-500 to-green-600"
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
            aria-label="Logout button"
          >
            Logout
          </motion.button>
        </div>
      </motion.div>
      <TradeForm supabase={supabase} userId={userId} onTradeAdded={handleTradeAdded} />
      <HabitTracker supabase={supabase} userId={userId} trades={trades} onReset={handleReset} />
      <TradeAnalytics trades={trades} />
      <motion.div
        className="futuristic-card p-10"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-8" aria-label="Trade History">
          Trade History
        </h3>
        <input
          type="text"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          placeholder="Filter by tag (e.g., Scalping)"
          className="futuristic-input mb-8"
          aria-label="Tag filter input"
        />
        {filteredTrades.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-300 text-lg">No trades match the filter.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTrades.map((trade) => (
              <motion.div
                key={trade.id}
                className="futuristic-card p-6"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                whileHover={{ y: -5 }}
              >
                <p className="text-gray-700 dark:text-gray-200 text-lg">
                  <span className="font-semibold">TP:</span> {trade.tp}
                </p>
                <p className="text-gray-700 dark:text-gray-200 text-lg">
                  <span className="font-semibold">SL:</span> {trade.sl}
                </p>
                <p className="text-gray-700 dark:text-gray-200 text-lg">
                  <span className="font-semibold">RR Ratio:</span> {trade.rr_ratio}
                </p>
                <p className="text-gray-700 dark:text-gray-200 text-lg">
                  <span className="font-semibold">Emotions:</span> {trade.emotions}
                </p>
                <p className="text-gray-700 dark:text-gray-200 text-lg">
                  <span className="font-semibold">Tags:</span> {trade.tags?.join(', ') || 'None'}
                </p>
                <p className="text-gray-700 dark:text-gray-200 text-lg">
                  <span className="font-semibold">Notes:</span> {trade.notes}
                </p>
                {trade.screenshot_url && (
                  <img
                    src={trade.screenshot_url}
                    alt="Trade screenshot"
                    className="mt-4 rounded-xl max-w-full h-auto border-2 border-gray-200 dark:border-gray-600"
                    loading="lazy"
                  />
                )}
                {trade.rule_broken && (
                  <p className="text-red-600 dark:text-red-400 font-semibold mt-4 text-lg">Rule Broken</p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default Dashboard;