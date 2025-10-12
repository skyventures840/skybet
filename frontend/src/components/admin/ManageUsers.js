import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';

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
      setUsers(response.data);
    } catch (err) {
      setError('Failed to fetch users.');
      console.error(err);
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
      <h2 className="text-3xl font-bold mb-6 text-white">Manage Users</h2>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
          <thead className="bg-gray-600">
            <tr>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Username</th>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Email</th>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Admin</th>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Balance</th>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-200">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {users.map((user) => (
              <tr key={user._id} className="border-t border-gray-600">
                <td className="py-3 px-4">{user.username}</td>
                <td className="py-3 px-4">{user.email}</td>
                <td className="py-3 px-4">{user.isAdmin ? 'Yes' : 'No'}</td>
                <td className="py-3 px-4">{user.balance.toFixed(2)}</td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => openEditModal(user)}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-1 px-3 rounded text-sm mr-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user._id)}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm mr-2"
                  >
                    Delete
                  </button>
                  {user.isBlocked ? (
                    <button
                      onClick={() => handleUnblockUser(user._id)}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm"
                    >
                      Unblock
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBlockUser(user._id)}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm"
                    >
                      Block
                    </button>
                  )}
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