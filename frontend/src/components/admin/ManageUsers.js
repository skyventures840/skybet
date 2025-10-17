import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';

// Dropdown Action Component
const ActionDropdown = ({ user, onEdit, onDelete, onBlock, onUnblock }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = (action, actionFn) => {
    setIsOpen(false);
    actionFn();
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-flex items-center transition-colors duration-200"
      >
        Actions
        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown when clicking outside */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          ></div>
          
          {/* Dropdown menu */}
          <div className="absolute right-0 mt-2 w-48 bg-gray-700 rounded-md shadow-lg z-20 border border-gray-600">
            <div className="py-1">
              <button
                onClick={() => handleAction('edit', () => onEdit(user))}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-200 hover:bg-gray-600 hover:text-white transition-colors duration-150"
              >
                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit User
              </button>
              
              {user.isBlocked ? (
                <button
                  onClick={() => handleAction('unblock', () => onUnblock(user._id))}
                  className="flex items-center w-full px-4 py-2 text-sm text-green-400 hover:bg-gray-600 hover:text-green-300 transition-colors duration-150"
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  Unblock User
                </button>
              ) : (
                <button
                  onClick={() => handleAction('block', () => onBlock(user._id))}
                  className="flex items-center w-full px-4 py-2 text-sm text-orange-400 hover:bg-gray-600 hover:text-orange-300 transition-colors duration-150"
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Block User
                </button>
              )}
              
              <div className="border-t border-gray-600 my-1"></div>
              
              <button
                onClick={() => handleAction('delete', () => onDelete(user._id))}
                className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-gray-600 hover:text-red-300 transition-colors duration-150"
              >
                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete User
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    isAdmin: false,
    balance: 0,
    isBlocked: false,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAdminUsers();
      setUsers(response.data.users || []);
    } catch (err) {
      setError('Failed to fetch users.');
      console.error(err);
      setUsers([]); // Ensure users is always an array
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      await apiService.updateUser(currentUser._id, formData);
      fetchUsers();
      closeModal();
    } catch (err) {
      setError('Failed to update user.');
      console.error(err);
    }
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await apiService.deleteUser(id);
        fetchUsers();
      } catch (err) {
        setError('Failed to delete user.');
        console.error(err);
      }
    }
  };

  const openEditModal = (user) => {
    setCurrentUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      balance: user.balance,
      isBlocked: user.isBlocked,
    });
    setIsModalOpen(true);
  };

  const handleBlockUser = async (id) => {
    if (window.confirm('Are you sure you want to block this user?')) {
      try {
        await apiService.blockUser(id);
        fetchUsers();
      } catch (err) {
        setError('Failed to block user.');
        console.error(err);
      }
    }
  };

  const handleUnblockUser = async (id) => {
    if (window.confirm('Are you sure you want to unblock this user?')) {
      try {
        await apiService.unblockUser(id);
        fetchUsers();
      } catch (err) {
        setError('Failed to unblock user.');
        console.error(err);
      }
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentUser(null);
  };

  if (loading) return <div className="text-white">Loading users...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Manage Users</h2>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2 px-4 rounded"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden shadow-xl">
          <thead className="bg-gradient-to-r from-gray-600 to-gray-500">
            <tr>
              <th className="py-4 px-4 text-left text-sm font-semibold text-gray-100 uppercase tracking-wider">Username</th>
              <th className="py-4 px-4 text-left text-sm font-semibold text-gray-100 uppercase tracking-wider">Email</th>
              <th className="py-4 px-4 text-left text-sm font-semibold text-gray-100 uppercase tracking-wider">Role</th>
              <th className="py-4 px-4 text-left text-sm font-semibold text-gray-100 uppercase tracking-wider">Balance</th>
              <th className="py-4 px-4 text-left text-sm font-semibold text-gray-100 uppercase tracking-wider">Status</th>
              <th className="py-4 px-4 text-left text-sm font-semibold text-gray-100 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {users.map((user) => (
              <tr key={user._id} className="border-t border-gray-600 hover:bg-gray-600 transition-colors duration-200 cursor-pointer">
                <td className="py-4 px-4 font-medium">{user.username}</td>
                <td className="py-4 px-4">{user.email}</td>
                <td className="py-4 px-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.isAdmin 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.isAdmin ? 'Admin' : 'User'}
                  </span>
                </td>
                <td className="py-4 px-4 font-mono">${user.balance.toFixed(2)}</td>
                 <td className="py-4 px-4">
                   <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                     user.isBlocked 
                       ? 'bg-red-100 text-red-800' 
                       : 'bg-green-100 text-green-800'
                   }`}>
                     <span className={`w-2 h-2 rounded-full mr-1.5 ${
                       user.isBlocked ? 'bg-red-400' : 'bg-green-400'
                     }`}></span>
                     {user.isBlocked ? 'Blocked' : 'Active'}
                   </span>
                 </td>
                <td className="py-4 px-4">
                  <ActionDropdown
                    user={user}
                    onEdit={openEditModal}
                    onDelete={handleDeleteUser}
                    onBlock={handleBlockUser}
                    onUnblock={handleUnblockUser}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-2xl font-bold mb-6 text-white">Edit User</h3>
            <form onSubmit={handleUpdateUser} className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-black text-sm font-bold mb-2">Username:</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-700 border-gray-600"
                  required
                />
              </div>
              <div>
                <label className="block text-black text-sm font-bold mb-2">Email:</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-700 border-gray-600"
                  required
                />
              </div>
              <div>
                <label className="block text-black text-sm font-bold mb-2">Balance:</label>
                <input
                  type="number"
                  step="0.01"
                  name="balance"
                  value={formData.balance}
                  onChange={handleInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-700 border-gray-600"
                  required
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isAdmin"
                  checked={formData.isAdmin}
                  onChange={handleInputChange}
                  className="mr-2 leading-tight"
                />
                <label className="text-black text-sm font-bold">Is Admin</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isBlocked"
                  checked={formData.isBlocked}
                  onChange={handleInputChange}
                  className="mr-2 leading-tight"
                />
                <label className="text-black text-sm font-bold">Is Blocked</label>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded mr-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                >
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;