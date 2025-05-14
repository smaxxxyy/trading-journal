import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TradeForm from './TradeForm';
import TradeAnalytics from './TradeAnalytics';
import Papa from 'papaparse';
import { motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';

function Dashboard({ supabase }) {
  const [userId, setUserId] = useState(null);
  const [trades, setTrades] = useState([]);
  const [habits, setHabits] = useState([]);
  const [tagFilter, setTagFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [historyFilter, setHistoryFilter] = useState('today');
  const [rrMin, setRrMin] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalImage, setModalImage] = useState(null);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    const validThemes = ['neon', 'white', 'black', 'grey', 'subtle', 'calm', 'ocean', 'forest', 'sunset', 'cyberpunk', 'fallout', 'neoncity', 'wasteland', 'retrowave'];
    const storedTheme = localStorage.getItem('theme');
    return validThemes.includes(storedTheme) ? storedTheme : 'neon';
  });
  const [prices, setPrices] = useState({ btc: 'Loading...', gold: 'Loading...' });
  const [livePrice, setLivePrice] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [broadcastSignals, setBroadcastSignals] = useState([]);
  const [signalFilter, setSignalFilter] = useState('all');
  const [isSignalsOpen, setIsSignalsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // Added missing state
  const [pairSuggestions, setPairSuggestions] = useState([]); // Added missing state
  const [pairName, setPairName] = useState(''); // Added missing state
  const [message, setMessage] = useState(''); // Added missing state
  const [tp, setTp] = useState(''); // Added missing state
  const [sl, setSl] = useState(''); // Added missing state
  const [entryRangeLower, setEntryRangeLower] = useState(''); // Added missing state
  const [entryRangeUpper, setEntryRangeUpper] = useState(''); // Added missing state
  const [type, setType] = useState(''); // Added missing state
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const fetchPairs = async () => {
      if (searchTerm.length < 2) {
        setPairSuggestions([]);
        return;
      }
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=10&page=1');
        if (!response.ok) throw new Error('Failed to fetch pairs from CoinGecko');
        const data = await response.json();
        const pairs = data.map(coin => ({
          id: coin.id,
          name: `${coin.symbol.toUpperCase()}/USD`,
        }));
        setPairSuggestions(pairs.filter(pair =>
          pair.name.toLowerCase().includes(searchTerm.toLowerCase())
        ));
      } catch (err) {
        console.error('Error fetching pairs from CoinGecko:', err);
      }
    };
    fetchPairs();
  }, [searchTerm]);

  useEffect(() => {
    const fetchUserAndData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login');
          return;
        }
        setUserId(user.id);
        console.log('Your User ID:', user.id);

        const [tradesData, habitsData, signalsData] = await Promise.all([
          supabase
            .from('trades')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('habits')
            .select('*')
            .eq('user_id', user.id),
          supabase
            .from('broadcast_signals')
            .select('*')
            .order('created_at', { ascending: false }),
        ]);

        if (tradesData.error) throw new Error(tradesData.error.message);
        if (habitsData.error) throw new Error(habitsData.error.message);
        if (signalsData.error) throw new Error(signalsData.error.message);

        setTrades(tradesData.data.map(trade => ({
          ...trade,
          tags: Array.isArray(trade.tags) ? trade.tags : trade.tags ? [trade.tags] : [],
        })));
        setHabits(habitsData.data);
        setBroadcastSignals(signalsData.data);

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (userError || !userData) {
          throw new Error('Failed to fetch user role: ' + (userError?.message || 'No user data found'));
        }
        setUserRole(userData.role);

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

    const fetchPrices = async () => {
      try {
        const btcResponse = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
        if (!btcResponse.ok) throw new Error('Failed to fetch BTC price');
        const btcData = await btcResponse.json();
        const btcPrice = btcData.price ? parseFloat(btcData.price).toFixed(2) : 'N/A';

        const goldResponse = await fetch(`https://metals-api.com/api/latest?access_key=${process.env.REACT_APP_METALS_API_KEY || 'your-api-key'}&base=USD&symbols=XAU`);
        if (!goldResponse.ok) throw new Error('Failed to fetch XAU price');
        const goldData = await goldResponse.json();
        const goldPrice = goldData.rates?.XAU ? (1 / goldData.rates.XAU).toFixed(2) : 'N/A';

        setPrices({ btc: btcPrice, gold: goldPrice });
      } catch (err) {
        console.error('Price fetch error:', err);
        setPrices({ btc: 'N/A', gold: 'N/A' });
      }
    };

    fetchUserAndData();
    fetchPrices();
  }, [supabase, navigate]);

  useEffect(() => {
    const subscription = supabase
      .channel('broadcast_signals')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'broadcast_signals' },
        (payload) => {
          setBroadcastSignals((prev) => [payload.new, ...prev]);
          toast.success(`New Trading Signal: ${payload.new.message}`, { duration: 5000 });
          if (Notification.permission === 'granted') {
            new Notification('New Trading Signal', {
              body: payload.new.message,
              icon: '/path-to-icon.png',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }

    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          console.log('Notification permission granted');
        }
      });
    }
  }, []);

  useEffect(() => {
    if (selectedTrade?.trade?.status === 'in_progress') {
      const fetchInitialPrice = async () => {
        setLivePrice('Fetching...');
        const price = await fetchLivePrice(selectedTrade.trade.pair);
        setLivePrice(price);
      };
      fetchInitialPrice();

      const interval = setInterval(async () => {
        const price = await fetchLivePrice(selectedTrade.trade.pair);
        setLivePrice(price);
      }, 60000);
      return () => clearInterval(interval);
    } else {
      setLivePrice(null);
    }
  }, [selectedTrade]);

  const fetchLivePrice = async (pair, retries = 3) => {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (pair.toUpperCase().includes('/USD')) {
          const symbol = pair.toUpperCase().replace('/USD', '').toLowerCase();
          const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=usd`);
          if (!response.ok) throw new Error('Failed to fetch price from CoinGecko');
          const data = await response.json();
          return data[symbol]?.usd?.toFixed(2) || 'N/A';
        } else {
          const symbol = pair.toUpperCase().replace('/', '');
          const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
          if (!response.ok) throw new Error('Failed to fetch price from Binance');
          const data = await response.json();
          return data.price ? parseFloat(data.price).toFixed(2) : 'N/A';
        }
      } catch (err) {
        if (attempt === retries) {
          if (pair.toUpperCase().includes('/USD') || pair.includes('/')) {
            try {
              const symbol = pair.toUpperCase().replace('/', '').toLowerCase();
              const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@ticker`);
              return new Promise((resolve) => {
                ws.onmessage = (event) => {
                  const data = JSON.parse(event.data);
                  ws.close();
                  resolve(data.c ? parseFloat(data.c).toFixed(2) : 'Unavailable');
                };
                ws.onerror = () => {
                  ws.close();
                  resolve('Unavailable');
                };
                setTimeout(() => {
                  ws.close();
                  resolve('Unavailable');
                }, 5000);
              });
            } catch (wsErr) {
              console.error('WebSocket price fetch error:', wsErr);
              return 'Unavailable';
            }
          }
          return 'Unavailable';
        }
        await delay(2000 * Math.pow(2, attempt));
      }
    }
  };

  const handleEditTrade = async (tradeId, updatedData) => {
    try {
      const trade = trades.find(t => t.id === tradeId);
      if (trade.status === 'in_progress') {
        updatedData = { 
          ...(updatedData.tp ? { tp: parseFloat(updatedData.tp) } : {}), 
          ...(updatedData.sl ? { sl: parseFloat(updatedData.sl) } : {}), 
          ...(updatedData.multiple_tps ? { multiple_tps: updatedData.multiple_tps.map(tp => parseFloat(tp)) } : {}),
          ...(updatedData.status ? { status: updatedData.status } : {}),
          ...(updatedData.outcome ? { outcome: updatedData.outcome } : {}),
          ...(updatedData.profit ? { profit: parseFloat(updatedData.profit) } : {}),
          ...(updatedData.is_edited ? { is_edited: updatedData.is_edited } : {}),
          ...(updatedData.direction ? { direction: updatedData.direction } : {}),
        };
      }
      const { error: tradeError } = await supabase
        .from('trades')
        .update(updatedData)
        .eq('id', tradeId)
        .eq('user_id', userId);
      if (tradeError) throw new Error(tradeError.message);
      const updatedTrades = trades.map(t =>
        t.id === tradeId ? { ...t, ...updatedData } : t
      );
      setTrades(updatedTrades);
      setSelectedTrade({
        trade: { ...selectedTrade.trade, ...updatedData },
        habit: selectedTrade.habit,
      });
    } catch (err) {
      console.error('Edit trade error:', err);
      setError(`Failed to edit trade: ${err.message}`);
    }
  };

  const calculateStreak = (trades) => {
    let currentTrades = 0;
    let maxTrades = 0;
    let currentDays = new Set();
    let maxDays = 0;
    let lastDate = null;

    trades.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(trade => {
      const tradeDate = new Date(trade.created_at).toDateString();
      if (trade.was_gamble) {
        currentTrades = 0;
        currentDays.clear();
      } else {
        currentTrades += 1;
        currentDays.add(tradeDate);
        if (lastDate && tradeDate !== lastDate) currentDays.add(tradeDate);
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
        supabase.from('trades').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('habits').select('*').eq('user_id', userId),
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
        leverage: trade.leverage || 'N/A',
        profit: trade.profit || 'N/A',
      };
    });
    const csv = Papa.unparse(enrichedTrades);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'trades.csv');
    link.click();
    setIsMenuOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
    setIsMenuOpen(false);
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    const message = e.target.message.value;
    const pairName = e.target.pairName.value;
    const tp = e.target.tp.value;
    const sl = e.target.sl.value;
    const entryRangeLower = e.target.entryRangeLower.value;
    const entryRangeUpper = e.target.entryRangeUpper.value;
    const type = e.target.type.value;

    if (!message || !pairName || !tp || !sl || !entryRangeLower || !entryRangeUpper || !type) {
      setError('Please fill in all fields');
      return;
    }

    const broadcastData = {
      user_id: userId,
      message,
      pair_name: pairName,
      tp: parseFloat(tp),
      sl: parseFloat(sl),
      entry_range_lower: parseFloat(entryRangeLower),
      entry_range_upper: parseFloat(entryRangeUpper),
      type,
    };
    console.log('Broadcast Data:', broadcastData);

    const { error } = await supabase
      .from('broadcast_signals')
      .insert([broadcastData]);

    if (error) {
      setError(`Failed to broadcast signal: ${error.message}`);
      return;
    }
    e.target.reset();
    setSearchTerm('');
    setPairName('');
    setTp('');
    setSl('');
    setEntryRangeLower('');
    setEntryRangeUpper('');
    setType('');
    setError(null);
    toast.success('Signal broadcasted successfully!');
  };

  const filteredTrades = trades.filter(trade => {
    const tradeDate = new Date(trade.created_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = today;
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(today.getMonth() - 1);

    let matchesTime = true;
    if (historyFilter === 'today') matchesTime = tradeDate.toDateString() === startOfToday.toDateString();
    else if (historyFilter === 'weekly') matchesTime = tradeDate >= oneWeekAgo && tradeDate <= today;
    else if (historyFilter === 'monthly') matchesTime = tradeDate >= oneMonthAgo && tradeDate <= today;
    else if (historyFilter === 'all') matchesTime = true;

    const matchesTag = tagFilter ? trade.tags.includes(tagFilter) : true;
    const matchesOutcome = outcomeFilter ? trade.outcome === outcomeFilter : true;
    const matchesRr = rrMin ? (trade.rr_ratio || 0) >= parseFloat(rrMin) : true;
    return matchesTime && matchesTag && matchesOutcome && matchesRr;
  });

  const groupTradesByDay = () => {
    const grouped = {};
    filteredTrades.forEach(trade => {
      const date = new Date(trade.created_at).toLocaleDateString();
      if (!grouped[date]) grouped[date] = [];
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
      if (outcomes.wins > outcomes.losses) message = 'Great job dominating the market today!';
      else if (outcomes.losses >= 3) message = 'Tough day, but every loss is a lesson. Keep refining your strategy!';

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
        const x = (e.clientX - rect.left - rect.width / 2) / 30;
        const y = (e.clientY - rect.top - rect.height / 2) / 30;
        setMousePosition({ x, y });
      }
    };

    return (
      <motion.div
        ref={cardRef}
        className="futuristic-card holographic-border p-4 grid grid-cols-2 gap-2 text-xs min-h-[160px] cursor-pointer"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        whileHover={{ scale: 1.02 }}
        style={{ transform: `perspective(1000px) rotateX(${mousePosition.y}deg) rotateY(${mousePosition.x}deg)` }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMousePosition({ x: 0, y: 0 })}
        onClick={() => setSelectedTrade({ trade, habit })}
      >
        <p className="font-medium">Pair</p>
        <p>{trade.pair || 'N/A'}</p>
        <p className="font-medium">Outcome</p>
        <p>{trade.outcome || 'N/A'}</p>
        <p className="font-medium">RR</p>
        <p>{trade.rr_ratio?.toFixed(2) || 'N/A'}</p>
        <p className="font-medium">Leverage</p>
        <p>{trade.leverage?.toFixed(0)}x</p>
        <p className="font-medium">Profit</p>
        <p>{trade.profit?.toFixed(2) || 'N/A'}</p>
        <p className="font-medium">Plan</p>
        <p>{habit?.had_plan ? 'Yes' : 'No'}</p>
        <div className="col-span-2 flex gap-2 mt-2">
          <motion.button
            onClick={(e) => { e.stopPropagation(); setSelectedTrade({ trade, habit }); }}
            className="futuristic-button flex-1 text-xs py-1.5"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="View trade details"
          >
            View
          </motion.button>
          <motion.button
            onClick={(e) => { e.stopPropagation(); handleDeleteTrade(trade.id); }}
            className="futuristic-button from-red-500 to-red-600 flex-1 text-xs py-1.5"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Delete trade"
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
          <h2 className="text-2xl font-bold">Loading...</h2>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container py-8 relative">
      <Toaster position="top-right" />
      <motion.div
        className="flex justify-between items-center mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl font-extrabold" aria-label="Trading Journal Dashboard">
          Trading Journal
        </h2>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 rounded-lg bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)]"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </motion.div>
      <div className="mb-6 text-xs">
        <p aria-live="polite">BTC/USD: ${prices.btc}</p>
        <p aria-live="polite">XAU/USD: ${prices.gold}</p>
      </div>
      {isMenuOpen && (
        <motion.div
          className="absolute top-14 right-0 futuristic-card holographic-border p-4 w-48 sm:w-56 max-h-[80vh] overflow-y-auto z-50"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex flex-col gap-2 text-xs">
            <motion.button
              onClick={handleExport}
              className="futuristic-button text-left py-2 px-3"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Export trades to CSV"
            >
              Export Trades
            </motion.button>
            <motion.button
              onClick={handleLogout}
              className="futuristic-button from-red-500 to-red-600 text-left py-2 px-3"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Log out"
            >
              Logout
            </motion.button>
            <div className="border-t border-[var(--color-glass-border)] my-2"></div>
            <p className="font-medium">Trade History</p>
            <select
              value={historyFilter}
              onChange={(e) => { setHistoryFilter(e.target.value); setIsMenuOpen(false); }}
              className="futuristic-select text-xs py-2"
              aria-label="Filter trade history"
            >
              <option value="today">Today</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="all">All</option>
            </select>
            <p className="font-medium mt-2">Theme</p>
            <select
              value={theme}
              onChange={(e) => { setTheme(e.target.value); setIsMenuOpen(false); }}
              className="futuristic-select text-xs py-2"
              aria-label="Select theme"
            >
              <option value="neon">Neon</option>
              <option value="white">White</option>
              <option value="black">Black</option>
              <option value="grey">Grey</option>
              <option value="subtle">Subtle</option>
              <option value="calm">Calm</option>
              <option value="ocean">Ocean</option>
              <option value="forest">Forest</option>
              <option value="sunset">Sunset</option>
              <option value="cyberpunk">Cyberpunk</option>
              <option value="fallout">Fallout</option>
              <option value="neoncity">Neon City</option>
              <option value="wasteland">Wasteland</option>
              <option value="retrowave">Retrowave</option>
            </select>
            <motion.button
              onClick={() => setIsSignalsOpen(!isSignalsOpen)}
              className="w-full text-left px-4 py-2 text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Trading Signals
            </motion.button>
            {isSignalsOpen && (
              <motion.div
                className="pl-4"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <div className="mb-2">
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Filter Signals
                  </label>
                  <select
                    value={signalFilter}
                    onChange={(e) => setSignalFilter(e.target.value)}
                    className="futuristic-input w-full"
                  >
                    <option value="all">All</option>
                    <option value="crypto">Crypto</option>
                    <option value="forex">Forex</option>
                  </select>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {broadcastSignals
                    .filter((signal) => signalFilter === 'all' || signal.type === signalFilter)
                    .map((signal) => (
                      <div
                        key={signal.id}
                        className="p-2 border-b border-[var(--color-glass-border)] text-sm text-[var(--color-text-primary)]"
                      >
                        <p><strong>Pair:</strong> {signal.pair_name}</p>
                        <p><strong>Message:</strong> {signal.message}</p>
                        <p><strong>TP:</strong> {signal.tp}</p>
                        <p><strong>SL:</strong> {signal.sl}</p>
                        <p><strong>Entry Range:</strong> {signal.entry_range_lower} - {signal.entry_range_upper}</p>
                        <p><strong>Type:</strong> {signal.type}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {new Date(signal.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
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
          {userRole === 'master' && (
            <motion.div
              className="futuristic-card p-6 mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                Broadcast Trading Signal
              </h2>
              <form
                onSubmit={handleBroadcast}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Search Pair
                  </label>
                  <input
                    type="text"
                    placeholder="Search for a pair (e.g., BTC/USD)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="futuristic-input w-full"
                  />
                  {pairSuggestions.length > 0 && (
                    <ul className="border border-[var(--color-glass-border)] mt-1 max-h-40 overflow-y-auto bg-[var(--color-glass-bg)] rounded-lg">
                      {pairSuggestions.map((pair) => (
                        <li
                          key={pair.id}
                          onClick={() => {
                            setPairName(pair.name);
                            setSearchTerm('');
                            setPairSuggestions([]);
                          }}
                          className="cursor-pointer p-2 hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                        >
                          {pair.name}
                        </li>
                      ))}
                    </ul>
                  )}
                  <input
                    type="text"
                    name="pairName"
                    placeholder="Selected Pair"
                    value={pairName}
                    onChange={(e) => setPairName(e.target.value)}
                    className="futuristic-input w-full mt-2"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Signal Message
                  </label>
                  <textarea
                    name="message"
                    placeholder="e.g., Buy signal details"
                    className="futuristic-input w-full"
                    rows="3"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Take Profit (TP)
                  </label>
                  <input
                    type="number"
                    name="tp"
                    placeholder="Take Profit"
                    className="futuristic-input w-full"
                    step="0.01"
                    value={tp}
                    onChange={(e) => setTp(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Stop Loss (SL)
                  </label>
                  <input
                    type="number"
                    name="sl"
                    placeholder="Stop Loss"
                    className="futuristic-input w-full"
                    step="0.01"
                    value={sl}
                    onChange={(e) => setSl(e.target.value)}
                  />
                </div>
                <div className="flex space-x-2">
                  <div className="w-1/2">
                    <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                      Entry Range Lower
                    </label>
                    <input
                      type="number"
                      name="entryRangeLower"
                      placeholder="Lower Range"
                      className="futuristic-input w-full"
                      step="0.01"
                      value={entryRangeLower}
                      onChange={(e) => setEntryRangeLower(e.target.value)}
                    />
                  </div>
                  <div className="w-1/2">
                    <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                      Entry Range Upper
                    </label>
                    <input
                      type="number"
                      name="entryRangeUpper"
                      placeholder="Upper Range"
                      className="futuristic-input w-full"
                      step="0.01"
                      value={entryRangeUpper}
                      onChange={(e) => setEntryRangeUpper(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Signal Type
                  </label>
                  <select
                    name="type"
                    className="futuristic-input w-full"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="">Select Type</option>
                    <option value="crypto">Crypto</option>
                    <option value="forex">Forex</option>
                  </select>
                </div>
                <motion.button
                  type="submit"
                  className="futuristic-button w-full"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Broadcast Signal
                </motion.button>
              </form>
            </motion.div>
          )}
          <TradeForm supabase={supabase} userId={userId} onTradeAdded={handleTradeAdded} />
          <TradeAnalytics trades={trades} streakData={streakData} supabase={supabase} userId={userId} />
          <motion.div
            className="futuristic-card holographic-border p-6 mb-16 sm:mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h3 className="text-xl font-bold mb-4" aria-label="Trade History">
              Trade History
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <input
                type="text"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="Filter by tag (e.g., Scalping)"
                className="futuristic-input"
                aria-label="Filter trades by tag"
              />
              <select
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value)}
                className="futuristic-select"
                aria-label="Filter trades by outcome"
              >
                <option value="">All Outcomes</option>
                <option value="Win">Win</option>
                <option value="Loss">Loss</option>
                <option value="Breakeven">Breakeven</option>
              </select>
              <input
                type="number"
                value={rrMin}
                onChange={(e) => setRrMin(e.target.value)}
                placeholder="Min RR Ratio"
                className="futuristic-input"
                step="0.01"
                aria-label="Filter trades by minimum RR ratio"
              />
            </div>
            {dailyGroups.length === 0 ? (
              <p className="text-sm text-center">No trades match the filter.</p>
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
                    <h4 className="text-lg font-bold mb-3">{group.date}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-sm">
                      <p><span className="font-medium">Total Trades:</span> {group.totalTrades}</p>
                      <p><span className="font-medium">Wins:</span> {group.outcomes.wins}</p>
                      <p><span className="font-medium">Losses:</span> {group.outcomes.losses}</p>
                      <p><span className="font-medium">Breakevens:</span> {group.outcomes.breakevens}</p>
                      <p><span className="font-medium">Average RR:</span> {group.avgRr}</p>
                    </div>
                    {group.message && <p className="text-sm font-medium mb-3">{group.message}</p>}
                    <div className="grid grid-cols-1 gap-3">
                      {group.trades.map(trade => <TradeCard key={trade.id} trade={trade} />)}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
          {modalImage && (
            <motion.div
              className="fixed inset-0 bg-[var(--color-bg-dark)] bg-opacity-80 flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalImage(null)}
            >
              <img src={modalImage} alt="Full trade screenshot" className="max-w-[90%] max-h-[90%] rounded-2xl" />
            </motion.div>
          )}
          {selectedTrade && (
            <motion.div
              className="fixed inset-0 bg-[var(--color-bg-dark)] bg-opacity-80 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTrade(null)}
            >
              <div className="futuristic-card holographic-border p-6 max-w-md w-full sm:max-w-lg" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">Trade Details</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p className="font-medium">Pair</p>
                  <p>{selectedTrade.trade.pair || 'N/A'}</p>
                  {selectedTrade.trade.status === 'in_progress' && (
                    <>
                      <p className="font-medium">Current Price</p>
                      <p aria-live="polite" aria-label="Current market price">{livePrice ? `${selectedTrade.trade.pair}: $${livePrice}` : 'Fetching...'}</p>
                    </>
                  )}
                  <p className="font-medium">Position Size</p>
                  <p>{selectedTrade.trade.position_size?.toFixed(2) || 'N/A'} {selectedTrade.trade.position_unit}</p>
                  <p className="font-medium">Entry</p>
                  <p>{selectedTrade.trade.entry?.toFixed(2) || 'N/A'}</p>
                  {selectedTrade.trade.status === 'in_progress' && (
                    <>
                      <p className="font-medium">Take Profit</p>
                      {selectedTrade.trade.multiple_tps ? selectedTrade.trade.multiple_tps.map((tpValue, index) => (
                        <input
                          key={index}
                          type="number"
                          value={tpValue}
                          onChange={(e) => {
                            const newTp = [...(selectedTrade.trade.multiple_tps || [selectedTrade.trade.tp || ''])];
                            newTp[index] = e.target.value;
                            handleEditTrade(selectedTrade.trade.id, { multiple_tps: newTp });
                          }}
                          className="futuristic-input text-xs mt-1"
                          step="0.01"
                          aria-label={`Take Profit ${index + 1} edit`}
                        />
                      )) : (
                        <input
                          type="number"
                          value={selectedTrade.trade.tp || ''}
                          onChange={(e) => handleEditTrade(selectedTrade.trade.id, { tp: e.target.value })}
                          className="futuristic-input text-xs mt-1"
                          step="0.01"
                          aria-label="Take Profit edit"
                        />
                      )}
                      <p className="font-medium">Stop Loss</p>
                      <input
                        type="number"
                        value={selectedTrade.trade.sl}
                        onChange={(e) => handleEditTrade(selectedTrade.trade.id, { sl: e.target.value })}
                        className="futuristic-input text-xs mt-1"
                        step="0.01"
                        aria-label="Stop Loss edit"
                      />
                    </>
                  )}
                  {selectedTrade.trade.status !== 'in_progress' && (
                    <>
                      <p className="font-medium">Take Profit</p>
                      <p>{selectedTrade.trade.multiple_tps ? selectedTrade.trade.multiple_tps.join(', ') : selectedTrade.trade.tp?.toFixed(2) || 'N/A'}</p>
                      <p className="font-medium">Stop Loss</p>
                      <p>{selectedTrade.trade.sl?.toFixed(2) || 'N/A'}</p>
                    </>
                  )}
                  <p className="font-medium">Direction</p>
                  <p>{selectedTrade.trade.direction || 'N/A'}</p>
                  <p className="font-medium">Status</p>
                  <p>{selectedTrade.trade.status || 'N/A'}</p>
                  <p className="font-medium">Outcome</p>
                  <p>{selectedTrade.trade.outcome || 'N/A'}</p>
                  <p className="font-medium">RR Ratio</p>
                  <p>{selectedTrade.trade.rr_ratio?.toFixed(2) || 'N/A'}</p>
                  <p className="font-medium">Leverage</p>
                  <p>{selectedTrade.trade.leverage?.toFixed(0)}x</p>
                  <p className="font-medium">Profit (PnL)</p>
                  <p>{selectedTrade.trade.profit?.toFixed(2) || 'N/A'}</p>
                  <p className="font-medium">Had Plan</p>
                  <p>{selectedTrade.habit?.had_plan ? 'Yes' : 'No'}</p>
                  <p className="font-medium">Plan Followed</p>
                  <p>{selectedTrade.habit?.plan_followed ? 'Yes' : 'No'}</p>
                  <p className="font-medium">Was Gamble</p>
                  <p>{selectedTrade.habit?.was_gamble ? 'Yes' : 'No'}</p>
                  <p className="font-medium">Tags</p>
                  <p>{selectedTrade.trade.tags?.join(', ') || 'N/A'}</p>
                  {selectedTrade.trade.screenshot_url && (
                    <>
                      <p className="font-medium">Screenshot</p>
                      <button onClick={() => setModalImage(selectedTrade.trade.screenshot_url)} aria-label="View trade screenshot">
                        <img
                          src={selectedTrade.trade.screenshot_url}
                          alt="Trade screenshot thumbnail"
                          className="rounded-lg w-16 h-16 object-cover border border-[var(--color-glass-border)]"
                        />
                      </button>
                    </>
                  )}
                </div>
                {selectedTrade.trade.status === 'in_progress' && !selectedTrade.trade.is_edited && (
                  <motion.button
                    onClick={async () => {
                      try {
                        const outcome = determineOutcome(selectedTrade.trade, livePrice);
                        const profit = calculateTradeProfit(selectedTrade.trade, livePrice, outcome);
                        await handleEditTrade(selectedTrade.trade.id, {
                          status: 'completed',
                          outcome,
                          is_edited: true,
                          profit,
                        });
                      } catch (err) {
                        setError(`Failed to mark trade as completed: ${err.message}`);
                      }
                    }}
                    className="futuristic-button w-full mt-4"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Mark trade as completed"
                  >
                    Mark as Completed
                  </motion.button>
                )}
                <motion.button
                  onClick={() => setSelectedTrade(null)}
                  className="futuristic-button w-full mt-1"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Close trade details"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

const determineOutcome = (trade, livePrice) => {
  const { entry, tp, multiple_tps, sl, direction, status } = trade;
  const entryPrice = parseFloat(entry);
  const stopLoss = parseFloat(sl);
  const takeProfits = multiple_tps ? multiple_tps.map(tp => parseFloat(tp)) : [parseFloat(tp)];
  const currentPrice = livePrice && livePrice !== 'Unavailable' && !isNaN(livePrice) ? parseFloat(livePrice) : null;
  
  if (status === 'in_progress') {
    if (currentPrice) {
      if (direction === 'long') {
        if (takeProfits.some(tp => tp && currentPrice >= tp)) return 'Win';
        if (stopLoss && currentPrice <= stopLoss) return 'Loss';
      } else if (direction === 'short') {
        if (takeProfits.some(tp => tp && currentPrice <= tp)) return 'Win';
        if (stopLoss && currentPrice >= stopLoss) return 'Loss';
      }
    } else {
      if (direction === 'long') {
        if (takeProfits.some(tp => tp && tp > entryPrice)) return 'Win';
        if (stopLoss && stopLoss < entryPrice) return 'Loss';
      } else if (direction === 'short') {
        if (takeProfits.some(tp => tp && tp < entryPrice)) return 'Win';
        if (stopLoss && stopLoss > entryPrice) return 'Loss';
      }
    }
  }
  return 'Breakeven';
};

const calculateTradeProfit = (trade, livePrice, outcome) => {
  const { entry, position_size, leverage, position_unit, is_crypto, multiple_tps, tp, sl } = trade;
  const entryPrice = parseFloat(entry);
  const size = parseFloat(position_size);
  let exitPrice;
  
  if (outcome === 'Win') {
    exitPrice = multiple_tps && multiple_tps[0] ? parseFloat(multiple_tps[0]) : parseFloat(tp || entry);
  } else if (outcome === 'Loss') {
    exitPrice = parseFloat(sl || entry);
  } else if (outcome === 'Breakeven') {
    exitPrice = entryPrice;
  } else {
    exitPrice = livePrice && livePrice !== 'Unavailable' && !isNaN(livePrice) ? parseFloat(livePrice) : entryPrice;
  }
  
  if (isNaN(exitPrice)) return '0.00';
  
  try {
    if (is_crypto && position_unit === 'USD') {
      const initialMargin = size / leverage;
      const priceChange = (exitPrice - entryPrice) / entryPrice;
      return ((priceChange * size * leverage) - initialMargin).toFixed(2);
    } else if (!is_crypto && position_unit === 'Lots') {
      const pipDifference = Math.abs(exitPrice - entryPrice) * 10000;
      return (pipDifference * size * 10 * leverage).toFixed(2);
    }
    return '0.00';
  } catch (err) {
    console.error('Profit calculation error:', err);
    return '0.00';
  }
};

export default Dashboard;