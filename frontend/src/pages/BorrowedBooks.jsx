import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import api from '../services/api';

const STATUS_LABEL = {
  WANT_TO_READ: 'Want to Read',
  READING: 'Reading',
  FINISHED: 'Finished',
};

const BorrowedBooks = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  useEffect(() => { fetchBorrowed(); }, [fetchBorrowed]);

  // Live: book appears when lent to us
  useEffect(() => {
    const onLent = (e) => {
      setBooks(prev => prev.some(b => b.id === e.detail.book.id)
        ? prev
        : [e.detail.book, ...prev]);
    };
    // Live: book disappears when owner marks returned
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
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Borrowed from Others</h1>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
            ● Live
          </span>
        </div>

        {error && <ErrorMessage message={error} />}

        {books.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500 text-lg font-medium">No borrowed books</p>
            <p className="text-gray-400 text-sm mt-1">
              Books lent to you by other users will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {books.map(book => (
              <div key={book.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">

                <div className="flex justify-between items-start gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 text-base leading-snug">
                    {book.title}
                  </h3>
                  <span className="shrink-0 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    Read-only
                  </span>
                </div>

                <p className="text-sm text-gray-500 mb-3">by {book.author}</p>

                <p className="text-xs text-purple-600 font-medium mb-2">
                  📤 Lent by: {book.user_details?.name ?? 'Unknown'}
                  {book.user_details?.email ? ` (${book.user_details.email})` : ''}
                </p>

                <span className="inline-block text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                  Borrowed
                </span>

                {book.total_pages > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Pages</span>
                      <span>{book.current_page}/{book.total_pages}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full">
                      <div
                        className="h-full bg-purple-400 rounded-full"
                        style={{ width: `${book.progress_percentage}%` }}
                      />
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-3 italic">
                  You have read-only access. The owner retains full control of this book.
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BorrowedBooks;
