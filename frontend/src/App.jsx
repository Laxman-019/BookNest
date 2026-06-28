import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import useWebSocket from './hooks/useWebSocket';

import Login        from './pages/Login';
import Signup       from './pages/Signup';
import Books        from './pages/Books';
import BookForm     from './pages/BookForm';
import Shelves      from './pages/Shelves';
import ShelfForm    from './pages/ShelfForm';
import ShelfDetail  from './pages/ShelfDetail';
import SharedShelves from './pages/SharedShelves';
import BorrowedBooks from './pages/BorrowedBooks';

// Inner component so it can use useAuth (which needs AuthProvider to be mounted)
const AppRoutes = () => {
  const { user } = useAuth();

  // Initialize WS once user is known — auto-reconnects, scoped to this user
  useWebSocket(user);

  return (
    <Routes>
      <Route path="/login"   element={<Login />} />
      <Route path="/signup"  element={<Signup />} />


      <Route path="/books"     element={<PrivateRoute><Books /></PrivateRoute>} />
      <Route path="/books/new" element={<PrivateRoute><BookForm /></PrivateRoute>} />
      <Route path="/books/:id/edit" element={<PrivateRoute><BookForm /></PrivateRoute>} />

      <Route path="/shelves"         element={<PrivateRoute><Shelves /></PrivateRoute>} />
      <Route path="/shelves/new"     element={<PrivateRoute><ShelfForm /></PrivateRoute>} />
      <Route path="/shelves/:id"     element={<PrivateRoute><ShelfDetail /></PrivateRoute>} />
      <Route path="/shelves/:id/edit" element={<PrivateRoute><ShelfForm /></PrivateRoute>} />

      <Route path="/shared-with-me" element={<PrivateRoute><SharedShelves /></PrivateRoute>} />
      <Route path="/borrowed"        element={<PrivateRoute><BorrowedBooks /></PrivateRoute>} />

    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;