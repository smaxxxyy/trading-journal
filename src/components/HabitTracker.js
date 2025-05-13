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
      className="glass-card p-8 mb-8"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6" aria-label="Habit Tracker">
        Habit Tracker
      </h3>
      <p className="text-lg text-gray-700 dark:text-gray-200 mb-6" aria-label="Trades since last rule break">
        Trades Since Last Rule Break: <span className="font-bold text-blue-600 dark:text-purple-400">{streak}</span>
      </p>
      <motion.button
        onClick={handleReset}
        className="neo-button bg-red-600 dark:bg-red-700 w-full"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Reset Streak button"
      >
        Reset Streak (Rule Broken)
      </motion.button>
    </motion.div>
  );
}

export default HabitTracker;