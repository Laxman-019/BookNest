import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import api from '../services/api';

const BorrowedBooks = () => {
  const [books, setBooks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchBorrowed = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/borrowed/');
      setBooks(res.data);
      setError('');
    } catch {
      setError('Failed to load borrowed books');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBorrowed();
  }, [fetchBorrowed]);

  // Live: a book appears when the owner lends it to us
  useEffect(() => {
    const onLent = (e) => {
      setBooks(prev => {
        const exists = prev.some(b => b.id === e.detail.book.id);
        return exists ? prev : [e.detail.book, ...prev];
      });
    };
    // Live: a book disappears when the owner marks it returned
    const onReturned = (e) => {
      setBooks(prev => prev.filter(b => b.id !== e.detail.book_id));
    };

    window.addEventListener('ws:book_lent', onLent);
    window.addEventListener('ws:book_returned', onReturned);
    return () => {
      window.removeEventListener('ws:book_lent', onLent);
      window.removeEventListener('ws:book_returned', onReturned);
    };
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Borrowed from Others
          <span className="ml-3 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-normal">
            Live
          </span>
        </h1>

        {error && <ErrorMessage message={error} />}

        {books.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <p className="text-gray-400 text-lg">No books borrowed from others</p>
            <p className="text-gray-400 text-sm mt-1">Books lent to you will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map(book => (
              <div
                key={book.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
              >
                <h3 className="font-semibold text-gray-900 text-lg">{book.title}</h3>
                <p className="text-sm text-gray-600 mt-1">by {book.author}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Lent by {book.user_details?.name ?? 'Unknown'}
                </p>
                <span className="inline-block mt-3 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  Borrowed (read-only)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BorrowedBooks;