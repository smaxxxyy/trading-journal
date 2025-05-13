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
    <div className="container py-10">
      <motion.div
        className="futuristic-card holographic-border p-6 max-w-sm mx-auto"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2
          className="text-xl font-bold text-[var(--color-neon-purple)] mb-4 text-center"
          aria-label="Login or Sign Up"
        >
          Trading Journal
        </h2>
        {error && (
          <motion.p
            className="text-red-400 mb-4 text-sm text-center"
            role="alert"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {error}
          </motion.p>
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="futuristic-input mb-4"
          aria-label="Email input"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="futuristic-input mb-4"
          aria-label="Password input"
        />
        <div className="flex flex-col gap-3">
          <motion.button
            onClick={handleLogin}
            className="futuristic-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Login button"
          >
            Login
          </motion.button>
          <motion.button
            onClick={handleSignUp}
            className="futuristic-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
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