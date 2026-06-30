import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import api from '../services/api';

const ROLE_COLORS = {
  OWNER: 'bg-purple-100 text-purple-800',
  EDITOR: 'bg-blue-100 text-blue-800',
  VIEWER: 'bg-gray-100 text-gray-800',
};

const ShelfDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [shelf, setShelf] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add-book panel
  const [showAddBook, setShowAddBook] = useState(false);
  const [selectedBook, setSelectedBook] = useState('');
  const [userBooks, setUserBooks] = useState([]);
  const [addingBook, setAddingBook] = useState(false);

  // Share panel
  const [showShare, setShowShare] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState('VIEWER');
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState('');

  // Collaborator remove
  const [removingEmail, setRemovingEmail] = useState('');

  const fetchShelf = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/shelves/${id}/`);
      setShelf(res.data);
      setBooks(res.data.books || []);
      setError('');
    } catch {
      setError('Failed to load shelf');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchShelf();
  }, [fetchShelf]);

  // Live shelf updates from collaborators
  useEffect(() => {
    const handler = (e) => {
      if (e.detail.shelf_id !== parseInt(id)) return;

      if (e.detail.shelf) {
        // Full shelf payload included (book added/removed) — use it directly
        setShelf(e.detail.shelf);
        setBooks(e.detail.shelf.books || []);
      } else {
        // No payload (e.g. book_deleted from elsewhere) — re-fetch to stay in sync
        fetchShelf();
      }
    };
    window.addEventListener('ws:shelf_updated', handler);
    return () => window.removeEventListener('ws:shelf_updated', handler);
  }, [id, fetchShelf]);

  const fetchUserBooks = async () => {
    try {
      const res = await api.get('/books/');
      setUserBooks(res.data.data || []);
    } catch {
      console.error('Failed to load books');
    }
  };

  const handleAddBook = async () => {
    if (!selectedBook) return;
    setAddingBook(true);
    try {
      await api.post(`/shelves/${id}/books/`, { book_id: selectedBook });
      setShowAddBook(false);
      setSelectedBook('');
      fetchShelf();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add book');
    } finally {
      setAddingBook(false);
    }
  };

  const handleRemoveBook = async (bookId) => {
    if (!window.confirm('Remove this book from the shelf?')) return;
    try {
      await api.delete(`/shelves/${id}/books/`, { data: { book_id: bookId } });
      fetchShelf();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove book');
    }
  };

  const handleDeleteShelf = async () => {
    if (!window.confirm('Delete this shelf? Books will not be deleted.')) return;
    try {
      await api.delete(`/shelves/${id}/`);
      navigate('/shelves');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete shelf');
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    setSharing(true);
    setShareMsg('');
    try {
      await api.post(`/shelves/${id}/share/`, { email: shareEmail, role: shareRole });
      setShareMsg(`✅ Shared with ${shareEmail} as ${shareRole}`);
      setShareEmail('');
      fetchShelf();
    } catch (err) {
      setShareMsg(`❌ ${err.response?.data?.error || 'Failed to share'}`);
    } finally {
      setSharing(false);
    }
  };

  const handleRemoveCollaborator = async (email) => {
    if (!window.confirm(`Remove ${email} from this shelf?`)) return;
    setRemovingEmail(email);
    try {
      await api.post(`/shelves/${id}/remove-collaborator/`, { email });
      fetchShelf();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove collaborator');
    } finally {
      setRemovingEmail('');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!shelf && error) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto p-6"><ErrorMessage message={error} /></div>
    </div>
  );
  if (!shelf) return null;

  const isOwner  = shelf.user_role === 'OWNER';
  const canEdit  = shelf.user_role === 'OWNER' || shelf.user_role === 'EDITOR';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
          <div>
            <Link to="/shelves" className="text-blue-600 hover:underline text-sm">
              ← Back to Shelves
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mt-1 flex items-center gap-3">
              {shelf.name}
              <span className={`text-sm px-2 py-1 rounded-full ${ROLE_COLORS[shelf.user_role]}`}>
                {shelf.user_role}
              </span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-normal">
                Live
              </span>
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              {shelf.book_count} books · Created by {shelf.owner_details?.name}
            </p>
          </div>

          {isOwner && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowShare(!showShare)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
              >
                {showShare ? 'Cancel' : '🤝 Share'}
              </button>
              <Link
                to={`/shelves/${id}/edit`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
              >
                Edit
              </Link>
              <button
                onClick={handleDeleteShelf}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {error && <ErrorMessage message={error} />}

        {showShare && isOwner && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Share Shelf</h2>
            <form onSubmit={handleShare} className="flex gap-2 flex-wrap items-end">
              <div>
                <label className="block text-xs text-gray-600 mb-1">User email</label>
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 w-64"
                  value={shareEmail}
                  onChange={e => setShareEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Role</label>
                <select
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  value={shareRole}
                  onChange={e => setShareRole(e.target.value)}
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="EDITOR">Editor</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={sharing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm disabled:opacity-50"
              >
                {sharing ? 'Sharing…' : 'Share'}
              </button>
            </form>
            {shareMsg && (
              <p className="mt-2 text-sm text-gray-700">{shareMsg}</p>
            )}

            {shelf.shares?.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Current collaborators</h3>
                <ul className="space-y-2">
                  {shelf.shares.map(s => (
                    <li key={s.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span>
                        {s.user_details?.email ?? s.user_details?.name}
                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${ROLE_COLORS[s.role]}`}>{s.role}</span>
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setShareEmail(s.user_details?.email ?? '');
                            setShareRole(s.role === 'VIEWER' ? 'EDITOR' : 'VIEWER');
                          }}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Change role
                        </button>
                        <button
                          onClick={() => handleRemoveCollaborator(s.user_details?.email ?? '')}
                          disabled={removingEmail === s.user_details?.email}
                          className="text-red-600 hover:underline text-xs disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {canEdit && (
          <div className="mb-6">
            <button
              onClick={() => { setShowAddBook(!showAddBook); if (!showAddBook) fetchUserBooks(); }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
            >
              {showAddBook ? 'Cancel' : '+ Add Book'}
            </button>

            {showAddBook && (
              <div className="mt-3 flex gap-2">
                <select
                  value={selectedBook}
                  onChange={e => setSelectedBook(e.target.value)}
                  className="flex-1 max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a book…</option>
                  {userBooks.map(b => (
                    <option key={b.id} value={b.id}>{b.title} — {b.author}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddBook}
                  disabled={!selectedBook || addingBook}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50"
                >
                  {addingBook ? 'Adding…' : 'Add'}
                </button>
              </div>
            )}
          </div>
        )}

        {books.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <p className="text-gray-400 text-lg">No books in this shelf yet</p>
            {canEdit && (
              <button
                onClick={() => { setShowAddBook(true); fetchUserBooks(); }}
                className="text-blue-600 hover:underline mt-2 text-sm"
              >
                Add your first book
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map(book => (
              <div key={book.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition">
                <h3 className="font-semibold text-gray-900">{book.title}</h3>
                <p className="text-sm text-gray-600">by {book.author}</p>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">{book.status?.replace('_', ' ')}</span>
                  {canEdit && (
                    <button
                      onClick={() => handleRemoveBook(book.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShelfDetail;
