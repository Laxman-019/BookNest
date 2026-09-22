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
    <div className="min-h-screen bg-[#14181F] flex items-center justify-center px-6 py-16 relative overflow-hidden">
      {/* Lamp glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-[8%] -translate-x-1/2 w-[600px] h-[600px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(201,162,39,0.16) 0%, rgba(201,162,39,0.05) 45%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-sm flex flex-col items-center">
        {/* Open book illustration */}
        <svg
          width="120"
          height="72"
          viewBox="0 0 200 120"
          fill="none"
          className="mb-8"
          aria-hidden="true"
        >
          <path
            d="M100 20 C80 8, 40 6, 12 14 L12 96 C40 88, 80 90, 100 102 Z"
            fill="#2A3441"
            stroke="#C9A227"
            strokeWidth="1.5"
          />
          <path
            d="M100 20 C120 8, 160 6, 188 14 L188 96 C160 88, 120 90, 100 102 Z"
            fill="#2A3441"
            stroke="#C9A227"
            strokeWidth="1.5"
          />
          <line x1="100" y1="22" x2="100" y2="100" stroke="#C9A227" strokeWidth="1" opacity="0.5" />
          {[30, 40, 50].map((y) => (
            <line key={`l${y}`} x1="24" y1={y} x2="88" y2={y - 4} stroke="#8B9AAE" strokeWidth="1" opacity="0.5" />
          ))}
          {[30, 40, 50].map((y) => (
            <line key={`r${y}`} x1="112" y1={y - 4} x2="176" y2={y} stroke="#8B9AAE" strokeWidth="1" opacity="0.5" />
          ))}
        </svg>

        <h1
          className="text-3xl text-[#F4EFE6] mb-1 tracking-tight"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          BookNest
        </h1>
        <p className="text-[#8B9AAE] text-sm mb-10">
          Pick up your reading where you left off.
        </p>

        <form className="w-full space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="border-l-2 border-[#C9A227] bg-[#C9A227]/10 text-[#F4EFE6] px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-[#8B9AAE] mb-2">
              Email address
            </label>
            <input
              type="email"
              required
              className="w-full bg-transparent border-0 border-b border-[#2A3441] text-[#F4EFE6] placeholder-[#8B9AAE]/50 px-0 py-2 focus:outline-none focus:border-[#C9A227] transition-colors"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-[#8B9AAE] mb-2">
              Password
            </label>
            <input
              type="password"
              required
              className="w-full bg-transparent border-0 border-b border-[#2A3441] text-[#F4EFE6] placeholder-[#8B9AAE]/50 px-0 py-2 focus:outline-none focus:border-[#C9A227] transition-colors"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-[#C9A227] text-[#14181F] font-medium hover:bg-[#DDBA45] focus:outline-none focus:ring-2 focus:ring-[#C9A227] focus:ring-offset-2 focus:ring-offset-[#14181F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="text-center text-sm pt-1">
            <span className="text-[#8B9AAE]">Don't have an account? </span>
            <Link to="/signup" className="text-[#C9A227] hover:text-[#DDBA45] font-medium">
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;