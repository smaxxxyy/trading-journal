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
    <div className="glass-card p-6 mb-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4" aria-label="Habit Tracker">
        Habit Tracker
      </h3>
      <p className="text-lg text-gray-700 mb-4" aria-label="Trades since last rule break">
        Trades Since Last Rule Break: <span className="font-bold text-blue-600">{streak}</span>
      </p>
      <button
        onClick={handleReset}
        className="modern-button bg-red-600 text-white hover:bg-red-700 w-full"
        aria-label="Reset Streak button"
      >
        Reset Streak (Rule Broken)
      </button>
    </div>
  );
}

export default HabitTracker;