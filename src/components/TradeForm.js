import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';

function TradeForm({ supabase, userId, onTradeAdded }) {
  const [tp, setTp] = useState(['']); // Array for multiple TPs
  const [sl, setSl] = useState('');
  const [rrRatio, setRrRatio] = useState('');
  const [entry, setEntry] = useState('');
  const [emotions, setEmotions] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [outcome, setOutcome] = useState('');
  const [positionSize, setPositionSize] = useState('');
  const [positionUnit, setPositionUnit] = useState('USD'); // Default to USD for Crypto
  const [pair, setPair] = useState('');
  const [pairSuggestions, setPairSuggestions] = useState([]);
  const [screenshot, setScreenshot] = useState(null);
  const [hadPlan, setHadPlan] = useState(false);
  const [planFollowed, setPlanFollowed] = useState(false);
  const [wasGamble, setWasGamble] = useState(false);
  const [leverage, setLeverage] = useState(1);
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isCrypto, setIsCrypto] = useState(true); // Toggle for Crypto/Forex

  useEffect(() => {
    if (entry && tp[0] && sl) {
      const entryPrice = parseFloat(entry);
      const takeProfit = parseFloat(tp[0]);
      const stopLoss = parseFloat(sl);
      if (!isNaN(entryPrice) && !isNaN(takeProfit) && !isNaN(stopLoss) && entryPrice !== stopLoss) {
        const rr = Math.abs((takeProfit - entryPrice) / (entryPrice - stopLoss)).toFixed(2);
        setRrRatio(rr);
      } else {
        setRrRatio('');
      }
    }
  }, [entry, tp, sl]);

  useEffect(() => {
    if (status === 'completed' && direction && entry && tp[0] && sl) {
      const entryPrice = parseFloat(entry);
      const takeProfit = parseFloat(tp[0]);
      const stopLoss = parseFloat(sl);
      if (direction === 'long') {
        if (takeProfit > entryPrice) setOutcome('Win');
        else if (stopLoss < entryPrice) setOutcome('Loss');
        else setOutcome('Breakeven');
      } else if (direction === 'short') {
        if (takeProfit < entryPrice) setOutcome('Win');
        else if (stopLoss > entryPrice) setOutcome('Loss');
        else setOutcome('Breakeven');
      }
    } else if (status === 'in_progress') {
      setOutcome('In Progress');
    }
  }, [status, direction, entry, tp, sl]);

  const sanitizeInput = (input) => input.replace(/[<>"'&]/g, '');

  const calculateProfit = () => {
    if (!positionSize || !entry || !leverage || !outcome) return null;
    const size = parseFloat(positionSize);
    const entryPrice = parseFloat(entry);
    let exitPrice;
    if (outcome === 'Win' && tp[0]) exitPrice = parseFloat(tp[0]);
    else if (outcome === 'Loss' && sl) exitPrice = parseFloat(sl);
    else if (outcome === 'Breakeven') exitPrice = entryPrice;
    else return null;

    if (isCrypto && positionUnit === 'USD') {
      const initialMargin = size / leverage;
      const priceChange = (exitPrice - entryPrice) / entryPrice;
      return ((priceChange * size * leverage) - initialMargin).toFixed(2);
    } else if (!isCrypto && positionUnit === 'Lots') {
      const pipDifference = Math.abs(exitPrice - entryPrice) * 10000; // Forex pip calculation
      return (pipDifference * size * 10 * leverage).toFixed(2); // 1 lot = 100,000 units, $10 per pip
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!userId) {
      setError('User not authenticated. Please log in again.');
      setLoading(false);
      return;
    }

    if (isNaN(tp[0]) || isNaN(sl) || isNaN(entry) || (rrRatio && isNaN(rrRatio)) || (positionSize && isNaN(positionSize))) {
      setError('Entry, TP, SL, RR Ratio, and Position Size must be valid numbers');
      setLoading(false);
      return;
    }

    if (!direction || !status) {
      setError('Please select Direction and Status');
      setLoading(false);
      return;
    }

    let screenshotUrl = '';
    if (screenshot) {
      const formData = new FormData();
      formData.append('file', screenshot);
      formData.append('upload_preset', 'trading_screenshots');
      try {
        const response = await axios.post(
          'https://api.cloudinary.com/v1_1/dvqcflpn3/image/upload',
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        screenshotUrl = response.data.secure_url;
      } catch (err) {
        const errorMessage = err.response ? err.response.data.error.message : err.message;
        setError(`Failed to upload screenshot: ${errorMessage}`);
        setLoading(false);
        return;
      }
    }

    try {
      const profit = calculateProfit();
      const tradeData = {
        user_id: userId,
        entry: parseFloat(entry) || 0,
        tp: tp.filter(t => t).map(t => parseFloat(t)) || [0],
        sl: parseFloat(sl) || 0,
        rr_ratio: parseFloat(rrRatio) || 0,
        emotions: sanitizeInput(emotions) || '',
        notes: sanitizeInput(notes) || '',
        screenshot_url: screenshotUrl,
        outcome: outcome || null,
        position_size: parseFloat(positionSize) || null,
        position_unit: positionUnit,
        pair: sanitizeInput(pair) || null,
        tags: tags.trim() ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        leverage: parseFloat(leverage) || 1,
        profit: profit ? parseFloat(profit) : null,
        direction: direction || null,
        status: status || null,
        is_edited: false,
        is_crypto: isCrypto,
      };

      const { data, error: supabaseError } = await supabase.from('trades').insert([tradeData]).select();
      if (supabaseError) throw new Error(supabaseError.message);

      const tradeId = data[0].id;
      let streak = 0;
      if (wasGamble) {
        streak = 0;
      } else if (hadPlan && planFollowed) {
        streak = 1;
      }

      await supabase.from('habits').insert({
        user_id: userId,
        trade_id: tradeId,
        plan_followed: planFollowed,
        was_gamble: wasGamble,
        had_plan: hadPlan,
        streak,
      });

      setTp(['']);
      setSl('');
      setRrRatio('');
      setEntry('');
      setEmotions('');
      setNotes('');
      setTags('');
      setOutcome('');
      setPositionSize('');
      setPositionUnit(isCrypto ? 'USD' : 'Lots');
      setPair('');
      setPairSuggestions([]);
      setScreenshot(null);
      setHadPlan(false);
      setPlanFollowed(false);
      setWasGamble(false);
      setLeverage(1);
      setDirection('');
      setStatus('');
      onTradeAdded();
    } catch (err) {
      setError(`Failed to save trade: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const searchPairs = async (query) => {
    if (!isCrypto || !query) {
      setPairSuggestions([]);
      return;
    }
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`
      );
      const suggestions = response.data.coins.map(coin => coin.symbol.toUpperCase() + '/USD');
      setPairSuggestions(suggestions.slice(0, 5)); // Limit to 5 suggestions
    } catch (err) {
      console.error('Error fetching pair suggestions:', err);
      setPairSuggestions([]);
    }
  };

  const handlePairChange = (e) => {
    const value = e.target.value;
    setPair(value);
    if (isCrypto) searchPairs(value);
    else setPairSuggestions([]);
  };

  const addTakeProfit = () => {
    if (tp.length < 5) setTp([...tp, '']); // Limit to 5 TPs
  };

  return (
    <motion.div
      className="futuristic-card holographic-border p-6 mb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      whileHover={{ scale: 1.02 }}
    >
      <h3 className="text-2xl font-bold mb-6" aria-label="Log a Trade">
        Log a Trade
      </h3>
      {error && (
        <motion.p
          className="text-red-400 mb-6 text-sm"
          role="alert"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => {
              setIsCrypto(true);
              setPositionUnit('USD');
              setPair('');
              setPairSuggestions([]);
            }}
            className={`futuristic-button px-3 py-1 text-xs ${isCrypto ? 'bg-[var(--color-button-from)]' : ''}`}
            disabled={loading}
          >
            Crypto
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCrypto(false);
              setPositionUnit('Lots');
              setPair('');
              setPairSuggestions([]);
            }}
            className={`futuristic-button px-3 py-1 text-xs ${!isCrypto ? 'bg-[var(--color-button-from)]' : ''}`}
            disabled={loading}
          >
            Forex
          </button>
        </div>
        <div className="relative">
          <input
            type="text"
            value={pair}
            onChange={handlePairChange}
            placeholder={isCrypto ? "Search Crypto Pair (e.g., BTC/USD)" : "Enter Forex Pair (e.g., EUR/USD)"}
            className="futuristic-input w-full"
            aria-label="Trading Pair input"
            disabled={loading || !isCrypto}
            list="pair-suggestions"
          />
          {pairSuggestions.length > 0 && isCrypto && (
            <ul className="absolute z-10 w-full bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)] rounded mt-1">
              {pairSuggestions.map((suggestion, index) => (
                <li
                  key={index}
                  className="px-3 py-1 text-sm hover:bg-[var(--color-button-from)] cursor-pointer"
                  onClick={() => {
                    setPair(suggestion);
                    setPairSuggestions([]);
                  }}
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={positionSize}
            onChange={(e) => setPositionSize(e.target.value)}
            placeholder="Position Size"
            className="futuristic-input"
            step="0.01"
            aria-label="Position Size input"
            disabled={loading}
          />
          <select
            value={positionUnit}
            disabled={true} // Fixed to USD for Crypto, Lots for Forex
            className="futuristic-select"
            aria-label="Position Unit input"
          >
            <option value="USD">USD</option>
            <option value="Lots">Lots</option>
          </select>
        </div>
        <input
          type="number"
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          placeholder="Entry Price"
          className="futuristic-input"
          step="0.01"
          aria-label="Entry Price input"
          disabled={loading}
        />
        {tp.map((tpValue, index) => (
          <input
            key={index}
            type="number"
            value={tpValue}
            onChange={(e) => {
              const newTp = [...tp];
              newTp[index] = e.target.value;
              setTp(newTp);
            }}
            placeholder={`Take Profit ${index + 1}`}
            className="futuristic-input"
            step="0.01"
            aria-label={`Take Profit ${index + 1} input`}
            disabled={loading}
          />
        ))}
        {tp.length < 5 && (
          <motion.button
            type="button"
            onClick={addTakeProfit}
            className="futuristic-button w-full"
            whileHover={{ scale: loading ? 1 : 1.05 }}
            whileTap={{ scale: loading ? 1 : 0.95 }}
            disabled={loading}
          >
            Add Take Profit
          </motion.button>
        )}
        <input
          type="number"
          value={sl}
          onChange={(e) => setSl(e.target.value)}
          placeholder="Stop Loss (SL)"
          className="futuristic-input"
          step="0.01"
          aria-label="Stop Loss input"
          disabled={loading}
        />
        <input
          type="number"
          value={rrRatio}
          onChange={(e) => setRrRatio(e.target.value)}
          placeholder="Risk-Reward Ratio (auto-calculated)"
          className="futuristic-input"
          step="0.01"
          aria-label="Risk-Reward Ratio input"
          disabled={loading}
        />
        <div className="grid grid-cols-1">
          <label className="block text-sm mb-1 text-[var(--color-text-primary)]">
            Leverage: {leverage}x
          </label>
          <input
            type="range"
            min="1"
            max="2000"
            value={leverage}
            onChange={(e) => setLeverage(parseFloat(e.target.value))}
            onTouchMove={(e) => e.preventDefault()} // Prevent scrolling on touch
            className="w-full h-6 rounded-lg cursor-pointer bg-[var(--color-glass-bg)] accent-[var(--color-accent)]"
            style={{ WebkitAppearance: 'none', appearance: 'none', outline: 'none' }}
            disabled={loading}
            aria-label="Leverage slider"
          />
        </div>
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="futuristic-select"
          aria-label="Trade Direction input"
          disabled={loading}
        >
          <option value="">Select Direction</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="futuristic-select"
          aria-label="Trade Status input"
          disabled={loading}
        >
          <option value="">Select Status</option>
          <option value="completed">Completed</option>
          <option value="in_progress">In Progress</option>
        </select>
        <input
          type="text"
          value={emotions}
          onChange={(e) => setEmotions(e.target.value)}
          placeholder="Emotions (e.g., Confident)"
          className="futuristic-input"
          aria-label="Emotions input"
          disabled={loading}
        />
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags (e.g., Scalping, Swing)"
          className="futuristic-input"
          aria-label="Tags input"
          disabled={loading}
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes about the trade"
          className="futuristic-input min-h-[120px] scrollbar-thin"
          aria-label="Trade notes"
          disabled={loading}
        />
        <input
          type="file"
          onChange={(e) => setScreenshot(e.target.files[0])}
          accept="image/png,image/jpeg"
          className="futuristic-file-input"
          aria-label="Screenshot upload"
          disabled={loading}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex items-center gap-4 p-2">
            <input
              type="checkbox"
              checked={hadPlan}
              onChange={(e) => setHadPlan(e.target.checked)}
              className="w-6 h-6 rounded focus:ring-2 focus:ring-[var(--color-accent)]"
              aria-label="Had a Plan"
              disabled={loading}
            />
            <span className="text-sm text-[var(--color-text-primary)]">Had a Plan</span>
          </label>
          <label className="flex items-center gap-4 p-2">
            <input
              type="checkbox"
              checked={planFollowed}
              onChange={(e) => {
                setPlanFollowed(e.target.checked);
                if (e.target.checked) setWasGamble(false);
              }}
              className="w-6 h-6 rounded focus:ring-2 focus:ring-[var(--color-accent)]"
              aria-label="Plan Followed"
              disabled={loading || wasGamble}
            />
            <span className="text-sm text-[var(--color-text-primary)]">Plan Followed</span>
          </label>
          <label className="flex items-center gap-4 p-2">
            <input
              type="checkbox"
              checked={wasGamble}
              onChange={(e) => {
                setWasGamble(e.target.checked);
                if (e.target.checked) setPlanFollowed(false);
              }}
              className="w-6 h-6 rounded focus:ring-2 focus:ring-[var(--color-accent)]"
              aria-label="Was a Gamble"
              disabled={loading || planFollowed}
            />
            <span className="text-sm text-[var(--color-text-primary)]">Was a Gamble</span>
          </label>
        </div>
        <motion.button
          type="submit"
          className="futuristic-button w-full"
          whileHover={{ scale: loading ? 1 : 1.05 }}
          whileTap={{ scale: loading ? 1 : 0.95 }}
          aria-label="Add Trade button"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Add Trade'}
        </motion.button>
      </form>
    </motion.div>
  );
}

export default TradeForm;