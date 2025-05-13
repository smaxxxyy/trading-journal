import { motion } from 'framer-motion';

function HabitTracker({ supabase, userId, trades, onReset }) {
  const streak = trades.filter((trade) => !trade.rule_broken).length;

  const handleReset = async () => {
    const { error } = await supabase.from('trades').insert([
      { user_id: userId, rule_broken: true },
    ]);
    if (!error) {
      onReset();
    }
  };

  return (
    <motion.div
      className="futuristic-card p-10 mb-10"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-8" aria-label="Habit Tracker">
        Habit Tracker
      </h3>
      <p className="text-xl text-gray-700 dark:text-gray-200 mb-8" aria-label="Trades since last rule break">
        Trades Since Last Rule Break: <span className="font-extrabold text-blue-600 dark:text-pink-400">{streak}</span>
      </p>
      <motion.button
        onClick={handleReset}
        className="futuristic-button w-full from-red-500 to-red-600"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        aria-label="Reset Streak button"
      >
        Reset Streak (Rule Broken)
      </motion.button>
    </motion.div>
  );
}

export default HabitTracker;