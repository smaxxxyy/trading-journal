import { useState, useEffect } from 'react';
import HabitTracker from './HabitTracker';
import TradeForm from './TradeForm';

function Dashboard({ supabase, session }) {
  const [trades, setTrades] = useState([]);

  const fetchTrades = async () => {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (!error) setTrades(data);
  };



  useEffect(() => {
    fetchTrades();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl" aria-label="Trading Journal Dashboard">Trading Journal</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white p-2 rounded hover:bg-red-600"
          aria-label="Logout button"
        >
          Logout
        </button>
      </div>
      <HabitTracker supabase={supabase} userId={session.user.id} />
      <TradeForm supabase={supabase} userId={session.user.id} onTradeAdded={fetchTrades} />
      <h2 className="text-xl mb-2" aria-label="Trade History">Trade History</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trades.map((trade) => (
          <div key={trade.id} className="bg-white p-4 rounded shadow-md">
            <p><strong>TP:</strong> {trade.tp}</p>
            <p><strong>SL:</strong> {trade.sl}</p>
            <p><strong>RR Ratio:</strong> {trade.rr_ratio}</p>
            <p><strong>Emotions:</strong> {trade.emotions}</p>
            <p><strong>Notes:</strong> {trade.notes}</p>
            {trade.screenshot_url && (
              <img src={trade.screenshot_url} alt="Trade Screenshot" className="mt-2 w-full" />
            )}
            <p className="text-sm text-gray-500">
              {new Date(trade.created_at).toLocaleString()}
            </p>
            {trade.rule_broken && <p className="text-red-500">Rule Broken</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;