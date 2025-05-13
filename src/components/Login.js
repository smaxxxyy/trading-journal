import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

function Login({ supabase }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      alert('Check your email for confirmation');
    }
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="container py-20">
      <motion.div
        className="futuristic-card p-10 max-w-lg mx-auto"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-8 text-center" aria-label="Login or Sign Up">
          Trading Journal
        </h2>
        {error && <p className="text-red-500 dark:text-red-400 mb-6 text-center" role="alert">{error}</p>}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="futuristic-input mb-6"
          aria-label="Email input"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="futuristic-input mb-8"
          aria-label="Password input"
        />
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <motion.button
            onClick={handleLogin}
            className="futuristic-button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Login button"
          >
            Login
          </motion.button>
          <motion.button
            onClick={handleSignUp}
            className="futuristic-button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Sign Up button"
          >
            Sign Up
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

export default Login;