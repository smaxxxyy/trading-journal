import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const supabase = createClient(
  'https://qdpbucpzewocsiwkmyhm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkcGJ1Y3B6ZXdvY3Npd2tteWhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzQyOTEsImV4cCI6MjA2MjY1MDI5MX0.PL1ZNMo0SIh7yG4SDNtl-rzoAG4tVT9xPIZnItZr-UI'
);

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Routes>
          <Route path="/login" element={session ? <Navigate to="/" /> : <Login supabase={supabase} />} />
          <Route path="/" element={session ? <Dashboard supabase={supabase} session={session} /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;