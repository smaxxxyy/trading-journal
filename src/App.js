import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { motion } from 'framer-motion'; // Add this import

function App({ supabase }) {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          navigate('/');
        } else {
          navigate('/login');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        navigate('/');
      } else if (event === 'SIGNED_OUT') {
        navigate('/login');
      }
    });

    return () => {
      authListener.subscription?.unsubscribe();
    };
  }, [supabase, navigate]);

  if (loading) {
    return (
      <div className="container py-20 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Loading...</h2>
        </motion.div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login supabase={supabase} />} />
      <Route path="/" element={<Dashboard supabase={supabase} />} />
      <Route path="*" element={<Login supabase={supabase} />} />
    </Routes>
  );
}

export default App;