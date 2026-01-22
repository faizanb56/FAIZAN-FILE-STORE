import React, { useState, useEffect, useRef } from 'react';
import { 
  Star, 
  Download, 
  Upload, 
  Trash2, 
  File, 
  FileText, 
  Image as ImageIcon, 
  Music, 
  Video, 
  Lock, 
  LogOut, 
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Admin Configuration ---
const ADMIN_PIN = "432272";

export default function App() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  
  const fileInputRef = useRef(null);

  // 1. Auth Setup
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching (Real-time)
  useEffect(() => {
    if (!user) return;

    // Using a public collection so admin shares with everyone
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'files'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const filesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setFiles(filesData);
      }, 
      (error) => {
        console.error("Error fetching files:", error);
        showToast("Error loading files", "error");
      }
    );

    return () => unsubscribe();
  }, [user]);

  // --- Helper Functions ---

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (pinInput === ADMIN_PIN) {
      setIsAdmin(true);
      setShowLoginModal(false);
      setPinInput("");
      showToast("Welcome Admin! Access Granted.");
    } else {
      showToast("Incorrect PIN. Access Denied.", "error");
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    showToast("Logged out of Admin Panel");
  };

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-6 h-6 text-purple-400" />;
    if (type.startsWith('video/')) return <Video className="w-6 h-6 text-red-400" />;
    if (type.startsWith('audio/')) return <Music className="w-6 h-6 text-yellow-400" />;
    if (type.includes('pdf')) return <FileText className="w-6 h-6 text-orange-400" />;
    return <File className="w-6 h-6 text-blue-400" />;
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // --- Core Actions ---

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Limit file size for Firestore (Firestore doc limit is 1MB, let's keep it safe at 700KB for Base64 overhead)
    if (file.size > 700000) {
      showToast("File too large! Max 700KB for this demo.", "error");
      return;
    }

    setUploading(true);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64String = event.target.result;
      
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'files'), {
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64String,
          createdAt: serverTimestamp()
        });
        showToast("File uploaded successfully!");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (error) {
        console.error("Upload error", error);
        showToast("Upload failed.", "error");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'files', fileId));
      showToast("File removed.");
    } catch (error) {
      showToast("Could not delete file.", "error");
    }
  };

  const handleDownload = (file) => {
    // This creates a virtual link to trigger the download directly to device library
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Downloading ${file.name}...`);
  };

  // --- Render Components ---

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-20">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-bounce-in ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <File className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                FAIZAN FILE STORE
              </h1>
              <p className="text-xs text-slate-400">Premium Downloads</p>
            </div>
          </div>

          <button 
            onClick={isAdmin ? handleLogout : () => setShowLoginModal(true)}
            className={`p-2 rounded-full transition-all duration-300 ${isAdmin ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-slate-700 hover:bg-yellow-500/20 hover:text-yellow-400 text-slate-400'}`}
            title={isAdmin ? "Logout Admin" : "Admin Login"}
          >
            {isAdmin ? <LogOut size={20} /> : <Star size={20} />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Admin Upload Section */}
        {isAdmin && (
          <div className="mb-12 animate-fade-in">
            <div className="bg-gradient-to-br from-indigo-900/50 to-slate-800 border border-indigo-500/30 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-indigo-300 flex items-center gap-2">
                  <Lock size={18} /> Admin Dashboard
                </h2>
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs rounded-full border border-indigo-500/20">
                  Secure Mode Active
                </span>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <label className="flex-1 w-full cursor-pointer group">
                  <div className="w-full border-2 border-dashed border-slate-600 rounded-xl h-32 flex flex-col items-center justify-center bg-slate-800/50 group-hover:border-indigo-500 group-hover:bg-slate-800 transition-all">
                    <Upload className="text-slate-400 group-hover:text-indigo-400 mb-2 transition-colors" />
                    <span className="text-sm text-slate-400 group-hover:text-slate-200">
                      Click to Select File
                    </span>
                    <span className="text-xs text-slate-500 mt-1">Max 700KB (Demo Limit)</span>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={handleFileUpload}
                    ref={fileInputRef}
                    disabled={uploading}
                  />
                </label>
              </div>
              
              {uploading && (
                <div className="mt-4">
                  <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div className="bg-indigo-500 h-2 rounded-full animate-progress"></div>
                  </div>
                  <p className="text-center text-xs text-indigo-300 mt-2">Uploading file securely...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Files Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Available Files</h2>
            <span className="text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
              {files.length} Files
            </span>
          </div>

          {files.length === 0 ? (
            <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <File className="text-slate-600 w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium text-slate-300">No files uploaded yet</h3>
              <p className="text-slate-500 text-sm mt-1">Admin needs to upload files first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {files.map((file) => (
                <div 
                  key={file.id}
                  className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 group flex flex-col"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-700 group-hover:border-indigo-500/30 transition-colors">
                      {getFileIcon(file.type)}
                    </div>
                    {isAdmin && (
                      <button 
                        onClick={() => handleDelete(file.id)}
                        className="p-2 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                        title="Delete File"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-200 truncate pr-2 mb-1" title={file.name}>
                      {file.name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                      <span>{formatSize(file.size)}</span>
                      <span>•</span>
                      <span>{file.type.split('/')[1]?.toUpperCase() || 'FILE'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(file)}
                    className="w-full py-2.5 px-4 bg-slate-700 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg transition-all duration-300 flex items-center justify-center gap-2 font-medium active:scale-95"
                  >
                    <Download size={18} />
                    Download File
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Admin Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-8 shadow-2xl transform transition-all scale-100 relative">
            <button 
              onClick={() => { setShowLoginModal(false); setPinInput(""); }}
              className="absolute top-4 right-4 text-slate-500 hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-indigo-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
                <Lock className="w-8 h-8 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Admin Verification</h2>
              <p className="text-slate-400 text-sm mt-2">Enter the secret key to manage files.</p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter Key Code"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-slate-600 transition-all"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/25 active:scale-95"
              >
                Verify Access
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tailwind Custom Animations */}
      <style>{`
        @keyframes progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
        .animate-progress {
          animation: progress 1.5s ease-in-out infinite;
        }
        .animate-bounce-in {
          animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        @keyframes bounceIn {
          0% { transform: translate(-50%, -100%); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

