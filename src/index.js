import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://qdpbucpzewocsiwkmyhm.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkcGJ1Y3B6ZXdvY3Npd2tteWhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzQyOTEsImV4cCI6MjA2MjY1MDI5MX0.PL1ZNMo0SIh7yG4SDNtl-rzoAG4tVT9xPIZnItZr-UI';
const supabase = createClient(supabaseUrl, supabaseKey);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App supabase={supabase} />
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();