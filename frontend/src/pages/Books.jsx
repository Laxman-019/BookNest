import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import api from '../services/api';

const STATUS_COLOR = {
  WANT_TO_READ: 'bg-yellow-100 text-yellow-800',
  READING: 'bg-blue-100 text-blue-800',
  FINISHED: 'bg-green-100 text-green-800',
};
const STATUS_LABEL = {
  WANT_TO_READ: 'Want to Read',
  READING: 'Reading',
  FINISHED: 'Finished',
};

// Inline progress updater 
const ProgressPanel = ({ book, onUpdated, onClose }) => {
  const [page, setPage] = useState(book.current_page ?? 0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      const res = await api.post(`/books/${book.id}/progress/`, { current_page: page });
      onUpdated(res.data);
      onClose();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to update progress');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
      <p className="text-xs text-blue-700 font-medium mb-2">Update progress</p>
      {err && <p className="text-xs text-red-600 mb-1">{err}</p>}
      <div className="flex items-center gap-2">
        <input
          type="number" min={0} max={book.total_pages ?? undefined}
          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
          value={page}
          onChange={e => setPage(e.target.value)}
        />
        <span className="text-xs text-gray-500">/ {book.total_pages ?? '?'} pages</span>
        <button
          onClick={save} disabled={saving}
          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
    </div>
  );
};

// Inline lend panel 
const LendPanel = ({ book, onUpdated, onClose }) => {
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const lend = async () => {
    if (!email.trim()) { setErr('Enter borrower email'); return; }
    setSaving(true);
    setErr('');
    try {
      const res = await api.post('/lend/', { book_id: book.id, borrower_email: email });
      onUpdated(res.data);
      onClose();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to lend book');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
      <p className="text-xs text-purple-700 font-medium mb-2">Lend to another user</p>
      {err && <p className="text-xs text-red-600 mb-1">{err}</p>}
      <div className="flex items-center gap-2">
        <input
          type="email"
          placeholder="borrower@example.com"
          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button
          onClick={lend} disabled={saving}
          className="px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50"
        >
          {saving ? 'Lending…' : 'Lend'}
        </button>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
    </div>
  );
};

// Return button 
const ReturnButton = ({ book, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const ret = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/return/${book.id}/`);
      onUpdated(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={ret} disabled={loading}
      className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50"
    >
      {loading ? '…' : 'Return'}
    </button>
  );
};

// Main Books page 
const Books = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    search: '', status: '', sort_by: '-created_at', page: 1, page_size: 12,
  });
  const [pagination, setPagination] = useState({});
  const [openProgress, setOpenProgress] = useState(null); // book id
  const [openLend, setOpenLend] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/books/', { params: filters });
      setBooks(res.data.data);
      setPagination(res.data.pagination);
      setError('');
    } catch {
      setError('Failed to load books');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  const updateBook = (updated) => {
    setBooks(prev => prev.map(b => b.id === updated.id ? updated : b));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this book? It will be removed from all shelves.')) return;
    setDeleting(id);
    try {
      await api.delete(`/books/${id}/`);
      setBooks(prev => prev.filter(b => b.id !== id));
    } catch {
      setError('Failed to delete book');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Books</h1>
          <Link to="/books/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            + Add Book
          </Link>
        </div>

        {error && <ErrorMessage message={error} />}

        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Search title or author…"
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              value={filters.search}
              onChange={e => setFilters(f => ({...f, search: e.target.value, page: 1}))}
            />
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              value={filters.status}
              onChange={e => setFilters(f => ({...f, status: e.target.value, page: 1}))}
            >
              <option value="">All Statuses</option>
              <option value="WANT_TO_READ">Want to Read</option>
              <option value="READING">Reading</option>
              <option value="FINISHED">Finished</option>
            </select>
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              value={filters.sort_by}
              onChange={e => setFilters(f => ({...f, sort_by: e.target.value}))}
            >
              <option value="-created_at">Newest First</option>
              <option value="created_at">Oldest First</option>
              <option value="title">Title A–Z</option>
              <option value="-title">Title Z–A</option>
              <option value="-rating">Highest Rating</option>
              <option value="rating">Lowest Rating</option>
            </select>
          </div>
        </div>

        {books.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <p className="text-gray-400 text-lg">No books found</p>
            <Link to="/books/new" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
              Add your first book
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {books.map(book => (
                <div key={book.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition p-5">

                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2">
                      {book.title}
                    </h3>
                    {book.is_lent && (
                      <span className="shrink-0 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        Lent
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-500 mb-2">by {book.author}</p>

                  <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${STATUS_COLOR[book.status]}`}>
                    {STATUS_LABEL[book.status]}
                  </span>

                  {book.total_pages > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{book.current_page}/{book.total_pages} ({book.progress_percentage}%)</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${book.progress_percentage}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {book.rating && (
                    <p className="mt-2 text-sm">{'⭐'.repeat(book.rating)}</p>
                  )}

                  {book.is_lent && book.lent_to_details && (
                    <p className="mt-2 text-xs text-purple-600">
                      Lent to: {book.lent_to_details.name} ({book.lent_to_details.email})
                    </p>
                  )}

                  {openProgress === book.id && (
                    <ProgressPanel
                      book={book}
                      onUpdated={updateBook}
                      onClose={() => setOpenProgress(null)}
                    />
                  )}
                  {openLend === book.id && (
                    <LendPanel
                      book={book}
                      onUpdated={updateBook}
                      onClose={() => setOpenLend(null)}
                    />
                  )}

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Link
                      to={`/books/${book.id}/edit`}
                      className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                    >
                      Edit
                    </Link>

                    {book.total_pages && book.status !== 'FINISHED' && (
                      <button
                        onClick={() => setOpenProgress(p => p === book.id ? null : book.id)}
                        className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
                      >
                        Progress
                      </button>
                    )}

                    {!book.is_lent && (
                      <button
                        onClick={() => setOpenLend(l => l === book.id ? null : book.id)}
                        className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
                      >
                        Lend
                      </button>
                    )}

                    {book.is_lent && (
                      <ReturnButton book={book} onUpdated={updateBook} />
                    )}

                    <button
                      onClick={() => handleDelete(book.id)}
                      disabled={deleting === book.id}
                      className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition disabled:opacity-50"
                    >
                      {deleting === book.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {pagination.total_pages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                <button
                  className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40"
                  onClick={() => setFilters(f => ({...f, page: f.page - 1}))}
                  disabled={filters.page === 1}
                >
                  ← Previous
                </button>
                {[...Array(pagination.total_pages)].map((_, i) => (
                  <button
                    key={i}
                    className={`px-3 py-1.5 border rounded-lg text-sm ${
                      filters.page === i + 1 ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setFilters(f => ({...f, page: i + 1}))}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40"
                  onClick={() => setFilters(f => ({...f, page: f.page + 1}))}
                  disabled={filters.page === pagination.total_pages}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Books;
