import { useState } from 'react';
import axios from 'axios';

function TradeForm({ supabase, userId, onTradeAdded }) {
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  const [rrRatio, setRrRatio] = useState('');
  const [emotions, setEmotions] = useState('');
  const [notes, setNotes] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [error, setError] = useState(null);

  const sanitizeInput = (input) => input.replace(/[<>"'&]/g, '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isNaN(tp) || isNaN(sl) || isNaN(rrRatio)) {
      setError('TP, SL, and RR Ratio must be numbers');
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
        return;
      }
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
      return;
    }

    setTp('');
    setSl('');
    setRrRatio('');
    setEmotions('');
    setNotes('');
    setScreenshot(null);
    onTradeAdded();
  };

  return (
    <div className="glass-card p-6 mb-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4" aria-label="Log a Trade">
        Log a Trade
      </h3>
      {error && <p className="text-red-500 mb-4" role="alert">{error}</p>}
      <input
        type="number"
        value={tp}
        onChange={(e) => setTp(e.target.value)}
        placeholder="Take Profit (TP)"
        className="modern-input mb-4"
        step="0.01"
        aria-label="Take Profit input"
      />
      <input
        type="number"
        value={sl}
        onChange={(e) => setSl(e.target.value)}
        placeholder="Stop Loss (SL)"
        className="modern-input mb-4"
        step="0.01"
        aria-label="Stop Loss input"
      />
      <input
        type="number"
        value={rrRatio}
        onChange={(e) => setRrRatio(e.target.value)}
        placeholder="Risk-Reward Ratio"
        className="modern-input mb-4"
        step="0.01"
        aria-label="Risk-Reward Ratio input"
      />
      <input
        type="text"
        value={emotions}
        onChange={(e) => setEmotions(e.target.value)}
        placeholder="Emotions (e.g., Confident, Nervous)"
        className="modern-input mb-4"
        aria-label="Emotions input"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes about the trade"
        className="modern-input mb-4 min-h-[100px]"
        aria-label="Trade notes"
      />
      <input
        type="file"
        onChange={(e) => setScreenshot(e.target.files[0])}
        accept="image/png,image/jpeg"
        className="modern-input mb-4 file:modern-button file:bg-gray-200 file:text-gray-700 file:hover:bg-gray-300"
        aria-label="Screenshot upload"
      />
      <button
        type="submit"
        onClick={handleSubmit}
        className="modern-button bg-blue-600 text-white hover:bg-blue-700 w-full"
        aria-label="Add Trade button"
      >
        Add Trade
      </button>
    </div>
  );
}

export default TradeForm;