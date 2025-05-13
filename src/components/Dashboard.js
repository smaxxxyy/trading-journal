import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TradeForm from './TradeForm';
import HabitTracker from './HabitTracker';

function Dashboard({ supabase }) {
  const [userId, setUserId] = useState(null);
  const [trades, setTrades] = useState([]);
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
    <div className="container py-12">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800" aria-label="Dashboard">
          Trading Journal
        </h2>
        <button
          onClick={handleLogout}
          className="modern-button bg-gray-600 text-white hover:bg-gray-700"
          aria-label="Logout button"
        >
          Logout
        </button>
      </div>
      <TradeForm supabase={supabase} userId={userId} onTradeAdded={handleTradeAdded} />
      <HabitTracker supabase={supabase} userId={userId} trades={trades} onReset={handleReset} />
      <div className="glass-card p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4" aria-label="Trade History">
          Trade History
        </h3>
        {trades.length === 0 ? (
          <p className="text-gray-600">No trades yet.</p>
        ) : (
          <div className="grid gap-4">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="glass-card p-4 transition-all duration-200 hover:shadow-xl"
              >
                <p className="text-gray-700">
                  <span className="font-semibold">TP:</span> {trade.tp}
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold">SL:</span> {trade.sl}
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold">RR Ratio:</span> {trade.rr_ratio}
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold">Emotions:</span> {trade.emotions}
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold">Notes:</span> {trade.notes}
                </p>
                {trade.screenshot_url && (
                  <img
                    src={trade.screenshot_url}
                    alt="Trade screenshot"
                    className="mt-2 rounded-lg max-w-full h-auto"
                    loading="lazy"
                  />
                )}
                {trade.rule_broken && (
                  <p className="text-red-600 font-semibold mt-2">Rule Broken</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;