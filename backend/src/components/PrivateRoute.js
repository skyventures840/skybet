import React from 'react';
import { Navigate } from 'react-router-dom';

const PrivateRoute = ({ children, auth }) => {
  console.log('PrivateRoute auth object:', auth);
  // If the route requires admin and the user is not an admin, redirect to home
  if (auth.isAdminRoute && !auth.isAdmin) {
    return <Navigate to="/" />;
  }

  // If the route is a betting route and the user is an admin, redirect to home
  if (auth.isBettingRoute && auth.isAdmin) {
    return <Navigate to="/" />;
  }

  // If the user is not logged in, redirect to login
  return auth.isLoggedIn ? children : <Navigate to="/login" />;
};

export default PrivateRoute;