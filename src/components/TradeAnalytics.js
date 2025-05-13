import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { motion } from 'framer-motion';

function TradeAnalytics({ trades }) {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    if (!trades || trades.length === 0) return;

    const ctx = chartRef.current.getContext('2d');
    const rrRatios = trades.map(trade => trade.rr_ratio || 0);

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: trades.map((_, index) => `Trade ${index + 1}`),
        datasets: [
          {
            label: 'RR Ratio',
            data: rrRatios,
            backgroundColor: 'rgba(163, 85, 247, 0.6)',
            borderColor: 'rgba(163, 85, 247, 1)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Risk-Reward Ratio', color: '#fff' }, ticks: { color: '#fff' }, grid: { color: 'rgba(255, 255, 255, 0.2)' } },
          x: { ticks: { color: '#fff' }, grid: { color: 'rgba(255, 255, 255, 0.2)' } },
        },
        plugins: { legend: { labels: { color: '#fff' } } },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [trades]);

  const outcomes = trades.reduce(
    (acc, trade) => {
      if (trade.outcome === 'Win') acc.wins += 1;
      else if (trade.outcome === 'Loss') acc.losses += 1;
      else if (trade.outcome === 'Breakeven') acc.breakevens += 1;
      return acc;
    },
    { wins: 0, losses: 0, breakevens: 0 }
  );

  const profitLoss = trades.reduce((acc, trade) => {
    if (!trade.position_size || !trade.entry || !trade.outcome) return acc;
    const size = parseFloat(trade.position_size);
    const entry = parseFloat(trade.entry);
    let exitPrice;
    if (trade.outcome === 'Win') exitPrice = parseFloat(trade.tp);
    else if (trade.outcome === 'Loss') exitPrice = parseFloat(trade.sl);
    else return acc; // Breakeven = 0 profit/loss
    return acc + (exitPrice - entry) * size;
  }, 0);

  const winRate = trades.length > 0 ? ((outcomes.wins / trades.length) * 100).toFixed(2) : 0;

  return (
    <motion.div
      className="futuristic-card holographic-border p-10 mb-10"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      whileHover={{ scale: 1.02 }}
    >
      <h3 className="text-3xl font-bold text-[var(--neon-blue)] mb-8" aria-label="Trade Analytics">
        Trade Analytics
      </h3>
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <p className="text-white text-lg">
          <span className="font-semibold">Total Trades:</span> {trades.length}
        </p>
        <p className="text-white text-lg">
          <span className="font-semibold">Wins:</span> {outcomes.wins}
        </p>
        <p className="text-white text-lg">
          <span className="font-semibold">Losses:</span> {outcomes.losses}
        </p>
        <p className="text-white text-lg">
          <span className="font-semibold">Breakevens:</span> {outcomes.breakevens}
        </p>
        <p className="text-white text-lg">
          <span className="font-semibold">Win Rate:</span> {winRate}%
        </p>
        <p className="text-white text-lg">
          <span className="font-semibold">Profit/Loss:</span> {profitLoss.toFixed(2)}
        </p>
      </div>
      <div className="relative h-96">
        <canvas ref={chartRef} aria-label="RR Ratio Chart"></canvas>
      </div>
    </motion.div>
  );
}

export default TradeAnalytics;