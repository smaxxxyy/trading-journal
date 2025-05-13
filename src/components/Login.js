import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
    <div className="container py-12">
      <div className="glass-card p-6 max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center" aria-label="Login or Sign Up">
          Trading Journal
        </h2>
        {error && <p className="text-red-500 mb-4 text-center" role="alert">{error}</p>}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="modern-input mb-4"
          aria-label="Email input"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="modern-input mb-6"
          aria-label="Password input"
        />
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleLogin}
            className="modern-button bg-blue-600 text-white hover:bg-blue-700"
            aria-label="Login button"
          >
            Login
          </button>
          <button
            onClick={handleSignUp}
            className="modern-button bg-purple-600 text-white hover:bg-purple-700"
            aria-label="Sign Up button"
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;