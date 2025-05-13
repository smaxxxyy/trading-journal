import { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';

function TradeForm({ supabase, userId, onTradeAdded }) {
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  const [rrRatio, setRrRatio] = useState('');
  const [emotions, setEmotions] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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

    if (isNaN(tp) || isNaN(sl) || isNaN(rrRatio)) {
      setError('TP, SL, and RR Ratio must be numbers');
      setLoading(false);
      return;
    }

    let screenshotUrl = '';
    if (screenshot) {
      const formData = new FormData();
      formData.append('file', screenshot);
      formData.append('upload_preset', 'trading_screenshots');

      try {
        console.log('Starting Cloudinary upload:', {
          cloudName: 'dvqcflpn3',
          preset: 'trading_screenshots',
          fileName: screenshot.name,
          fileSize: screenshot.size,
          fileType: screenshot.type,
        });
        const response = await axios.post(
          'https://api.cloudinary.com/v1_1/dvqcflpn3/image/upload',
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        console.log('Cloudinary response:', response.data);
        screenshotUrl = response.data.secure_url;
      } catch (err) {
        const errorMessage = err.response ? err.response.data.error.message : err.message;
        console.error('Cloudinary upload error:', {
          message: errorMessage,
          status: err.response ? err.response.status : 'N/A',
          details: err.response ? err.response.data : err,
        });
        setError(`Failed to upload screenshot: ${errorMessage}`);
        setLoading(false);
        return;
      }
    }

    try {
      const tradeData = {
        user_id: userId,
        tp: parseFloat(tp) || 0,
        sl: parseFloat(sl) || 0,
        rr_ratio: parseFloat(rrRatio) || 0,
        emotions: sanitizeInput(emotions) || '',
        notes: sanitizeInput(notes) || '',
        screenshot_url: screenshotUrl,
        rule_broken: false,
      };

      // Only include tags if non-empty and valid
      if (tags.trim()) {
        const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        if (tagArray.length > 0) {
          tradeData.tags = tagArray;
        }
      }

      console.log('Submitting trade to Supabase:', tradeData);
      const { error: supabaseError } = await supabase.from('trades').insert([tradeData]);

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      console.log('Trade inserted successfully');
      setTp('');
      setSl('');
      setRrRatio('');
      setEmotions('');
      setNotes('');
      setTags('');
      setScreenshot(null);
      onTradeAdded();
    } catch (err) {
      console.error('Supabase insert error:', err);
      setError(`Failed to save trade: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="futuristic-card p-10 mb-10"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-8" aria-label="Log a Trade">
        Log a Trade
      </h3>
      {error && (
        <motion.p
          className="text-red-500 dark:text-red-400 mb-8"
          role="alert"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {error}
        </motion.p>
      )}
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
        onChange={(e) => setSl(e.target.value)}
        placeholder="Risk-Reward Ratio"
        className="futuristic-input mb-6"
        step="0.01"
        aria-label="Risk-Reward Ratio input"
        disabled={loading}
      />
      <input
        type="text"
        value={emotions}
        onChange={(e) => setEmotions(e.target.value)}
        placeholder="Emotions (e.g., Confident, Nervous)"
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
        className="futuristic-input mb-6 min-h-[150px]"
        aria-label="Trade notes"
        disabled={loading}
      />
      <input
        type="file"
        onChange={(e) => setScreenshot(e.target.files[0])}
        accept="image/png,image/jpeg"
        className="futuristic-input mb-6 file:futuristic-button file:from-gray-400 file:to-gray-500 file:text-white file:dark:from-gray-700 file:dark:to-gray-600"
        aria-label="Screenshot upload"
        disabled={loading}
      />
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