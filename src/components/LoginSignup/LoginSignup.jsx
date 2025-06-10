// App.js (Frontend React App)
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import './App.css'; // Assuming you have an App.css for basic styling

// Import icons (ensure you have lucide-react installed: npm install lucide-react)
import {
    BookOpen, User, Crown, LogOut, Loader2, CheckCircle, XCircle, ChevronLeft,
    PlusCircle, Edit, Trash2, UserPlus, Eye, EyeOff, BarChart, DollarSign, ListChecks,
    Users, FileText, Settings, Lock, Unlock, ArrowUp, ArrowDown, Star, MessageSquare
} from 'lucide-react';

// Define materialTypes globally for consistency
const materialTypes = ['Notes', 'Videos', 'Quizzes', 'Assignments'];

// --- API Utility Function (CRITICAL FOR FETCH ERRORS & COOKIES) ---
const API_BASE_URL = 'http://localhost:5000'; // Ensure this matches your backend PORT

/**
 * Helper function for making API requests.
 * Handles JSON parsing, error responses, and includes credentials for cookies.
 * @param {string} endpoint - The API endpoint (e.g., '/api/auth/login').
 * @param {object} [options] - Fetch options (method, headers, body, etc.).
 * @returns {Promise<object|null>} - The parsed JSON response, or null if no content.
 * @throws {Error} - If the network request fails or the API returns an error status.
 */
async function callApi(endpoint, options = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };

    const config = {
        method: 'GET', // Default method
        headers: { ...defaultHeaders, ...options.headers },
        credentials: 'include', // *** THIS IS CRUCIAL FOR SENDING/RECEIVING HTTP-ONLY COOKIES ***
        ...options, // Override defaults with provided options
    };

    // If body is an object, stringify it, unless it's FormData (for file uploads)
    // For FormData, 'Content-Type' header is usually omitted as browser sets it.
    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
        config.body = JSON.stringify(config.body);
    } else if (config.body instanceof FormData) {
        // If it's FormData, remove the Content-Type header so browser sets it correctly.
        delete config.headers['Content-Type'];
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

        // Check if the response was successful (HTTP status 2xx)
        if (!response.ok) {
            let errorData;
            const contentType = response.headers.get("content-type");
            // Try to parse error response as JSON, but handle cases where it's not JSON (like 404 HTML)
            if (contentType && contentType.includes("application/json")) {
                errorData = await response.json();
            } else {
                const text = await response.text();
                // This is where 'Unexpected token <' would happen if we tried to parse text as JSON
                errorData = { message: `Server error: ${response.status} ${response.statusText}`, details: text };
            }
            console.error(`API Error on ${endpoint}:`, response.status, errorData);
            // Throw a custom error that can be caught by the calling component
            throw new Error(errorData.message || `API request failed with status ${response.status}`);
        }

        // If response is successful, try to parse JSON
        // Some successful responses (e.g., DELETE with 204 No Content) might not have JSON.
        // We use .catch() to prevent errors if response is empty or not JSON.
        const data = await response.json().catch(() => null); 
        return data;

    } catch (error) {
        // This catch block handles network errors (e.g., 'Failed to fetch', ERR_CONNECTION_REFUSED, CORS blocking)
        console.error('Network or unexpected API error:', error);
        // Provide a user-friendly error message for network issues
        throw new Error(`Network error or problem connecting to the server: ${error.message}. Please check your internet connection or try again later.`);
    }
}

// --- AuthContext for global user state ---
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true); // To prevent flickering on initial load
    const [authError, setAuthError] = useState(null);

    const checkAuthStatus = useCallback(async () => {
        setLoadingAuth(true);
        setAuthError(null);
        try {
            // Attempt to get current user. If token is invalid/expired, backend will return 401/403.
            // callApi will throw an error, which is caught here.
            const user = await callApi('/api/auth/me'); 
            setCurrentUser(user);
        } catch (error) {
            console.log('No active session or session expired:', error.message);
            setCurrentUser(null);
            // setAuthError(error.message); // Only set error if truly an issue, not just no session
        } finally {
            setLoadingAuth(false);
        }
    }, []);

    useEffect(() => {
        checkAuthStatus();
    }, [checkAuthStatus]);

    const login = async (email, password) => {
        setLoadingAuth(true);
        setAuthError(null);
        try {
            const data = await callApi('/api/auth/login', { 
                method: 'POST',
                body: { email, password },
            });
            setCurrentUser(data.user);
            return { success: true };
        } catch (error) {
            setAuthError(error.message);
            setCurrentUser(null); // Ensure user is null on login failure
            return { success: false, message: error.message };
        } finally {
            setLoadingAuth(false);
        }
    };

    const logout = async () => {
        setLoadingAuth(true);
        setAuthError(null);
        try {
            await callApi('/api/auth/logout', { method: 'POST' }); 
            setCurrentUser(null);
            return { success: true };
        } catch (error) {
            setAuthError(error.message);
            return { success: false, message: error.message };
        } finally {
            setLoadingAuth(false);
        }
    };

    const register = async (userData) => {
        setLoadingAuth(true);
        setAuthError(null);
        try {
            const data = await callApi('/api/auth/register', { 
                method: 'POST',
                body: userData,
            });
            return { success: true, message: data.message };
        } catch (error) {
            setAuthError(error.message);
            return { success: false, message: error.message };
        } finally {
            setLoadingAuth(false);
        }
    };

    return (
        <AuthContext.Provider value={{ currentUser, loadingAuth, authError, login, logout, register, checkAuthStatus }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

// ====================== COMPONENTS ==========================

/**
 * Generic Modal Component
 * @param {object} props
 * @param {string} props.title - Title of the modal.
 * @param {React.ReactNode} props.children - Content to display inside the modal.
 * @param {function} props.onClose - Callback function when the modal is closed.
 * @param {boolean} props.isOpen - Whether the modal is currently open.
 * @param {boolean} [props.showOkButton=true] - Whether to show the default OK button.
 */
function Modal({ title, children, onClose, isOpen, showOkButton = true }) {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <span className="close-button" onClick={onClose}>&times;</span>
                {title && <h4>{title}</h4>}
                <div className="modal-body">{children}</div>
                {showOkButton && (
                    <div className="form-actions">
                        <button className="submit-btn" onClick={onClose}>OK</button>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Confirmation Dialog Component
 * @param {object} props
 * @param {string} props.message - The confirmation message.
 * @param {function} props.onConfirm - Callback when user confirms.
 * @param {function} props.onCancel - Callback when user cancels.
 * @param {boolean} props.isOpen - Whether the dialog is open.
 */
function ConfirmDialog({ message, onConfirm, onCancel, isOpen }) {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-content small-modal">
                <p>{message}</p>
                <div className="form-actions">
                    <button className="submit-btn" onClick={onConfirm}>Yes</button>
                    <button className="cancel-btn" onClick={onCancel}>No</button>
                </div>
            </div>
        </div>
    );
}

/**
 * Component for selecting user role at the start.
 * @param {object} props
 * @param {function(string): void} props.onSelectRole - Callback with the selected role.
 */
function RoleSelection({ onSelectRole }) {
    return (
        <div className="auth-container">
            <h2>Welcome to E-Learning Platform</h2>
            <p>Please select your role to proceed:</p>
            <div className="role-options">
                <button className="role-btn" onClick={() => onSelectRole('learner')}>
                    <div className="role-icon">👨‍🎓</div>
                    <h3>Learner</h3>
                    <p>Access courses and learning materials</p>
                </button>
                <button className="role-btn" onClick={() => onSelectRole('lecturer')}>
                    <div className="role-icon">👨‍🏫</div>
                    <h3>Lecturer</h3>
                    <p>Create and manage course content</p>
                </button>
                <button className="role-btn" onClick={() => onSelectRole('admin')}>
                    <div className="role-icon">👨‍💼</div>
                    <h3>Administrator</h3>
                    <p>Manage system users and content</p>
                </button>
            </div>
        </div>
    );
}

/**
 * Login Form Component
 * @param {object} props
 * @param {function(): void} props.onLoginSuccess - Callback for successful login.
 * @param {function(): void} props.onSwitchToRegister - Callback to switch to registration view.
 * @param {function(): void} [props.onSwitchToForgotPassword] - Callback to switch to forgot password view.
 */
function LoginForm({ onLoginSuccess, onSwitchToRegister, onSwitchToForgotPassword }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const { login, loadingAuth, authError } = useAuth(); // Use auth context for login logic

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await login(email, password);
        if (result.success) {
            onLoginSuccess(); // Trigger navigation or state update in App.js
        }
    };

    return (
        <div className="auth-form-container">
            <h2>Login</h2>
            {authError && <p className="error">{authError}</p>}
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="login-email">Email:</label>
                    <input
                        type="email"
                        id="login-email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="login-password">Password:</label>
                    <div className="password-input-wrapper">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            id="login-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <span
                            className="password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                            role="button"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </span>
                    </div>
                </div>
                <div className="form-actions">
                    <button type="submit" disabled={loadingAuth}>
                        {loadingAuth ? <Loader2 className="animate-spin" /> : 'Login'}
                    </button>
                </div>
            </form>
            <div className="auth-links">
                <button className="link-btn" onClick={onSwitchToRegister}>
                    Don't have an account? Register
                </button>
                {onSwitchToForgotPassword && (
                    <button className="link-btn" onClick={onSwitchToForgotPassword}>
                        Forgot password?
                    </button>
                )}
            </div>
        </div>
    );
}

/**
 * Registration Form Component
 * @param {object} props
 * @param {function(string): void} props.onRegisterSuccess - Callback for successful registration.
 * @param {function(): void} props.onSwitchToLogin - Callback to switch to login view.
 * @param {string} props.role - The pre-selected role for registration.
 */
function RegisterForm({ onRegisterSuccess, onSwitchToLogin, role }) {
    const [formData, setFormData] = useState({
        firstname: '',
        lastname: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: role || 'learner' // Use passed role or default to 'learner'
    });
    const [formError, setFormError] = useState(''); // Client-side validation errors
    const { register, loadingAuth, authError } = useAuth(); // Use auth context for registration logic

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError(''); // Clear previous client-side errors

        if (formData.password !== formData.confirmPassword) {
            setFormError('Passwords do not match.');
            return;
        }

        const result = await register({
            firstname: formData.firstname,
            lastname: formData.lastname,
            email: formData.email,
            password: formData.password,
            role: formData.role
        });

        if (result.success) {
            onRegisterSuccess(result.message || 'Registration successful!');
            // Clear form after successful registration
            setFormData({
                firstname: '', lastname: '', email: '', password: '', confirmPassword: '', role: role || 'learner'
            });
        }
    };

    return (
        <div className="auth-form-container">
            <h2>Register as {formData.role.charAt(0).toUpperCase() + formData.role.slice(1)}</h2>
            {formError && <p className="error">{formError}</p>}
            {authError && <p className="error">{authError}</p>} {/* Backend errors */}
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="reg-firstname">First Name:</label>
                    <input type="text" id="reg-firstname" name="firstname" value={formData.firstname} onChange={handleChange} required />
                </div>
                <div className="form-group">
                    <label htmlFor="reg-lastname">Last Name:</label>
                    <input type="text" id="reg-lastname" name="lastname" value={formData.lastname} onChange={handleChange} required />
                </div>
                <div className="form-group">
                    <label htmlFor="reg-email">Email:</label>
                    <input type="email" id="reg-email" name="email" value={formData.email} onChange={handleChange} required />
                </div>
                <div className="form-group">
                    <label htmlFor="reg-password">Password:</label>
                    <input type="password" id="reg-password" name="password" value={formData.password} onChange={handleChange} required />
                </div>
                <div className="form-group">
                    <label htmlFor="reg-confirmPassword">Confirm Password:</label>
                    <input type="password" id="reg-confirmPassword" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required />
                </div>
                {/* Role selection is hidden if pre-selected, visible for general registration */}
                {!role && (
                    <div className="form-group">
                        <label htmlFor="reg-role">Register as:</label>
                        <select id="reg-role" name="role" value={formData.role} onChange={handleChange}>
                            <option value="learner">Learner</option>
                            <option value="lecturer">Lecturer</option>
                            <option value="admin">Administrator</option>
                        </select>
                    </div>
                )}
                <div className="form-actions">
                    <button type="submit" disabled={loadingAuth}>
                        {loadingAuth ? <Loader2 className="animate-spin" /> : 'Register'}
                    </button>
                </div>
            </form>
            <div className="auth-links">
                <button className="link-btn" onClick={onSwitchToLogin}>
                    Already have an account? Login
                </button>
            </div>
        </div>
    );
}

/**
 * Forgot Password Component (Dummy, as backend doesn't implement actual reset)
 * @param {object} props
 * @param {function(): void} props.onSwitchToLogin - Callback to switch to login view.
 */
function ForgotPassword({ onSwitchToLogin }) {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');
        try {
            // This is a dummy call as backend doesn't have this route implemented yet.
            // In a real app, this would hit /api/auth/forgot-password
            console.log(`Simulating reset link sent to: ${email}`);
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
            setMessage('If an account with that email exists, a password reset link has been sent.');
            setEmail('');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-form-container">
            <h2>Forgot Password</h2>
            {error && <p className="error">{error}</p>}
            {message && <p className="success">{message}</p>}
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Email:</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="form-actions">
                    <button type="submit" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : 'Send Reset Link'}
                    </button>
                </div>
            </form>
            <div className="auth-links">
                <button className="link-btn" onClick={onSwitchToLogin}>
                    Back to Login
                </button>
            </div>
        </div>
    );
}

// --- Dashboard Components ---

/**
 * Learner Dashboard Component
 * @param {object} props
 * @param {object} props.currentUser - The authenticated learner user object.
 */
function LearnerDashboard({ currentUser }) {
    const [enrolledModules, setEnrolledModules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchEnrolledModules = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const enrollments = await callApi('/api/enrollments'); // Fetches enrollments for current learner
            
            // For each enrollment, fetch the full module details
            const modulesDetails = await Promise.all(
                enrollments.map(async (enrollment) => {
                    try {
                        const module = await callApi(`/api/modules/${enrollment.module_id}`);
                        return { 
                            ...module, 
                            enrollment_id: enrollment.id, 
                            is_completed: enrollment.is_completed,
                            // Convert MySQL DATETIME to a JS Date object
                            enrollment_date: enrollment.enrollment_date ? new Date(enrollment.enrollment_date) : null 
                        };
                    } catch (moduleError) {
                        console.error(`Failed to fetch details for module ${enrollment.module_id}:`, moduleError);
                        // Return null or a placeholder for failed modules
                        return null; 
                    }
                })
            );
            setEnrolledModules(modulesDetails.filter(Boolean)); // Filter out any nulls from failed fetches
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEnrolledModules();
    }, [fetchEnrolledModules]);

    const handleEnroll = async (moduleId) => {
        setLoading(true); // Indicate loading while enrolling
        setError(null);
        try {
            await callApi('/api/enroll', {
                method: 'POST',
                body: { module_id: moduleId }
            });
            alert('Successfully enrolled!');
            fetchEnrolledModules(); // Re-fetch modules to update status
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const markModuleComplete = async (enrollmentId) => {
        setLoading(true);
        setError(null);
        try {
            await callApi(`/api/enrollments/${enrollmentId}/complete`, { method: 'PUT' });
            alert('Module marked as complete!');
            fetchEnrolledModules(); // Refresh list or update state
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Corrected typo 'userState' to 'useState'
    const [allPublishedModules, setAllPublishedModules] = useState([]);
    const [loadingAllModules, setLoadingAllModules] = useState(true);

    useEffect(() => {
        const fetchAllPublishedModules = async () => {
            setLoadingAllModules(true);
            try {
                const data = await callApi('/api/modules'); // Backend filters for learner role (only published or enrolled)
                setAllPublishedModules(data);
            } catch (err) {
                console.error('Failed to fetch all published modules:', err);
            } finally {
                setLoadingAllModules(false);
            }
        };
        fetchAllPublishedModules();
    }, []);

    const nonEnrolledPublishedModules = allPublishedModules.filter(module => 
        !enrolledModules.some(e => e.id === module.id) // Filter out modules already in enrolledModules
    );


    return (
        <div className="dashboard-content">
            <h2>Welcome, {currentUser.firstname}</h2>
            
            <div className="section-card">
                <h3>Your Enrolled Courses</h3>
                {enrolledModules.length === 0 && !loading ? (
                    <p>You are not enrolled in any courses yet.</p>
                ) : (
                    <div className="module-grid">
                        {enrolledModules.map(module => (
                            <div key={module.id} className="module-card">
                                <h4>{module.module_name}</h4>
                                <p>{module.description}</p>
                                <div className="module-stats">
                                    <span>Instructor: {module.instructor_firstname} {module.instructor_lastname}</span>
                                    <span>Status: {module.is_completed ? 'Completed' : 'In Progress'}</span>
                                    {module.enrollment_date && <span>Enrolled: {new Date(module.enrollment_date).toLocaleDateString()}</span>}
                                </div>
                                {!module.is_completed && (
                                    <button className="action-btn" onClick={() => markModuleComplete(module.enrollment_id)}>
                                        <CheckCircle size={18} /> Mark Complete
                                    </button>
                                )}
                                <button className="view-btn">View Course</button> {/* Dummy for now */}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="section-card mt-8">
                <h3>Available Courses to Enroll</h3>
                {loadingAllModules ? (
                    <p>Loading available courses...</p>
                ) : nonEnrolledPublishedModules.length === 0 ? (
                    <p>No new courses available for enrollment.</p>
                ) : (
                    <div className="module-grid">
                        {nonEnrolledPublishedModules.map(module => (
                            <div key={module.id} className="module-card">
                                <h4>{module.module_name}</h4>
                                <p>{module.description}</p>
                                <div className="module-stats">
                                    <span>Instructor: {module.instructor_firstname} {module.instructor_lastname}</span>
                                </div>
                                <button className="action-btn" onClick={() => handleEnroll(module.id)} disabled={loading}>
                                    <PlusCircle size={18} /> Enroll Now
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Lecturer Dashboard Component
 * @param {object} props
 * @param {object} props.currentUser - The authenticated lecturer user object.
 */
function LecturerDashboard({ currentUser }) {
    const [modules, setModules] = useState([]);
    const [selectedModule, setSelectedModule] = useState(null);
    const [moduleContent, setModuleContent] = useState([]);
    const [enrolledLearners, setEnrolledLearners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('modules');
    const [showContentForm, setShowContentForm] = useState(false);
    const [showQuizForm, setShowQuizForm] = useState(false);
    const [contentForm, setContentForm] = useState({
        title: '',
        content_type: 'Notes', 
        file: null,
        content_text: '', 
    });
    const [quizForm, setQuizForm] = useState({
        title: '',
        questions: [{ question_text: '', options: ['', '', '', ''], correct_answer_index: 0 }], 
    });
    const [feedbackForm, setFeedbackForm] = useState({
        learnerId: '',
        message: '',
        rating: 5
    });
    const [showFeedbackForm, setShowFeedbackForm] = useState(false);
    const [confirmDeleteContent, setConfirmDeleteContent] = useState(null);
    const [confirmDeleteModule, setConfirmDeleteModule] = useState(null);
    const [moduleToEdit, setModuleToEdit] = useState(null);
    const [showModuleFormModal, setShowModuleFormModal] = useState(false);

    const fetchModules = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await callApi('/api/modules'); // Backend filters for lecturer role
            setModules(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchModuleContent = useCallback(async (moduleId) => {
        setError(null);
        setLoading(true);
        try {
            const data = await callApi(`/api/modules/${moduleId}/content`);
            // When fetching content, parse quiz_data if it's a JSON string
            const parsedContent = data.map(item => ({
                ...item,
                quiz_data: item.content_type === 'Quizzes' && typeof item.quiz_data === 'string' 
                            ? JSON.parse(item.quiz_data) 
                            : item.quiz_data
            }));
            setModuleContent(parsedContent);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchEnrolledLearners = useCallback(async (moduleId) => {
        setError(null);
        setLoading(true);
        try {
            // Updated to use the new dedicated endpoint for learners per module
            const learners = await callApi(`/api/modules/${moduleId}/learners`);
            
            // Mock additional data (progress, last_activity, quiz_scores) as they are not from DB yet
            const learnersWithDetails = learners.map(learner => ({
                ...learner,
                progress: Math.floor(Math.random() * 101), // Random progress
                last_activity: new Date(Date.now() - Math.random() * 1000 * 3600 * 24 * 30).toISOString(), // Random last activity within 30 days
                quiz_scores: [Math.floor(Math.random() * 50) + 50, Math.floor(Math.random() * 50) + 50], // Random scores
            }));

            setEnrolledLearners(learnersWithDetails);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchModules();
    }, [fetchModules]);

    const handleSelectModule = useCallback((module) => {
        setSelectedModule(module);
        // Do not set activeTab here, let the button onClick do it for explicit tab changes
    }, []);

    // Effect to trigger content/learners fetch when selectedModule or activeTab changes
    useEffect(() => {
        if (selectedModule) { // Only fetch if a module is selected
            if (activeTab === 'content') {
                fetchModuleContent(selectedModule.id);
            } else if (activeTab === 'learners') {
                fetchEnrolledLearners(selectedModule.id);
            }
        }
    }, [selectedModule, activeTab, fetchModuleContent, fetchEnrolledLearners]);

    const handleContentFormChange = useCallback((e) => {
        const { name, value, files } = e.target;
        if (name === 'file') {
            setContentForm(prev => ({ ...prev, file: files[0] }));
        } else {
            setContentForm(prev => ({ ...prev, [name]: value }));
        }
    }, []);

    const handleQuizFormChange = useCallback((e, questionIndex, optionIndex) => {
        const { name, value } = e.target;
        
        if (name === 'title') {
            setQuizForm(prev => ({ ...prev, title: value }));
            return;
        }

        const updatedQuestions = [...quizForm.questions];
        if (name === 'question_text') {
            updatedQuestions[questionIndex].question_text = value;
        } else if (name === 'option') {
            updatedQuestions[questionIndex].options[optionIndex] = value;
        } else if (name === 'correct_answer_index') {
            updatedQuestions[questionIndex].correct_answer_index = parseInt(value);
        }
        setQuizForm(prev => ({ ...prev, questions: updatedQuestions }));
    }, [quizForm.questions]);

    const addQuestion = useCallback(() => {
        setQuizForm(prev => ({
            ...prev,
            questions: [...prev.questions, { question_text: '', options: ['', '', '', ''], correct_answer_index: 0 }]
        }));
    }, []);

    const removeQuestion = useCallback((index) => {
        const updatedQuestions = [...quizForm.questions];
        updatedQuestions.splice(index, 1);
        setQuizForm(prev => ({ ...prev, questions: updatedQuestions }));
    }, [quizForm.questions]);

    const handleSubmitContent = useCallback(async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('title', contentForm.title);
            formData.append('content_type', contentForm.content_type); 
            
            if (contentForm.content_type === 'Quizzes') {
                 formData.append('content_text', ''); // Send empty string for backend to set null
            } else if (contentForm.content_type !== 'Quizzes' && !contentForm.file) { // Only append text if no file and not quiz
                formData.append('content_text', contentForm.content_text); 
            }
            
            if (contentForm.file) {
                formData.append('materialFile', contentForm.file); 
            }

            await callApi(`/api/modules/${selectedModule.id}/content`, {
                method: 'POST',
                body: formData,
            });

            setShowContentForm(false);
            setContentForm({ title: '', content_type: 'Notes', file: null, content_text: '' }); // Reset form
            fetchModuleContent(selectedModule.id); // Re-fetch updated content
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [contentForm, selectedModule, fetchModuleContent]);

    const handleSubmitQuiz = useCallback(async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await callApi(`/api/modules/${selectedModule.id}/content`, {
                method: 'POST',
                body: {
                    title: quizForm.title,
                    content_type: 'Quizzes',
                    quiz_data: JSON.stringify(quizForm.questions), // Backend expects quiz_data as a JSON string
                },
            });

            setShowQuizForm(false);
            setQuizForm({ title: '', questions: [{ question_text: '', options: ['', '', '', ''], correct_answer_index: 0 }]}); // Reset form
            fetchModuleContent(selectedModule.id);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [quizForm, selectedModule, fetchModuleContent]);

    const handleDeleteContent = useCallback((contentId) => {
        setConfirmDeleteContent(contentId);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!confirmDeleteContent) return;
        setLoading(true);
        setError(null);
        try {
            await callApi(`/api/content/${confirmDeleteContent}`, {
                method: 'DELETE',
            });
            alert('Content deleted successfully!');
            fetchModuleContent(selectedModule.id);
            setConfirmDeleteContent(null); 
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [confirmDeleteContent, selectedModule, fetchModuleContent]);

    const cancelDelete = useCallback(() => {
        setConfirmDeleteContent(null);
    }, []);

    const handleCreateNewModule = useCallback(() => {
        setModuleToEdit({
            module_name: '',
            description: '',
            instructor_id: currentUser.id, // Default to current lecturer
            is_published: false
        });
        setShowModuleFormModal(true);
    }, [currentUser.id]);

    const handleEditModule = useCallback((module) => {
        setModuleToEdit(module);
        setShowModuleFormModal(true);
    }, []);

    const handleModuleFormChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;
        setModuleToEdit(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    }, []);

    const handleSubmitModuleForm = useCallback(async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (moduleToEdit.id) { // Editing existing module
                await callApi(`/api/modules/${moduleToEdit.id}`, {
                    method: 'PUT',
                    body: moduleToEdit
                });
                alert('Module updated successfully!');
            } else { // Creating new module
                await callApi('/api/modules', {
                    method: 'POST',
                    body: moduleToEdit
                });
                alert('Module created successfully!');
            }
            setShowModuleFormModal(false);
            setModuleToEdit(null);
            fetchModules(); // Refresh module list
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [moduleToEdit, fetchModules]);

    const handleDeleteModule = useCallback((moduleId) => {
        setConfirmDeleteModule(moduleId);
    }, []);

    const confirmDeleteModuleAction = useCallback(async () => {
        if (!confirmDeleteModule) return;
        setLoading(true);
        setError(null);
        try {
            await callApi(`/api/modules/${confirmDeleteModule}`, { method: 'DELETE' });
            alert('Module deleted successfully!');
            fetchModules();
            setConfirmDeleteModule(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [confirmDeleteModule, fetchModules]);

    const cancelDeleteModuleAction = useCallback(() => {
        setConfirmDeleteModule(null);
    }, []);

    const handleProvideFeedback = useCallback((learner) => {
        // This is a dummy for now as backend doesn't have a specific feedback route.
        // In a real app, you'd populate feedbackForm and show a modal.
        alert(`Providing feedback for ${learner.firstname} (Feature to be implemented).`);
        setFeedbackForm({
            learnerId: learner.id,
            message: '',
            rating: 5
        });
        setShowFeedbackForm(true);
    }, []);

    const handleSubmitFeedback = useCallback(async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            // This is a dummy call as backend doesn't have this route implemented yet.
            alert('Feedback submission is a placeholder. Backend needs an endpoint for this.');
            // await callApi(`/api/lecturer/feedback`, { // This would be the actual API call
            //     method: 'POST',
            //     body: {
            //         learnerId: feedbackForm.learnerId,
            //         moduleId: selectedModule.id,
            //         message: feedbackForm.message,
            //         rating: feedbackForm.rating
            //     },
            // });
            setShowFeedbackForm(false);
            setFeedbackForm({ learnerId: '', message: '', rating: 5 }); // Reset form
            fetchEnrolledLearners(selectedModule.id);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [feedbackForm, selectedModule, fetchEnrolledLearners]);

    if (loading && !selectedModule) return <div className="dashboard-content"><h2>Lecturer Dashboard</h2><p>Loading your courses...</p><Loader2 className="animate-spin large-spinner" /></div>;
    if (error && !selectedModule) return <div className="dashboard-content"><h2>Lecturer Dashboard</h2><p className="error">{error}</p></div>;

    return (
        <div className="dashboard-content">
            <h2>Welcome, Lecturer {currentUser.firstname}</h2>
            
            {!selectedModule ? (
                <>
                    <div className="section-card">
                        <h3>Your Teaching Courses</h3>
                        <button className="add-btn mb-4" onClick={handleCreateNewModule}>
                            <PlusCircle className="icon" /> Create New Module
                        </button>
                        {modules.length === 0 && !loading ? (
                            <p>You are not teaching any courses yet.</p>
                        ) : (
                            <div className="module-grid">
                                {modules.map(module => (
                                    <div key={module.id} className="module-card">
                                        <h4>{module.module_name}</h4>
                                        <p>{module.description}</p>
                                        <div className="module-stats">
                                            <span>Students: {module.enrollment_count || 0}</span>
                                            <span>Status: {module.is_published ? 'Published' : 'Draft'}</span>
                                        </div>
                                        <div className="module-actions">
                                            <button className="view-btn" onClick={() => handleSelectModule(module)}>
                                                Manage Content
                                            </button>
                                            {/* Corrected: Use handleSelectModule and then set activeTab */}
                                            <button className="learners-btn" onClick={() => {
                                                handleSelectModule(module); // Select the module
                                                setActiveTab('learners'); // Then switch to learners tab
                                            }}>
                                                View Learners
                                            </button>
                                            <button className="edit-btn" onClick={() => handleEditModule(module)} title="Edit Module">
                                                <Edit size={18} />
                                            </button>
                                            <button className="delete-btn" onClick={() => handleDeleteModule(module.id)} title="Delete Module">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <div className="module-header">
                        <button className="back-btn" onClick={() => {
                            setSelectedModule(null);
                            setActiveTab('modules');
                            setError(null);
                        }}>
                            <ChevronLeft className="w-5 h-5" /> Back to Courses
                        </button>
                        <h3>{selectedModule.module_name}</h3>
                    </div>
                    
                    <div className="lecturer-tabs">
                        <button 
                            className={`tab-btn ${activeTab === 'content' ? 'active' : ''}`} 
                            onClick={() => {
                                setActiveTab('content');
                            }}
                        >
                            <BookOpen className="icon" /> Module Content
                        </button>
                        <button 
                            className={`tab-btn ${activeTab === 'learners' ? 'active' : ''}`} 
                            onClick={() => {
                                setActiveTab('learners');
                            }}
                        >
                            <Users className="icon" /> Enrolled Learners
                        </button>
                    </div>
                    
                    {error && activeTab !== 'modules' && <p className="error">{error}</p>}
                    {loading && activeTab !== 'modules' && <p>Loading data...</p>}

                    {activeTab === 'content' && (
                        <div className="content-management">
                            <div className="content-actions">
                                <button className="add-btn" onClick={() => setShowContentForm(true)}>
                                    <PlusCircle className="icon" /> Add Content
                                </button>
                                <button className="add-btn" onClick={() => setShowQuizForm(true)}>
                                    <ListChecks className="icon" /> Add Quiz
                                </button>
                            </div>
                            
                            {!loading && moduleContent.length === 0 ? (
                                <p>No content added yet for this module.</p>
                            ) : (
                                <div className="content-list">
                                    {moduleContent
                                        .sort((a, b) => (a.sequence || 0) - (b.sequence || 0)) // Sort by sequence, default 0
                                        .map((content) => (
                                            <div key={content.id} className="content-item">
                                                <div className="content-info">
                                                    <span className="content-type">{content.content_type}</span>
                                                    <h4>{content.title}</h4>
                                                    {content.content_text && <p>{content.content_text}</p>}
                                                    {content.content_type === 'Quizzes' && (
                                                        <div className="quiz-info">
                                                            <span>Questions: {content.quiz_data?.length || 0}</span>
                                                            <span>Passing Score: {content.passing_score || 70}% (mock)</span> 
                                                        </div>
                                                    )}
                                                    {content.file_path && (
                                                        <p>File: <a href={`${API_BASE_URL}${content.file_path}`} target="_blank" rel="noopener noreferrer">{content.file_path.split('/').pop()}</a></p>
                                                    )}
                                                </div>
                                                <div className="content-actions">
                                                    <button 
                                                        className="delete-btn" 
                                                        onClick={() => handleDeleteContent(content.id)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="icon" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {activeTab === 'learners' && (
                        <div className="learner-management">
                            {!loading && enrolledLearners.length === 0 ? (
                                <p>No learners enrolled in this module yet.</p>
                            ) : (
                                <div className="learner-table-container">
                                    <table className="learner-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Email</th>
                                                <th>Status</th>
                                                <th>Enrollment Date</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {enrolledLearners.map(learner => (
                                                <tr key={learner.id}>
                                                    <td>{learner.firstname} {learner.lastname}</td>
                                                    <td>{learner.email}</td>
                                                    <td>
                                                        <span className={`status-badge ${learner.is_active ? 'active' : 'inactive'}`}>
                                                            {learner.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td>{new Date(learner.enrollment_date).toLocaleDateString()}</td>
                                                    <td>
                                                        <button 
                                                            className="feedback-btn" 
                                                            onClick={() => handleProvideFeedback(learner)}
                                                            title="Provide Feedback"
                                                        >
                                                            <MessageSquare className="icon" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
            
            {/* Content Form Modal */}
            <Modal 
                title="Add Content" 
                isOpen={showContentForm} 
                onClose={() => {
                    setShowContentForm(false);
                    setContentForm({ title: '', content_type: 'Notes', file: null, content_text: '' });
                    setError(null);
                }}
                showOkButton={false}
            >
                <form onSubmit={handleSubmitContent}>
                    <div className="form-group">
                        <label>Title:</label>
                        <input 
                            type="text" 
                            name="title" 
                            value={contentForm.title} 
                            onChange={handleContentFormChange} 
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label>Type:</label>
                        <select 
                            name="content_type" 
                            value={contentForm.content_type} 
                            onChange={handleContentFormChange}
                            required
                        >
                            {materialTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                    {contentForm.content_type !== 'Quizzes' && ( // Only show text/file inputs if not a Quiz
                        <>
                            <div className="form-group">
                                <label>Text Content (Optional):</label>
                                <textarea 
                                    name="content_text" 
                                    value={contentForm.content_text} 
                                    onChange={handleContentFormChange} 
                                    rows="3"
                                />
                            </div>
                            <div className="form-group">
                                <label>File (Optional):</label>
                                <input 
                                    type="file" 
                                    name="file" 
                                    onChange={handleContentFormChange} 
                                />
                                <p className="text-sm text-gray-500">Either text content or a file is required for Notes, Videos, Assignments.</p>
                            </div>
                        </>
                    )}
                    {error && <p className="error">{error}</p>}
                    <div className="form-actions">
                        <button type="button" className="cancel-btn" onClick={() => {
                            setShowContentForm(false);
                            setContentForm({ title: '', content_type: 'Notes', file: null, content_text: '' });
                            setError(null);
                        }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" /> : 'Add Content'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Quiz Form Modal */}
            <Modal
                title="Add Quiz"
                isOpen={showQuizForm}
                onClose={() => {
                    setShowQuizForm(false);
                    setQuizForm({ title: '', questions: [{ question_text: '', options: ['', '', '', ''], correct_answer_index: 0 }]});
                    setError(null);
                }}
                showOkButton={false}
            >
                <form onSubmit={handleSubmitQuiz}>
                    <div className="form-group">
                        <label>Quiz Title:</label>
                        <input
                            type="text"
                            name="title"
                            value={quizForm.title}
                            onChange={(e) => setQuizForm(prev => ({ ...prev, title: e.target.value }))}
                            required
                        />
                    </div>
                    {/* Passing score removed as it's not stored in backend quiz_data currently */}

                    <h4>Questions:</h4>
                    {quizForm.questions.map((q, qIndex) => (
                        <div key={qIndex} className="quiz-question-group">
                            <div className="form-group">
                                <label>Question {qIndex + 1}:</label>
                                <textarea
                                    name="question_text"
                                    value={q.question_text}
                                    onChange={(e) => handleQuizFormChange(e, qIndex)}
                                    rows="2"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Options:</label>
                                {q.options.map((option, optIndex) => (
                                    <input
                                        key={optIndex}
                                        type="text"
                                        name="option"
                                        value={option}
                                        onChange={(e) => handleQuizFormChange(e, qIndex, optIndex)}
                                        placeholder={`Option ${optIndex + 1}`}
                                        required
                                    />
                                ))}
                            </div>
                            <div className="form-group">
                                <label>Correct Answer (Option Index):</label>
                                <select
                                    name="correct_answer_index"
                                    value={q.correct_answer_index}
                                    onChange={(e) => handleQuizFormChange(e, qIndex)}
                                    required
                                >
                                    {q.options.map((_, optIndex) => (
                                        <option key={optIndex} value={optIndex}>Option {optIndex + 1}</option>
                                    ))}
                                </select>
                            </div>
                            {quizForm.questions.length > 1 && (
                                <button type="button" className="delete-question-btn" onClick={() => removeQuestion(qIndex)}>
                                    <Trash2 className="icon" /> Remove Question
                                </button>
                            )}
                        </div>
                    ))}
                    <button type="button" className="add-question-btn" onClick={addQuestion}>
                        <PlusCircle className="icon" /> Add Question
                    </button>

                    {error && <p className="error">{error}</p>}
                    <div className="form-actions">
                        <button type="button" className="cancel-btn" onClick={() => {
                            setShowQuizForm(false);
                            setQuizForm({ title: '', questions: [{ question_text: '', options: ['', '', '', ''], correct_answer_index: 0 }]});
                            setError(null);
                        }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" /> : 'Add Quiz'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Feedback Form Modal */}
            <Modal
                title={`Provide Feedback for ${enrolledLearners.find(l => l.id === feedbackForm.learnerId)?.firstname || ''}`}
                isOpen={showFeedbackForm}
                onClose={() => {
                    setShowFeedbackForm(false);
                    setFeedbackForm({ learnerId: '', message: '', rating: 5 });
                    setError(null);
                }}
                showOkButton={false}
            >
                <form onSubmit={handleSubmitFeedback}>
                    <div className="form-group">
                        <label>Message:</label>
                        <textarea
                            name="message"
                            value={feedbackForm.message}
                            onChange={(e) => setFeedbackForm(prev => ({ ...prev, message: e.target.value }))}
                            rows="4"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Rating:</label>
                        <div className="rating-stars">
                            {[1, 2, 3, 4, 5].map(star => (
                                <Star
                                    key={star}
                                    className={star <= feedbackForm.rating ? 'filled' : ''}
                                    onClick={() => setFeedbackForm(prev => ({ ...prev, rating: star }))}
                                />
                            ))}
                        </div>
                    </div>
                    {error && <p className="error">{error}</p>}
                    <div className="form-actions">
                        <button type="button" className="cancel-btn" onClick={() => {
                            setShowFeedbackForm(false);
                            setFeedbackForm({ learnerId: '', message: '', rating: 5 });
                            setError(null);
                        }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" /> : 'Submit Feedback'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Confirm Delete Content Modal */}
            <ConfirmDialog
                message="Are you sure you want to delete this content? This action cannot be undone."
                isOpen={confirmDeleteContent !== null}
                onConfirm={confirmDelete}
                onCancel={cancelDelete}
            />

            {/* Module Form Modal (Create/Edit Module) */}
            <Modal
                title={moduleToEdit?.id ? "Edit Module" : "Create New Module"}
                isOpen={showModuleFormModal}
                onClose={() => {
                    setShowModuleFormModal(false);
                    setModuleToEdit(null);
                    setError(null);
                }}
                showOkButton={false}
            >
                {moduleToEdit && (
                    <form onSubmit={handleSubmitModuleForm}>
                        <div className="form-group">
                            <label>Module Name:</label>
                            <input type="text" name="module_name" value={moduleToEdit.module_name || ''} onChange={handleModuleFormChange} required />
                        </div>
                        <div className="form-group">
                            <label>Description:</label>
                            <textarea name="description" value={moduleToEdit.description || ''} onChange={handleModuleFormChange} rows="3" />
                        </div>
                        <div className="form-group">
                            <label>Instructor:</label>
                            {/* For lecturers, this should be pre-filled with their ID and read-only */}
                            <input type="text" name="instructor_id" value={moduleToEdit.instructor_id || ''} onChange={handleModuleFormChange} readOnly={currentUser.role === 'lecturer'} />
                            {/* If Admin, you'd fetch a list of lecturers to select from here */}
                        </div>
                        <div className="form-group checkbox-group">
                            <input type="checkbox" id="isPublished" name="is_published" checked={moduleToEdit.is_published || false} onChange={handleModuleFormChange} />
                            <label htmlFor="isPublished">Publish Module</label>
                        </div>
                        {error && <p className="error">{error}</p>}
                        <div className="form-actions">
                            <button type="button" className="cancel-btn" onClick={() => {
                                setShowModuleFormModal(false);
                                setModuleToEdit(null);
                                setError(null);
                            }}>
                                Cancel
                            </button>
                            <button type="submit" disabled={loading}>
                                {loading ? <Loader2 className="animate-spin" /> : (moduleToEdit.id ? 'Save Changes' : 'Create Module')}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Confirm Delete Module Modal */}
            <ConfirmDialog
                message="Are you sure you want to delete this module? All associated content and enrollments will also be removed."
                isOpen={confirmDeleteModule !== null}
                onConfirm={confirmDeleteModuleAction}
                onCancel={cancelDeleteModuleAction}
            />
        </div>
    );
}

/**
 * Admin Dashboard Component
 * @param {object} props
 * @param {object} props.currentUser - The authenticated admin user object.
 */
function AdminDashboard({ currentUser }) {
    const [activeTab, setActiveTab] = useState('userManagement');
    const [users, setUsers] = useState([]);
    const [modules, setModules] = useState([]);
    const [lecturers, setLecturers] = useState([]); // Used for assigning instructors to modules
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [newUserData, setNewUserData] = useState({
        firstname: '', lastname: '', email: '', password: '', role: 'learner'
    });
    const [confirmUserDelete, setConfirmUserDelete] = useState(null);
    const [moduleToEdit, setModuleToEdit] = useState(null);
    const [showModuleFormModal, setShowModuleFormModal] = useState(false);
    const [confirmDeleteModule, setConfirmDeleteModule] = useState(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await callApi('/api/users');
            setUsers(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchLecturers = useCallback(async () => {
        setError(null);
        try {
            const data = await callApi('/api/users?role=lecturer'); // Fetch only lecturers
            setLecturers(data);
        } catch (err) {
            setError(err.message);
        }
    }, []);

    const fetchModules = useCallback(async () => {
        setLoading(true); // Indicate loading for modules tab
        setError(null);
        try {
            const data = await callApi('/api/modules');
            setModules(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Reset loading state for the specific tab
        setLoading(true); 
        if (activeTab === 'userManagement') {
            fetchUsers();
        } else if (activeTab === 'courseManagement') {
            fetchModules();
            fetchLecturers(); // Fetch lecturers for module assignment
        }
    }, [activeTab, fetchUsers, fetchModules, fetchLecturers]);

    const handleAddUserChange = useCallback((e) => {
        const { name, value } = e.target;
        setNewUserData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleAddUserSubmit = useCallback(async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await callApi('/api/auth/register', { // Use /api/auth/register for new user creation by admin
                method: 'POST',
                body: newUserData,
            });
            setShowAddUserModal(false);
            setNewUserData({ firstname: '', lastname: '', email: '', password: '', role: 'learner' }); // Reset form
            fetchUsers(); // Refresh user list
            alert('User added successfully!');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [newUserData, fetchUsers]);

    const handleDeleteUser = useCallback((userId) => {
        setConfirmUserDelete(userId);
    }, []);

    const confirmUserDeletion = useCallback(async () => {
        if (!confirmUserDelete) return;
        setLoading(true);
        setError(null);
        try {
            await callApi(`/api/users/${confirmUserDelete}`, {
                method: 'DELETE',
            });
            alert('User deleted successfully!');
            fetchUsers();
            setConfirmUserDelete(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [confirmUserDelete, fetchUsers]);

    const cancelUserDeletion = useCallback(() => {
        setConfirmUserDelete(null);
    }, []);

    const toggleUserStatus = useCallback(async (user) => {
        setLoading(true);
        setError(null);
        try {
            await callApi(`/api/users/${user.id}/status`, {
                method: 'PUT',
                body: { is_active: !user.is_active },
            });
            alert('User status updated!');
            fetchUsers();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [fetchUsers]);

    const handlePromoteToLecturer = useCallback(async (user) => {
        setLoading(true);
        setError(null);
        try {
            await callApi(`/api/users/${user.id}/promote`, { method: 'PUT' });
            alert('User promoted to lecturer!');
            fetchUsers();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [fetchUsers]);

    const handleCreateNewModule = useCallback(() => {
        setModuleToEdit({
            module_name: '',
            description: '',
            instructor_id: lecturers.length > 0 ? lecturers[0].id : '', // Pre-select first lecturer if available
            is_published: false
        });
        setShowModuleFormModal(true);
    }, [lecturers]);

    const handleEditModule = useCallback((module) => {
        setModuleToEdit(module);
        setShowModuleFormModal(true);
    }, []);

    const handleModuleFormChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;
        setModuleToEdit(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    }, []);

    const handleSubmitModuleForm = useCallback(async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (moduleToEdit.id) { // Editing existing module
                await callApi(`/api/modules/${moduleToEdit.id}`, {
                    method: 'PUT',
                    body: moduleToEdit
                });
                alert('Module updated successfully!');
            } else { // Creating new module
                await callApi('/api/modules', {
                    method: 'POST',
                    body: moduleToEdit
                });
                alert('Module created successfully!');
            }
            setShowModuleFormModal(false);
            setModuleToEdit(null);
            fetchModules(); // Refresh module list
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [moduleToEdit, fetchModules]);

    const handleDeleteModule = useCallback((moduleId) => {
        setConfirmDeleteModule(moduleId);
    }, []);

    const confirmDeleteModuleAction = useCallback(async () => {
        if (!confirmDeleteModule) return;
        setLoading(true);
        setError(null);
        try {
            await callApi(`/api/modules/${confirmDeleteModule}`, { method: 'DELETE' });
            alert('Module deleted successfully!');
            fetchModules();
            setConfirmDeleteModule(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [confirmDeleteModule, fetchModules]);

    const cancelDeleteModuleAction = useCallback(() => {
        setConfirmDeleteModule(null);
    }, []);


    return (
        <div className="dashboard-content">
            <h2>Welcome, Administrator {currentUser.firstname}</h2>

            <div className="admin-tabs">
                <button
                    className={`tab-btn ${activeTab === 'userManagement' ? 'active' : ''}`}
                    onClick={() => setActiveTab('userManagement')}
                >
                    <Users className="icon" /> User Management
                </button>
                <button
                    className={`tab-btn ${activeTab === 'courseManagement' ? 'active' : ''}`}
                    onClick={() => setActiveTab('courseManagement')}
                >
                    <BookOpen className="icon" /> Course Management
                </button>
                {/* Add more tabs as needed, e.g., for reports */}
                {/* <button className="tab-btn" onClick={() => setActiveTab('reports')}>
                    <BarChart className="icon" /> Analytics
                </button> */}
            </div>

            {error && <p className="error">{error}</p>}
            {loading && <p>Loading data...</p>}

            {activeTab === 'userManagement' && (
                <div className="section-card">
                    <h3>User Management</h3>
                    <button className="add-btn mb-4" onClick={() => setShowAddUserModal(true)}>
                        <UserPlus className="icon" /> Add New User
                    </button>
                    {!loading && users.length === 0 ? (
                        <p>No users found.</p>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(user => (
                                        <tr key={user.id}>
                                            <td>{user.firstname} {user.lastname}</td>
                                            <td>{user.email}</td>
                                            <td>{user.role}</td>
                                            <td>
                                                <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                                                    {user.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    className="action-btn"
                                                    onClick={() => toggleUserStatus(user)}
                                                    title={user.is_active ? 'Deactivate User' : 'Activate User'}
                                                    disabled={user.role === 'admin' && user.id === currentUser.id} // Cannot deactivate self
                                                >
                                                    {user.is_active ? <Lock size={16} /> : <Unlock size={16} />}
                                                </button>
                                                {user.role !== 'lecturer' && user.role !== 'admin' && (
                                                    <button onClick={() => handlePromoteToLecturer(user)} className="action-btn" title="Promote to Lecturer">
                                                        <ArrowUp size={16} />
                                                    </button>
                                                )}
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    title="Delete User"
                                                    disabled={user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1} // Prevent deleting last admin
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'courseManagement' && (
                <div className="section-card">
                    <h3>Course Management</h3>
                    <button className="add-btn mb-4" onClick={handleCreateNewModule}>
                        <PlusCircle className="icon" /> Create New Module
                    </button>
                    {!loading && modules.length === 0 ? (
                        <p>No modules found.</p>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Module Name</th>
                                        <th>Description</th>
                                        <th>Instructor</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modules.map(module => (
                                        <tr key={module.id}>
                                            <td>{module.module_name}</td>
                                            <td>{module.description}</td>
                                            <td>{module.instructor_firstname} {module.instructor_lastname}</td>
                                            <td>
                                                <span className={`status-badge ${module.is_published ? 'active' : 'inactive'}`}>
                                                    {module.is_published ? 'Published' : 'Draft'}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    className="action-btn"
                                                    onClick={() => handleEditModule(module)}
                                                    title="Edit Module"
                                                >
                                                    <Edit className="icon" />
                                                </button>
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => handleDeleteModule(module.id)}
                                                    title="Delete Module"
                                                >
                                                    <Trash2 className="icon" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
            
            {/* Add User Modal */}
            <Modal
                title="Add New User"
                isOpen={showAddUserModal}
                onClose={() => {
                    setShowAddUserModal(false);
                    setNewUserData({ firstname: '', lastname: '', email: '', password: '', role: 'learner' });
                    setError(null);
                }}
                showOkButton={false}
            >
                <form onSubmit={handleAddUserSubmit}>
                    <div className="form-group">
                        <label>First Name:</label>
                        <input type="text" name="firstname" value={newUserData.firstname} onChange={handleAddUserChange} required />
                    </div>
                    <div className="form-group">
                        <label>Last Name:</label>
                        <input type="text" name="lastname" value={newUserData.lastname} onChange={handleAddUserChange} required />
                    </div>
                    <div className="form-group">
                        <label>Email:</label>
                        <input type="email" name="email" value={newUserData.email} onChange={handleAddUserChange} required />
                    </div>
                    <div className="form-group">
                        <label>Password:</label>
                        <input type="password" name="password" value={newUserData.password} onChange={handleAddUserChange} required />
                    </div>
                    <div className="form-group">
                        <label>Role:</label>
                        <select name="role" value={newUserData.role} onChange={handleAddUserChange} required>
                            <option value="learner">Learner</option>
                            <option value="lecturer">Lecturer</option>
                            <option value="admin">Administrator</option>
                        </select>
                    </div>
                    {error && <p className="error">{error}</p>}
                    <div className="form-actions">
                        <button type="button" className="cancel-btn" onClick={() => {
                            setShowAddUserModal(false);
                            setNewUserData({ firstname: '', lastname: '', email: '', password: '', role: 'learner' });
                            setError(null);
                        }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" /> : 'Add User'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Edit/Create Module Modal (Reused from LecturerDashboard) */}
            <Modal
                title={moduleToEdit?.id ? "Edit Module" : "Create New Module"}
                isOpen={showModuleFormModal}
                onClose={() => {
                    setShowModuleFormModal(false);
                    setModuleToEdit(null);
                    setError(null);
                }}
                showOkButton={false}
            >
                {moduleToEdit && (
                    <form onSubmit={handleSubmitModuleForm}>
                        <div className="form-group">
                            <label>Module Name:</label>
                            <input type="text" name="module_name" value={moduleToEdit.module_name || ''} onChange={handleModuleFormChange} required />
                        </div>
                        <div className="form-group">
                            <label>Description:</label>
                            <textarea name="description" value={moduleToEdit.description || ''} onChange={handleModuleFormChange} rows="3" />
                        </div>
                        <div className="form-group">
                            <label>Instructor:</label>
                            <select name="instructor_id" value={moduleToEdit.instructor_id || ''} onChange={handleModuleFormChange} required>
                                <option value="">Select Instructor</option>
                                {lecturers.map(lecturer => (
                                    <option key={lecturer.id} value={lecturer.id}>{lecturer.firstname} {lecturer.lastname}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group checkbox-group">
                            <input type="checkbox" id="isPublishedAdmin" name="is_published" checked={moduleToEdit.is_published || false} onChange={handleModuleFormChange} />
                            <label htmlFor="isPublishedAdmin">Publish Module</label>
                        </div>
                        {error && <p className="error">{error}</p>}
                        <div className="form-actions">
                            <button type="button" className="cancel-btn" onClick={() => {
                                setShowModuleFormModal(false);
                                setModuleToEdit(null);
                                setError(null);
                            }}>
                                Cancel
                            </button>
                            <button type="submit" disabled={loading}>
                                {loading ? <Loader2 className="animate-spin" /> : (moduleToEdit.id ? 'Save Changes' : 'Create Module')}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Confirm User Delete Modal */}
            <ConfirmDialog
                message={`Are you sure you want to delete user ${users.find(u => u.id === confirmUserDelete)?.email}? This action is irreversible.`}
                isOpen={confirmUserDelete !== null}
                onConfirm={confirmUserDeletion}
                onCancel={cancelUserDeletion}
            />

            {/* Confirm Module Delete Modal */}
            <ConfirmDialog
                message="Are you sure you want to delete this module? All associated content and enrollments will also be removed."
                isOpen={confirmDeleteModule !== null}
                onConfirm={confirmDeleteModuleAction}
                onCancel={cancelDeleteModuleAction}
            />
        </div>
    );
}


// Main App Component
function App() {
    const { currentUser, loadingAuth, logout } = useAuth();
    // 'roleSelection', 'login', 'register', 'forgotPassword', 'dashboard'
    const [currentAuthView, setCurrentAuthView] = useState('roleSelection'); 
    const [selectedRole, setSelectedRole] = useState(null); // Role selected for login/registration
    const [registerSuccessMessage, setRegisterSuccessMessage] = useState('');
    const [isRegisterSuccessModalOpen, setIsRegisterSuccessModalOpen] = useState(false);

    // Effect to redirect to dashboard if logged in, or back to role selection if not
    useEffect(() => {
        if (!loadingAuth) {
            if (currentUser) {
                setCurrentAuthView('dashboard');
            } else {
                setCurrentAuthView('roleSelection');
            }
        }
    }, [currentUser, loadingAuth]);

    const handleRoleSelect = useCallback((role) => {
        setSelectedRole(role);
        setCurrentAuthView('login'); // Default to login after role selection
    }, []);

    const handleLoginSuccess = useCallback(() => {
        // AuthContext will automatically update currentUser and trigger useEffect to change view
    }, []);

    const handleRegisterSuccess = useCallback((message) => {
        setRegisterSuccessMessage(message);
        setIsRegisterSuccessModalOpen(true);
        setCurrentAuthView('login'); // Go back to login after successful registration
    }, []);

    const handleLogout = useCallback(async () => {
        const result = await logout();
        if (result.success) {
            // AuthContext useEffect will handle setting currentAuthView to 'roleSelection'
            alert('Logged out successfully!'); // Provide user feedback
        } else {
            alert(result.message || 'Logout failed.');
        }
    }, [logout]);

    if (loadingAuth) {
        return (
            <div className="loading-screen">
                <Loader2 className="spinner" size={48} />
                <p>Loading application...</p>
            </div>
        );
    }

    return (
        <div className="App">
            <header className="app-header">
                <h1>E-Learning Platform</h1>
                {currentUser && (
                    <div className="user-info">
                        <span>Welcome, {currentUser.firstname} ({currentUser.role})</span>
                        <button className="logout-btn" onClick={handleLogout}>
                            <LogOut className="icon" /> Logout
                        </button>
                    </div>
                )}
            </header>
            <main>
                {/* Authentication and Role Selection Views */}
                {currentAuthView === 'roleSelection' && <RoleSelection onSelectRole={handleRoleSelect} />}

                {currentAuthView === 'login' && (
                    <LoginForm
                        onLoginSuccess={handleLoginSuccess}
                        onSwitchToRegister={() => setCurrentAuthView('register')}
                        onSwitchToForgotPassword={() => setCurrentAuthView('forgotPassword')}
                    />
                )}

                {currentAuthView === 'register' && (
                    <RegisterForm
                        onRegisterSuccess={handleRegisterSuccess}
                        onSwitchToLogin={() => setCurrentAuthView('login')}
                        role={selectedRole || 'learner'} // Default to learner if user went directly to register
                    />
                )}

                {currentAuthView === 'forgotPassword' && (
                    <ForgotPassword onSwitchToLogin={() => setCurrentAuthView('login')} />
                )}

                {/* Dashboard View */}
                {currentAuthView === 'dashboard' && currentUser && (
                    <div className="dashboard-wrapper">
                        {/* Render specific dashboard based on role */}
                        {currentUser.role === 'learner' && <LearnerDashboard currentUser={currentUser} />}
                        {currentUser.role === 'lecturer' && <LecturerDashboard currentUser={currentUser} />}
                        {currentUser.role === 'admin' && <AdminDashboard currentUser={currentUser} />}
                    </div>
                )}
            </main>

            {/* Registration Success Modal */}
            <Modal
                title="Registration Successful"
                isOpen={isRegisterSuccessModalOpen}
                onClose={() => setIsRegisterSuccessModalOpen(false)}
            >
                <div style={{ textAlign: 'center' }}>
                    <CheckCircle size={48} color="#4CAF50" />
                    <p>{registerSuccessMessage}</p>
                    <p>You can now log in using your new credentials.</p>
                </div>
            </Modal>
        </div>
    );
}

// Wrap your App component with the AuthProvider
// This is the default export for your React application
export default function AppWithAuth() {
    return (
        <AuthProvider>
            <App />
        </AuthProvider>
    );
}
