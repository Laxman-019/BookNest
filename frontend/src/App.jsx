import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Books from './pages/Books';
import BookForm from './pages/BookForm';
import Shelves from './pages/Shelves';
import ShelfForm from './pages/ShelfForm';
import SharedShelves from './pages/SharedShelves';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/books" element={<PrivateRoute><Books /></PrivateRoute>} />
          <Route path="/books/new" element={<PrivateRoute><BookForm /></PrivateRoute>} />
          <Route path="/books/:id/edit" element={<PrivateRoute><BookForm /></PrivateRoute>} />
          <Route path="/shelves" element={<PrivateRoute><Shelves /></PrivateRoute>} />
          <Route path="/shelves/new" element={<PrivateRoute><ShelfForm /></PrivateRoute>} />
          <Route path="/shelves/:id/edit" element={<PrivateRoute><ShelfForm /></PrivateRoute>} />
          <Route path="/shared-with-me" element={<PrivateRoute><SharedShelves /></PrivateRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;