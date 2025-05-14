import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';

function TradeForm({ supabase, userId, onTradeAdded }) {
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  const [rrRatio, setRrRatio] = useState('');
  const [entry, setEntry] = useState('');
  const [emotions, setEmotions] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [outcome, setOutcome] = useState('');
  const [positionSize, setPositionSize] = useState('');
  const [pair, setPair] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [hadPlan, setHadPlan] = useState(false);
  const [planFollowed, setPlanFollowed] = useState(false);
  const [wasGamble, setWasGamble] = useState(false);
  const [leverage, setLeverage] = useState('');
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (entry && tp && sl) {
      const entryPrice = parseFloat(entry);
      const takeProfit = parseFloat(tp);
      const stopLoss = parseFloat(sl);
      if (!isNaN(entryPrice) && !isNaN(takeProfit) && !isNaN(stopLoss) && entryPrice !== stopLoss) {
        const rr = Math.abs((takeProfit - entryPrice) / (entryPrice - stopLoss)).toFixed(2);
        setRrRatio(rr);
        // Auto-determine direction
        if (takeProfit > entryPrice && stopLoss < entryPrice) {
          setDirection('long');
        } else if (takeProfit < entryPrice && stopLoss > entryPrice) {
          setDirection('short');
        } else {
          setDirection('');
        }
      } else {
        setRrRatio('');
        setDirection('');
      }
    } else {
      setRrRatio('');
      setDirection('');
    }
  }, [entry, tp, sl]);

  useEffect(() => {
    if (status === 'completed' && direction && entry && tp && sl) {
      const entryPrice = parseFloat(entry);
      const takeProfit = parseFloat(tp);
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
    const numericLeverage = parseFloat(leverage.replace('x', '')) || 1;
    const margin = parseFloat(positionSize) / numericLeverage;
    const size = parseFloat(positionSize);
    let exitPrice;
    if (outcome === 'Win' && tp) exitPrice = parseFloat(tp);
    else if (outcome === 'Loss' && sl) exitPrice = parseFloat(sl);
    else if (outcome === 'Breakeven') exitPrice = parseFloat(entry);
    else return null;
    const priceChange = (exitPrice - parseFloat(entry)) / parseFloat(entry);
    return (priceChange * size * numericLeverage - margin).toFixed(2);
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

    if (isNaN(tp) || isNaN(sl) || isNaN(entry) || (rrRatio && isNaN(rrRatio)) || (positionSize && isNaN(positionSize))) {
      setError('Entry, TP, SL, RR Ratio, and Position Size must be valid numbers');
      setLoading(false);
      return;
    }

    if (!direction || !status) {
      setError('Direction could not be determined or Status is missing. Please check Entry, TP, and SL values.');
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
        tp: parseFloat(tp) || 0,
        sl: parseFloat(sl) || 0,
        rr_ratio: parseFloat(rrRatio) || 0,
        emotions: sanitizeInput(emotions) || '',
        notes: sanitizeInput(notes) || '',
        screenshot_url: screenshotUrl,
        outcome: outcome || null,
        position_size: parseFloat(positionSize) || null,
        pair: sanitizeInput(pair) || null,
        tags: tags.trim() ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        leverage: leverage ? parseFloat(leverage.replace('x', '')) : 1,
        profit: profit ? parseFloat(profit) : null,
        direction: direction || null,
        status: status || null,
        is_edited: false,
      };

      console.log('Trade Data:', tradeData);

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

      setTp('');
      setSl('');
      setRrRatio('');
      setEntry('');
      setEmotions('');
      setNotes('');
      setTags('');
      setOutcome('');
      setPositionSize('');
      setPair('');
      setScreenshot(null);
      setHadPlan(false);
      setPlanFollowed(false);
      setWasGamble(false);
      setLeverage('');
      setDirection('');
      setStatus('');
      onTradeAdded();
    } catch (err) {
      setError(`Failed to save trade: ${err.message}`);
    } finally {
      setLoading(false);
    }
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
        <input
          type="text"
          value={pair}
          onChange={(e) => setPair(e.target.value)}
          placeholder="Trading Pair (e.g., BTC/USD)"
          className="futuristic-input"
          aria-label="Trading Pair input"
          disabled={loading}
        />
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
        <input
          type="number"
          value={tp}
          onChange={(e) => setTp(e.target.value)}
          placeholder="Take Profit (TP)"
          className="futuristic-input"
          step="0.01"
          aria-label="Take Profit input"
          disabled={loading}
        />
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
          disabled={true} // Disabled since it's auto-calculated
        />
        <div className="grid grid-cols-1">
          <label className="block text-sm mb-1">
            Leverage
          </label>
          <input
            type="text"
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
            placeholder="Leverage (e.g., x50)"
            list="leverage-presets"
            className="futuristic-input w-full"
            disabled={loading}
          />
          <datalist id="leverage-presets">
            <option value="x25" />
            <option value="x50" />
            <option value="x100" />
            <option value="x500" />
            <option value="x1000" />
            <option value="x2000" />
          </datalist>
        </div>
        <input
          type="text"
          value={direction}
          placeholder="Direction (auto-determined)"
          className="futuristic-input"
          aria-label="Trade Direction"
          disabled={true} // Disabled since it's auto-determined
        />
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
        {/* Updated Checkboxes Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={hadPlan}
              onChange={(e) => setHadPlan(e.target.checked)}
              className="rounded focus:ring-opacity-50"
              aria-label="Had a Plan"
              disabled={loading}
            />
            <span className="text-sm">Had a Plan</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={planFollowed}
              onChange={(e) => {
                setPlanFollowed(e.target.checked);
                if (e.target.checked) setWasGamble(false); // Uncheck "Was a Gamble" if "Plan Followed" is checked
              }}
              className="rounded focus:ring-opacity-50"
              aria-label="Plan Followed"
              disabled={loading || wasGamble} // Disable if "Was a Gamble" is checked
            />
            <span className="text-sm">Plan Followed</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={wasGamble}
              onChange={(e) => {
                setWasGamble(e.target.checked);
                if (e.target.checked) setPlanFollowed(false); // Uncheck "Plan Followed" if "Was a Gamble" is checked
              }}
              className="rounded focus:ring-opacity-50"
              aria-label="Was a Gamble"
              disabled={loading || planFollowed} // Disable if "Plan Followed" is checked
            />
            <span className="text-sm">Was a Gamble</span>
          </label>
        </div>
        {/* Added UI Feedback */}
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
          Note: You can only select either "Plan Followed" or "Was a Gamble", not both.
        </p>
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