import { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { motion } from 'framer-motion';

function TradeAnalytics({ trades, streakData, supabase, userId }) {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [records, setRecords] = useState({ best_unbroken_trades: 0, best_unbroken_days: 0 });

  useEffect(() => {
    const fetchRecords = async () => {
      if (userId) {
        const { data, error } = await supabase
          .from('user_records')
          .select('best_unbroken_trades, best_unbroken_days')
          .eq('user_id', userId)
          .single();
        if (error) console.error('Error fetching records:', error);
        else if (data) setRecords(data);
      }
    };
    fetchRecords();
  }, [supabase, userId]);

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
            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-button-from').trim(),
            borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim(),
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: { 
              display: true, 
              text: 'Risk-Reward Ratio', 
              color: getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() 
            },
            ticks: { 
              color: getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() 
            },
            grid: { 
              color: getComputedStyle(document.documentElement).getPropertyValue('--color-glass-border').trim() 
            },
          },
          x: { 
            ticks: { 
              color: getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() 
            }, 
            grid: { 
              color: getComputedStyle(document.documentElement).getPropertyValue('--color-glass-border').trim() 
            } 
          },
        },
        plugins: { 
          legend: { 
            labels: { 
              color: getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim() 
            } 
          } 
        },
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
    else return acc;
    return acc + (exitPrice - entry) * size;
  }, 0);

  const winRate = trades.length > 0 ? ((outcomes.wins / trades.length) * 100).toFixed(2) : 0;

  return (
    <motion.div
      className="futuristic-card holographic-border p-6 mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="text-xl font-bold mb-4 text-[var(--color-text-primary)]" aria-label="Trade Analytics">
        Trade Analytics
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">Total Trades</p>
          <p className="text-base text-[var(--color-text-secondary)]">{trades.length}</p>
        </div>
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">Win Rate</p>
          <p className="text-base text-[var(--color-text-secondary)]">{winRate}%</p>
        </div>
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">Profit/Loss</p>
          <p className="text-base text-[var(--color-text-secondary)]">{profitLoss.toFixed(2)}</p>
        </div>
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">Current Unbroken Trades</p>
          <p className="text-base text-[var(--color-text-secondary)]">{streakData?.currentTrades || 0}</p>
        </div>
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">Current Unbroken Days</p>
          <p className="text-base text-[var(--color-text-secondary)]">{streakData?.currentDays || 0}</p>
        </div>
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">Best Unbroken Trades</p>
          <p className="text-base text-[var(--color-text-secondary)]">{records.best_unbroken_trades}</p>
        </div>
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">Best Unbroken Days</p>
          <p className="text-base text-[var(--color-text-secondary)]">{records.best_unbroken_days}</p>
        </div>
      </div>
      <div className="relative h-64">
        <canvas ref={chartRef} aria-label="RR Ratio Chart"></canvas>
      </div>
    </motion.div>
  );
}

export default TradeAnalytics;