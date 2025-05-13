import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { motion } from 'framer-motion';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function TradeAnalytics({ trades }) {
  const data = {
    labels: trades.map((_, i) => `Trade ${i + 1}`),
    datasets: [
      {
        label: 'RR Ratio',
        data: trades.map((trade) => trade.rr_ratio),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Trade RR Ratios' },
    },
  };

  return (
    <motion.div
      className="futuristic-card p-10 mb-10"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Trade Analytics</h3>
      <Bar data={data} options={options} />
    </motion.div>
  );
}

export default TradeAnalytics;