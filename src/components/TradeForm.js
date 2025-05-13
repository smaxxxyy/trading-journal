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
  const [positionUnit, setPositionUnit] = useState('');
  const [pair, setPair] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [hadPlan, setHadPlan] = useState(false);
  const [planFollowed, setPlanFollowed] = useState(false);
  const [wasGamble, setWasGamble] = useState(false);
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
      } else {
        setRrRatio('');
      }
    } else {
      setRrRatio('');
    }
  }, [entry, tp, sl]);

  const sanitizeInput = (input) => input.replace(/[<>"'&]/g, '');

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
      const tradeData = {
        user_id: userId,
        entry: parseFloat(entry) || 0,
        tp: parseFloat(tp) || 0,
        sl: parseFloat(sl) || 0,
        rr_ratio: parseFloat(rrRatio) || 0,
        emotions: sanitizeInput(emotions) || '',
        notes: sanitizeInput(notes) || '',
        screenshot_url: screenshotUrl,
        rule_broken: wasGamble,
        outcome: outcome || null,
        position_size: parseFloat(positionSize) || null,
        position_unit: positionUnit || null,
        pair: sanitizeInput(pair) || null,
        tags: tags.trim() ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
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

      setTp('');
      setSl('');
      setRrRatio('');
      setEntry('');
      setEmotions('');
      setNotes('');
      setTags('');
      setOutcome('');
      setPositionSize('');
      setPositionUnit('');
      setPair('');
      setScreenshot(null);
      setHadPlan(false);
      setPlanFollowed(false);
      setWasGamble(false);
      onTradeAdded();
    } catch (err) {
      setError(`Failed to save trade: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="futuristic-card holographic-border"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      whileHover={{ scale: 1.02, rotateX: 5, rotateY: 5 }}
    >
      <h3 className="text-3xl font-bold text-[var(--neon-blue)] mb-8" aria-label="Log a Trade">
        Log a Trade
      </h3>
      {error && (
        <motion.p
          className="text-red-400 mb-8"
          role="alert"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.p>
      )}
      <input
        type="text"
        value={pair}
        onChange={(e) => setPair(e.target.value)}
        placeholder="Trading Pair (e.g., BTC/USD)"
        className="futuristic-input mb-6"
        aria-label="Trading Pair input"
        disabled={loading}
      />
      <input
        type="number"
        value={entry}
        onChange={(e) => setEntry(e.target.value)}
        placeholder="Entry Price"
        className="futuristic-input mb-6"
        step="0.01"
        aria-label="Entry Price input"
        disabled={loading}
      />
      <input
        type="number"
        value={tp}
        onChange={(e) => setTp(e.target.value)}
        placeholder="Take Profit (TP)"
        className="futuristic-input mb-6"
        step="0.01"
        aria-label="Take Profit input"
        disabled={loading}
      />
      <input
        type="number"
        value={sl}
        onChange={(e) => setSl(e.target.value)}
        placeholder="Stop Loss (SL)"
        className="futuristic-input mb-6"
        step="0.01"
        aria-label="Stop Loss input"
        disabled={loading}
      />
      <input
        type="number"
        value={rrRatio}
        onChange={(e) => setRrRatio(e.target.value)}
        placeholder="Risk-Reward Ratio (auto-calculated)"
        className="futuristic-input mb-6"
        step="0.01"
        aria-label="Risk-Reward Ratio input"
        disabled={loading}
      />
      <div className="flex gap-4 mb-6">
        <input
          type="number"
          value={positionSize}
          onChange={(e) => setPositionSize(e.target.value)}
          placeholder="Position Size"
          className="futuristic-input flex-1"
          step="0.01"
          aria-label="Position Size input"
          disabled={loading}
        />
        <select
          value={positionUnit}
          onChange={(e) => setPositionUnit(e.target.value)}
          className="futuristic-select w-32" // Reduced width
          aria-label="Position Unit input"
          disabled={loading}
        >
          <option value="">Unit</option>
          <option value="Lots">Lots</option>
          <option value="USD">USD</option>
          <option value="Coin Value">Coin Value</option>
        </select>
      </div>
      <select
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        className="futuristic-select mb-6"
        aria-label="Trade Outcome input"
        disabled={loading}
      >
        <option value="">Select Outcome</option>
        <option value="Win">Win</option>
        <option value="Loss">Loss</option>
        <option value="Breakeven">Breakeven</option>
      </select>
      <input
        type="text"
        value={emotions}
        onChange={(e) => setEmotions(e.target.value)}
        placeholder="Emotions (e.g., Confident)"
        className="futuristic-input mb-6"
        aria-label="Emotions input"
        disabled={loading}
      />
      <input
        type="text"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="Tags (e.g., Scalping, Swing)"
        className="futuristic-input mb-6"
        aria-label="Tags input"
        disabled={loading}
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes about the trade"
        className="futuristic-input mb-6 min-h-[150px] scrollbar-thin scrollbar-thumb-[var(--neon-purple)] scrollbar-track-[var(--glass-bg)]"
        aria-label="Trade notes"
        disabled={loading}
      />
      <input
        type="file"
        onChange={(e) => setScreenshot(e.target.files[0])}
        accept="image/png,image/jpeg"
        className="futuristic-file-input mb-6"
        aria-label="Screenshot upload"
        disabled={loading}
      />
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-4">
          <input
            type="checkbox"
            checked={hadPlan}
            onChange={(e) => setHadPlan(e.target.checked)}
            className="h-6 w-6 text-[var(--neon-purple)] rounded border-gray-300 focus:ring-[var(--neon-purple)]"
            aria-label="Had a Plan"
            disabled={loading}
          />
          <p className="text-white text-lg">Had a Plan</p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="checkbox"
            checked={planFollowed}
            onChange={(e) => setPlanFollowed(e.target.checked)}
            className="h-6 w-6 text-[var(--neon-purple)] rounded border-gray-300 focus:ring-[var(--neon-purple)]"
            aria-label="Plan Followed"
            disabled={loading}
          />
          <p className="text-white text-lg">Plan Followed</p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="checkbox"
            checked={wasGamble}
            onChange={(e) => setWasGamble(e.target.checked)}
            className="h-6 w-6 text-[var(--neon-purple)] rounded border-gray-300 focus:ring-[var(--neon-purple)]"
            aria-label="Was a Gamble"
            disabled={loading}
          />
          <p className="text-white text-lg">Was a Gamble</p>
        </div>
      </div>
      <motion.button
        onClick={handleSubmit}
        className="futuristic-button w-full"
        whileHover={{ scale: loading ? 1 : 1.1 }}
        whileTap={{ scale: loading ? 1 : 0.9 }}
        aria-label="Add Trade button"
        disabled={loading}
      >
        {loading ? 'Saving...' : 'Add Trade'}
      </motion.button>
    </motion.div>
  );
}

export default TradeForm;