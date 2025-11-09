// src/App.js
import React, { useState, useEffect, useCallback } from 'react';
import { Search, File, Folder, Plus, Upload, X, Eye, Download, Edit2, Trash2, LogOut, User } from 'lucide-react';
import { auth, items, collections, tags as tagsAPI } from './api/api';

const FileOrganizerApp = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');
  const [itemsList, setItemsList] = useState([]);
  const [collectionsList, setCollectionsList] = useState([]);
  const [tagsList, setTagsList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('all');
  const [selectedTags, setSelectedTags] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPreview, setShowPreview] = useState(null);
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);

  // Check if user is logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
      setView('dashboard');
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [itemsData, collectionsData, tagsData] = await Promise.all([
        items.getAll({ search: searchQuery, collection: selectedCollection !== 'all' ? selectedCollection : undefined }),
        collections.getAll(),
        tagsAPI.getAll()
      ]);
      
      setItemsList(itemsData.data);
      setCollectionsList(collectionsData.data.map(c => c.name));
      setTagsList(tagsData.data.map(t => t.name));
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCollection]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const handleAuth = async () => {
    try {
      setLoading(true);
      setError('');
      
      const result = view === 'login' 
        ? await auth.login(formData.email, formData.password)
        : await auth.register(formData.name, formData.email, formData.password);
      
      // Store token and user data
      localStorage.setItem('token', result.data.token);
      localStorage.setItem('user', JSON.stringify(result.data.user));
      
      setUser(result.data.user);
      setView('dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setView('login');
    setItemsList([]);
    setCollectionsList([]);
    setTagsList([]);
  };

  const handleAddItem = async (newItem) => {
    try {
      setLoading(true);
      setError('');

      if (newItem.type === 'file' && newItem.file) {
        // Handle file upload
        const formData = new FormData();
        formData.append('file', newItem.file);
        formData.append('collectionName', newItem.collection);
        formData.append('tags', JSON.stringify(newItem.tags));
        
        await items.upload(formData);
      } else {
        // Handle text/link
        await items.create({
          name: newItem.name,
          type: newItem.type,
          content: newItem.content,
          url: newItem.url,
          collectionName: newItem.collection,
          tags: newItem.tags
        });
      }

      setShowAddModal(false);
      loadData(); // Reload data
    } catch (err) {
      console.error('Error adding item:', err);
      setError(err.response?.data?.error || 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    
    try {
      setLoading(true);
      await items.delete(id);
      loadData(); // Reload data
    } catch (err) {
      console.error('Error deleting item:', err);
      setError('Failed to delete item');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id, name) => {
    try {
      const response = await items.download(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Failed to download file');
    }
  };

  const handleAddCollection = async () => {
    if (!newCollectionName.trim()) {
      setError('Collection name cannot be empty');
      return;
    }
    
    try {
      setLoading(true);
      await collections.create(newCollectionName);
      setNewCollectionName('');
      setShowAddCollection(false);
      loadData();
    } catch (err) {
      console.error('Error creating collection:', err);
      setError('Failed to create collection');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) {
      setError('Tag name cannot be empty');
      return;
    }
    
    try {
      setLoading(true);
      await tagsAPI.create(newTagName);
      setNewTagName('');
      setShowAddTag(false);
      loadData();
    } catch (err) {
      console.error('Error creating tag:', err);
      setError('Failed to create tag');
    } finally {
      setLoading(false);
    }
  };

  // Filter items based on search and filters
  const filteredItems = itemsList.filter(item => {
    const matchesSearch = searchQuery === '' || 
                          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.content && item.content.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCollection = selectedCollection === 'all' || item.collection === selectedCollection;
    const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => item.tags.includes(tag));
    return matchesSearch && matchesCollection && matchesTags;
  });

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (user) {
        loadData();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCollection, user, loadData]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
              <Folder className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">File Organizer</h1>
            <p className="text-gray-600 mt-2">Organize your digital life</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {view === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <button
              onClick={handleAuth}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50"
            >
              {loading ? 'Please wait...' : (view === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setView(view === 'login' ? 'register' : 'login');
                setError('');
              }}
              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
            >
              {view === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Folder className="text-white" size={24} />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">File Organizer</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User size={20} className="text-gray-600" />
                <span className="text-sm font-medium text-gray-700">{user.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
            <button onClick={() => setError('')} className="float-right font-bold">×</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Actions */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search files, links, and text content..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center space-x-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
            >
              <Plus size={20} />
              <span>Add Item</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Collections</h3>
                <button
                  onClick={() => setShowAddCollection(!showAddCollection)}
                  className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition"
                  title="Add Collection"
                >
                  <Plus size={20} />
                </button>
              </div>

              {showAddCollection && (
                <div className="mb-4 flex gap-2">
                  <input
                    type="text"
                    placeholder="Collection name"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCollection()}
                  />
                  <button
                    onClick={handleAddCollection}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
                  >
                    Add
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={() => setSelectedCollection('all')}
                  className={`w-full text-left px-3 py-2 rounded-lg transition ${
                    selectedCollection === 'all' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'
                  }`}
                >
                  All Items ({itemsList.length})
                </button>
                {collectionsList.map(collection => (
                  <button
                    key={collection}
                    onClick={() => setSelectedCollection(collection)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition ${
                      selectedCollection === collection ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'
                    }`}
                  >
                    {collection} ({itemsList.filter(i => i.collection === collection).length})
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between mt-6 mb-4">
                <h3 className="font-semibold text-gray-900">Tags</h3>
                <button
                  onClick={() => setShowAddTag(!showAddTag)}
                  className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition"
                  title="Add Tag"
                >
                  <Plus size={20} />
                </button>
              </div>

              {showAddTag && (
                <div className="mb-4 flex gap-2">
                  <input
                    type="text"
                    placeholder="Tag name"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
                  >
                    Add
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {tagsList.map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSelectedTags(prev => 
                        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                      );
                    }}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                      selectedTags.includes(tag)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="p-12 text-center">
                  <Folder className="mx-auto text-gray-400 mb-4" size={48} />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
                  <p className="text-gray-600">Try adjusting your search or filters, or add a new item</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredItems.map(item => (
                    <div key={item.id} className="p-6 hover:bg-gray-50 transition">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className={`p-3 rounded-lg ${
                            item.type === 'file' ? 'bg-blue-100' :
                            item.type === 'text' ? 'bg-green-100' : 'bg-purple-100'
                          }`}>
                            {item.type === 'file' ? <File size={24} className="text-blue-600" /> :
                             item.type === 'text' ? <Edit2 size={24} className="text-green-600" /> :
                             <Upload size={24} className="text-purple-600" />}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 mb-1">{item.name}</h4>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mb-2">
                              <span>{item.size}</span>
                              {item.collection && (
                                <>
                                  <span>•</span>
                                  <span>{item.collection}</span>
                                </>
                              )}
                              <span>•</span>
                              <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                            </div>
                            {item.content && (
                              <p className="text-sm text-gray-600 mb-2">{item.content.substring(0, 100)}...</p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {item.tags && item.tags.map(tag => (
                                <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => setShowPreview(item)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                          >
                            <Eye size={18} />
                          </button>
                          {item.type === 'file' && (
                            <button 
                              onClick={() => handleDownload(item.id, item.name)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            >
                              <Download size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <AddItemModal 
          onClose={() => setShowAddModal(false)} 
          onAdd={handleAddItem} 
          collections={collectionsList} 
          tags={tagsList} 
        />
      )}

      {/* Preview Modal */}
      {showPreview && <PreviewModal item={showPreview} onClose={() => setShowPreview(null)} />}
    </div>
  );
};

const AddItemModal = ({ onClose, onAdd, collections, tags }) => {
  const [itemType, setItemType] = useState('file');
  const [formData, setFormData] = useState({
    name: '', collection: collections[0] || 'Personal', tags: [], content: '', url: '', file: null
  });

  const handleSubmit = () => {
    if (!formData.name) {
      alert('Please enter a name');
      return;
    }
    if (itemType === 'file' && !formData.file) {
      alert('Please select a file');
      return;
    }
    if (itemType === 'link' && !formData.url) {
      alert('Please enter a URL');
      return;
    }
    if (itemType === 'text' && !formData.content) {
      alert('Please enter content');
      return;
    }

    onAdd({ ...formData, type: itemType });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, file, name: file.name });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Add New Item</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="flex gap-2">
              {['file', 'text', 'link'].map(type => (
                <button
                  key={type}
                  onClick={() => setItemType(type)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                    itemType === type ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {itemType === 'link' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <input
                type="url"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              />
            </div>
          )}

          {itemType === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <textarea
                required
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              />
            </div>
          )}

          {itemType === 'file' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload File</label>
              <input
                type="file"
                onChange={handleFileChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Collection</label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              value={formData.collection}
              onChange={(e) => setFormData({ ...formData, collection: e.target.value })}
            >
              {collections.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
                    }));
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    formData.tags.includes(tag) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
            >
              Add Item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PreviewModal = ({ item, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">{item.name}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6">
          {item.type === 'text' && (
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{item.content}</p>
            </div>
          )}
          {item.type === 'link' && (
            <div>
              <p className="text-gray-600 mb-4">External Link</p>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">
                {item.url}
              </a>
            </div>
          )}
          {item.type === 'file' && (
            <div className="text-center py-8">
              <File size={64} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">File: {item.name}</p>
              <p className="text-sm text-gray-500">Size: {item.size}</p>
              {item.filePath && item.filePath.match(/\.(jpg|jpeg|png|gif|svg)$/i) && (
                <img 
                  src={`http://localhost:5000/${item.filePath}`} 
                  alt={item.name} 
                  className="mt-4 max-w-full h-auto mx-auto rounded-lg"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileOrganizerApp;
