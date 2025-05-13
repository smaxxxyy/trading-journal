import { useState, useEffect } from 'react';
import axios from 'axios';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';

const tradeSchema = z.object({
  tp: z.number().positive(),
  sl: z.number().positive(),
  rr_ratio: z.number().positive(),
  emotions: z.string().max(100),
  notes: z.string().max(1000),
});

const predefinedEmotions = ['Confident', 'Nervous', 'Greedy', 'Disciplined', 'Fearful', 'Calm'];

function TradeForm({ supabase, userId, onTradeAdded }) {
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  const [rrRatio, setRrRatio] = useState('');
  const [emotions, setEmotions] = useState('');
  const [notes, setNotes] = useState('');
  const [screenshot, setScreenshot] = useState(null);

  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);

  // RR auto-calculation
  useEffect(() => {
    const tpNum = parseFloat(tp);
    const slNum = parseFloat(sl);
    if (!isNaN(tpNum) && !isNaN(slNum) && slNum !== 0) {
      const calculatedRR = (tpNum / slNum).toFixed(2);
      setRrRatio(calculatedRR);
    }
  }, [tp, sl]);

  const sanitizeInput = (input) => input.replace(/[<>"'&]/g, '');

  const handleEmotionSelect = (tag) => {
    setEmotions(tag);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const parsed = tradeSchema.safeParse({
      tp: parseFloat(tp),
      sl: parseFloat(sl),
      rr_ratio: parseFloat(rrRatio),
      emotions,
      notes,
    });

    if (!parsed.success) {
      setError(parsed.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);
    let screenshotUrl = '';

    if (screenshot) {
      setIsUploading(true);
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
        setError(`Screenshot upload failed: ${errorMessage}`);
        setIsUploading(false);
        setIsSubmitting(false);
        return;
      }
      setIsUploading(false);
    }

    const { error } = await supabase.from('trades').insert([
      {
        user_id: userId,
        tp: parseFloat(tp),
        sl: parseFloat(sl),
        rr_ratio: parseFloat(rrRatio),
        emotions: sanitizeInput(emotions),
        notes: sanitizeInput(notes),
        screenshot_url: screenshotUrl,
        rule_broken: false,
      },
    ]);

    if (error) {
      setError(error.message);
      setIsSubmitting(false);
      return;
    }

    setTp('');
    setSl('');
    setRrRatio('');
    setEmotions('');
    setNotes('');
    setScreenshot(null);
    setSuccessFlash(true);
    setTimeout(() => setSuccessFlash(false), 1200);
    setIsSubmitting(false);
    onTradeAdded();
  };

  return (
    <motion.div
      className="glass-card p-8 mb-8 relative overflow-hidden"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Log a Trade</h3>

      <AnimatePresence>
        {error && (
          <motion.p
            className="text-red-500 mb-4"
            role="alert"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <input
        type="number"
        value={tp}
        onChange={(e) => setTp(e.target.value)}
        placeholder="Take Profit (TP)"
        className="neo-input mb-4"
        step="0.01"
        aria-label="Take Profit input"
      />
      <input
        type="number"
        value={sl}
        onChange={(e) => setSl(e.target.value)}
        placeholder="Stop Loss (SL)"
        className="neo-input mb-4"
        step="0.01"
        aria-label="Stop Loss input"
      />
      <div className="relative mb-2">
        <input
          type="number"
          value={rrRatio}
          readOnly
          placeholder="Risk-Reward Ratio"
          className="neo-input mb-1 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
          aria-label="Risk-Reward Ratio"
        />
        {/* RR Ratio Progress Bar */}
        <div className="h-2 w-full bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{
              width: `${Math.min(rrRatio * 10, 100)}%`, // Clamp to 100%
            }}
          />
        </div>
      </div>

      {/* Emotion Chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {predefinedEmotions.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => handleEmotionSelect(tag)}
            className={`px-3 py-1 rounded-full text-sm border transition ${
              emotions === tag
                ? 'bg-blue-600 text-white border-blue-600 dark:bg-purple-600 dark:border-purple-600'
                : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600'
            }`}
            aria-label={`Emotion tag ${tag}`}
          >
            {tag}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={emotions}
        onChange={(e) => setEmotions(e.target.value)}
        placeholder="Custom emotion (optional)"
        className="neo-input mb-4"
        aria-label="Emotions input"
      />

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes about the trade"
        className="neo-input mb-4 min-h-[120px]"
        aria-label="Trade notes"
      />
      <input
        type="file"
        onChange={(e) => setScreenshot(e.target.files[0])}
        accept="image/png,image/jpeg"
        className="neo-input mb-4 file:neo-button file:bg-gray-300 file:text-gray-900 file:dark:bg-gray-700 file:dark:text-white"
        aria-label="Screenshot upload"
      />

      <AnimatePresence>
        {isUploading && (
          <motion.div
            className="text-blue-600 dark:text-blue-300 text-sm mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            Uploading screenshot...
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={handleSubmit}
        className="neo-button bg-blue-600 dark:bg-purple-600 w-full"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        disabled={isSubmitting}
        aria-label="Add Trade button"
      >
        {isSubmitting ? 'Submitting...' : 'Add Trade'}
      </motion.button>

      <AnimatePresence>
        {successFlash && (
          <motion.div
            className="absolute inset-0 bg-green-500 bg-opacity-20 z-10 rounded-lg pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default TradeForm;
