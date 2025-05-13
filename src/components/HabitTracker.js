import { useState, useEffect } from 'react';

function HabitTracker({ supabase, userId }) {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const fetchStreak = async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('rule_broken, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error) {
        let currentStreak = 0;
        for (const trade of data) {
          if (trade.rule_broken) break;
          currentStreak++;
        }
        setStreak(currentStreak);
      }
    };
    fetchStreak();
  }, [supabase, userId]);

  const resetStreak = async () => {
    await supabase
      .from('trades')
      .insert([{ user_id: userId, rule_broken: true, created_at: new Date().toISOString() }]);
    setStreak(0);
  };

  return (
    <div className="bg-white p-4 rounded shadow-md mb-4">
      <h3 className="text-xl mb-2" aria-label="Trades Since Last Rule Break">Trades Since Last Rule Break</h3>
      <p className="text-3xl" aria-label={`Current streak: ${streak} trades`}>{streak}</p>
      <button
        onClick={resetStreak}
        className="mt-4 bg-red-500 text-white p-2 rounded hover:bg-red-600"
        aria-label="Reset streak due to rule break"
      >
        Reset Streak (Rule Broken)
      </button>
    </div>
  );
}

export default HabitTracker;