import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

function Login({ supabase }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // For button loading state
  const [successMessage, setSuccessMessage] = useState(null);
  const navigate = useNavigate();

  const handleSignUp = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setIsSubmitting(false);
    } else {
      setSuccessMessage('Check your email for confirmation');
      setIsSubmitting(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setIsSubmitting(false);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="container py-16">
      <motion.div
        className="glass-card p-8 max-w-lg mx-auto"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center" aria-label="Login or Sign Up">
          Trading Journal
        </h2>

        {/* Success Message */}
        {successMessage && <p className="text-green-500 mb-6 text-center">{successMessage}</p>}

        {/* Error Message */}
        {error && <p className="text-red-500 mb-6 text-center" role="alert">{error}</p>}

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="neo-input mb-6"
          aria-label="Email input"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="neo-input mb-8"
          aria-label="Password input"
        />
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <motion.button
            onClick={handleLogin}
            className="neo-button bg-blue-600 dark:bg-purple-600 w-full sm:w-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isSubmitting}
            aria-label="Login button"
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </motion.button>
          <motion.button
            onClick={handleSignUp}
            className="neo-button bg-purple-600 dark:bg-blue-600 w-full sm:w-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isSubmitting}
            aria-label="Sign Up button"
          >
            {isSubmitting ? 'Signing up...' : 'Sign Up'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

export default Login;
