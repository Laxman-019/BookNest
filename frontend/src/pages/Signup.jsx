import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Login failed. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#2F3B32] flex items-center justify-center px-6 py-16">
      <div className="relative w-full max-w-[380px]">
        {/* Metal rod threading behind the card */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-[34px] h-[3px] w-[calc(100%+56px)] rounded-full z-0"
          style={{
            background:
              'linear-gradient(90deg, #8A8A82 0%, #D8D8CE 15%, #8A8A82 50%, #D8D8CE 85%, #8A8A82 100%)',
          }}
        />

        {/* Card */}
        <div className="relative z-10 bg-[#F1ECDF] border border-[#C9BFA8] px-9 pt-12 pb-9 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          {/* Punch hole */}
          <div className="absolute left-1/2 -translate-x-1/2 top-5 w-3.5 h-3.5 rounded-full bg-[#2F3B32] border border-[#8A8A82]" />

          {/* Call number tag */}
          <div
            className="text-[11px] text-[#8B4A3C] mb-6"
            style={{ fontFamily: '"Courier New", Courier, monospace' }}
          >
            823.9 — B725
          </div>

          <h1
            className="text-[26px] text-[#262019] leading-none mb-1"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            BookNest
          </h1>
          <p className="text-[#6B6455] text-sm mb-8">
            Member sign-in
          </p>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="border-l-2 border-[#8B4A3C] bg-[#8B4A3C]/10 text-[#8B4A3C] px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <div>
              <input
                type="email"
                required
                className="w-full bg-transparent border-0 border-b border-[#C9BFA8] text-[#262019] placeholder-transparent px-0 pb-1.5 focus:outline-none focus:border-[#262019] transition-colors"
                style={{ fontFamily: '"Courier New", Courier, monospace' }}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label
                className="block text-[11px] text-[#8B8171] mt-1.5"
                style={{ fontFamily: '"Courier New", Courier, monospace' }}
              >
                email address
              </label>
            </div>

            <div>
              <input
                type="password"
                required
                className="w-full bg-transparent border-0 border-b border-[#C9BFA8] text-[#262019] placeholder-transparent px-0 pb-1.5 focus:outline-none focus:border-[#262019] transition-colors"
                style={{ fontFamily: '"Courier New", Courier, monospace' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <label
                className="block text-[11px] text-[#8B8171] mt-1.5"
                style={{ fontFamily: '"Courier New", Courier, monospace' }}
              >
                password
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#262019] text-[#F1ECDF] font-medium hover:bg-[#3A3226] focus:outline-none focus:ring-2 focus:ring-[#8B4A3C] focus:ring-offset-2 focus:ring-offset-[#F1ECDF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <div className="text-center text-sm pt-1">
              <span className="text-[#6B6455]">Don't have an account? </span>
              <Link to="/signup" className="text-[#8B4A3C] hover:text-[#6E3A2E] font-medium">
                Sign up
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;