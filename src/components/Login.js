import { useState } from 'react';

function Login({ supabase }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const sanitizeInput = (input) => input.replace(/[<>"'&]/g, '');

  const handleLogin = async (e) => {
    e.preventDefault();
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedPassword = sanitizeInput(password);
    const { error } = await supabase.auth.signInWithPassword({ email: sanitizedEmail, password: sanitizedPassword });
    if (error) setError(error.message);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedPassword = sanitizeInput(password);
    const { error } = await supabase.auth.signUp({ email: sanitizedEmail, password: sanitizedPassword });
    if (error) setError(error.message);
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl mb-4 text-center" aria-label="Trading Journal Login">Trading Journal</h2>
        {error && <p className="text-red-500 mb-4" role="alert">{error}</p>}
        <form onSubmit={handleLogin}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full p-2 mb-4 border rounded"
            required
            aria-label="Email input"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full p-2 mb-4 border rounded"
            required
            aria-label="Password input"
          />
          <div className="flex justify-between">
            <button type="submit" className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600" aria-label="Login button">
              Login
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              className="bg-green-500 text-white p-2 rounded hover:bg-green-600"
              aria-label="Sign Up button"
            >
              Sign Up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;