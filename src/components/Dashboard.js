import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TradeForm from './TradeForm';
import HabitTracker from './HabitTracker';
import { motion } from 'framer-motion';

function Dashboard({ supabase }) {
  const [userId, setUserId] = useState(null);
  const [trades, setTrades] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className={`container py-16 ${darkMode ? 'dark' : ''}`}>
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-4xl font-bold text-gray-900 dark:text-white" aria-label="Dashboard">
          Trading Journal
        </h2>
        <div className="flex gap-4">
          <motion.button
            onClick={() => setDarkMode(!darkMode)}
            className="neo-button bg-gray-600 dark:bg-gray-500"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </motion.button>
          <motion.button
            onClick={handleLogout}
            className="neo-button bg-red-600 dark:bg-red-700"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Logout button"
          >
            Logout
          </motion.button>
        </div>
      </div>
      <TradeForm supabase={supabase} userId={userId} onTradeAdded={handleTradeAdded} />
      <HabitTracker supabase={supabase} userId={userId} trades={trades} onReset={handleReset} />
      <motion.div
        className="glass-card p-8"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6" aria-label="Trade History">
          Trade History
        </h3>
        {trades.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-300">No trades yet.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trades.map((trade) => (
              <motion.div
                key={trade.id}
                className="glass-card p-6"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-gray-700 dark:text-gray-200">
                  <span className="font-semibold">TP:</span> {trade.tp}
                </p>
                <p className="text-gray-700 dark:text-gray-200">
                  <span className="font-semibold">SL:</span> {trade.sl}
                </p>
                <p className="text-gray-700 dark:text-gray-200">
                  <span className="font-semibold">RR Ratio:</span> {trade.rr_ratio}
                </p>
                <p className="text-gray-700 dark:text-gray-200">
                  <span className="font-semibold">Emotions:</span> {trade.emotions}
                </p>
                <p className="text-gray-700 dark:text-gray-200">
                  <span className="font-semibold">Notes:</span> {trade.notes}
                </p>
                {trade.screenshot_url && (
                  <img
                    src={trade.screenshot_url}
                    alt="Trade screenshot"
                    className="mt-4 rounded-lg max-w-full h-auto border-2 border-gray-200 dark:border-gray-600"
                    loading="lazy"
                  />
                )}
                {trade.rule_broken && (
                  <p className="text-red-600 dark:text-red-400 font-semibold mt-4">Rule Broken</p>
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