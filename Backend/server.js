// server.js (Node.js Backend)

const express = require('express');
const mysql = require('mysql2/promise'); // Using promise-based mysql2 for async/await
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer'); // For file uploads
const path = require('path');
const cors = require('cors'); // Import cors
const fs = require('fs'); // Import fs for directory check in multer setup

dotenv.config(); // Load environment variables from .env file

const app = express();
const PORT = process.env.PORT || 5000;

// --- Database Connection Pool ---
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test DB connection
pool.getConnection()
    .then(connection => {
        console.log('Successfully connected to MySQL database!');
        connection.release(); // Release the connection immediately
    })
    .catch(err => {
        console.error('Failed to connect to MySQL database:', err.message);
        process.exit(1); // Exit process if DB connection fails
    });

// --- Middleware ---
// CORS configuration
const corsOptions = {
    origin: 'http://localhost:3000', // Allow requests from your React app's URL
    credentials: true, // Allow cookies to be sent with requests
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
};
app.use(cors(corsOptions));
app.use(express.json()); // Body parser for JSON requests
app.use(cookieParser()); // Cookie parser middleware

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer setup for file uploads
const upload = multer({ 
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            // Create the uploads directory if it doesn't exist
            const uploadDir = path.join(__dirname, 'uploads');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true }); // Use recursive to create parent directories if needed
            }
            cb(null, 'uploads/');
        },
        filename: (req, file, cb) => {
            // Generate a unique filename
            cb(null, `${Date.now()}-${file.originalname}`);
        }
    }) 
});


// --- Authentication Middleware ---
/**
 * Middleware to verify JWT token from HTTP-only cookie.
 * Populates req.user with decoded token payload (user ID, role).
 */
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        console.log('Authentication failed: No token provided');
        return res.status(401).json({ message: 'Authentication failed: No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.log('Authentication failed: Invalid token', err.message);
            // Clear expired/invalid token
            res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax' });
            return res.status(403).json({ message: 'Authentication failed: Invalid token' });
        }
        req.user = user; // Attach user payload to request
        next();
    });
};

/**
 * Middleware to authorize user role.
 * Requires authenticateToken to run first.
 * @param {string[]} allowedRoles - Array of roles allowed to access the route (e.g., ['admin', 'lecturer'])
 */
const authorizeRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            console.log('Authorization failed: User or role not found in token');
            return res.status(403).json({ message: 'Access denied: User information missing' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            console.log(`Authorization failed: User role '${req.user.role}' not in allowed roles '${allowedRoles.join(', ')}'`);
            return res.status(403).json({ message: `Access denied: You do not have the required role (${allowedRoles.join(', ')})` });
        }
        next();
    };
};

// --- Helper function to get full user data by ID ---
async function getUserById(userId) {
    const [rows] = await pool.execute('SELECT id, firstname, lastname, email, role, is_active FROM users WHERE id = ?', [userId]);
    return rows[0]; // Return the first user found or undefined
}

// --- Routes ---

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public (or Admin only if adding users via admin panel)
app.post('/api/auth/register', async (req, res) => {
    const { firstname, lastname, email, password, role } = req.body;

    if (!firstname || !lastname || !email || !password || !role) {
        return res.status(400).json({ message: 'Please enter all fields' });
    }

    try {
        const [existingUser] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'User with that email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        // Corrected INSERT statement: Omit the 'id' column as it's AUTO_INCREMENT,
        // and 'is_active' as it has a DEFAULT TRUE.
        await pool.execute(
            'INSERT INTO users (firstname, lastname, email, password, role) VALUES (?, ?, ?, ?, ?)',
            [firstname, lastname, email, hashedPassword, role]
        );
        res.status(201).json({ message: 'Registration successful' });
    } catch (err) {
        console.error('Error during registration:', err);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please enter all fields' });
    }

    try {
        const [users] = await pool.execute('SELECT id, firstname, lastname, email, password, role, is_active FROM users WHERE email = ?', [email]);
        const user = users[0];

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        if (!user.is_active) {
            return res.status(403).json({ message: 'Your account is inactive. Please contact an administrator.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        // Set JWT as an HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true, // Prevents client-side JavaScript from accessing
            secure: process.env.NODE_ENV === 'production', // Use secure in production (HTTPS)
            sameSite: 'Lax', // Protects against CSRF attacks
            maxAge: 3600000 // 1 hour in milliseconds
        });

        // Return user data (excluding password)
        const { password: _, ...userData } = user; // Destructure to omit password
        res.status(200).json({ message: 'Logged in successfully', user: userData });

    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user by clearing cookie
// @access  Private
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
    });
    res.status(200).json({ message: 'Logged out successfully' });
});

// @route   GET /api/auth/me
// @desc    Get current authenticated user's data
// @access  Private
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (err) {
        console.error('Error fetching current user:', err);
        res.status(500).json({ message: 'Server error fetching user data' });
    }
});


// --- User Management Routes (Admin Only) ---

// @route   GET /api/users
// @desc    Get all users
// @access  Admin
app.get('/api/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const roleFilter = req.query.role; // Allows filtering by role: /api/users?role=lecturer
        let query = 'SELECT id, firstname, lastname, email, role, is_active, created_at FROM users';
        let params = [];

        if (roleFilter) {
            query += ' WHERE role = ?';
            params.push(roleFilter);
        }
        query += ' ORDER BY created_at DESC';

        const [users] = await pool.execute(query, params);
        res.status(200).json(users);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Server error fetching users' });
    }
});

// @route   DELETE /api/users/:id
// @desc    Delete a user
// @access  Admin
app.delete('/api/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    const userId = req.params.id;
    if (req.user.id === parseInt(userId)) { // Prevent admin from deleting themselves
        return res.status(403).json({ message: 'You cannot delete your own account.' });
    }
    try {
        const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ message: 'Server error deleting user' });
    }
});

// @route   PUT /api/users/:id/status
// @desc    Toggle user active status
// @access  Admin
app.put('/api/users/:id/status', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    const userId = req.params.id;
    const { is_active } = req.body; // Expecting boolean

    if (req.user.id === parseInt(userId) && is_active === false) {
        return res.status(403).json({ message: 'You cannot deactivate your own admin account.' });
    }
    
    try {
        const [result] = await pool.execute('UPDATE users SET is_active = ? WHERE id = ?', [is_active, userId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: 'User status updated successfully' });
    } catch (err) {
        console.error('Error updating user status:', err);
        res.status(500).json({ message: 'Server error updating user status' });
    }
});

// @route   PUT /api/users/:id/promote
// @desc    Promote a user to lecturer role
// @access  Admin
app.put('/api/users/:id/promote', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    const userId = req.params.id;
    try {
        const [result] = await pool.execute('UPDATE users SET role = "lecturer" WHERE id = ? AND role != "admin"', [userId]);
        if (result.affectedRows === 0) {
            // Could mean user not found or user is already admin
            return res.status(404).json({ message: 'User not found or cannot be promoted (already an admin).' });
        }
        res.status(200).json({ message: 'User promoted to lecturer successfully' });
    } catch (err) {
        console.error('Error promoting user:', err);
        res.status(500).json({ message: 'Server error promoting user' });
    }
});


// --- Module Management Routes (Lecturer & Admin) ---

// @route   GET /api/modules
// @desc    Get all modules (filtered by instructor for lecturers, all for admin)
// @access  Lecturer, Admin, Public (for unauthenticated browsing)
app.get('/api/modules', authenticateToken, async (req, res) => {
    try {
        let query = `
            SELECT 
                m.id, 
                m.module_name, 
                m.description, 
                m.instructor_id, 
                m.is_published, 
                m.category, 
                m.difficulty, 
                m.duration_hours, 
                m.price,
                u.firstname AS instructor_firstname, 
                u.lastname AS instructor_lastname,
                COUNT(e.id) AS enrollment_count
            FROM modules m
            JOIN users u ON m.instructor_id = u.id
            LEFT JOIN enrollments e ON m.id = e.module_id
        `;
        let params = [];
        let conditions = [];

        // Apply filters for public/learner view (only published modules)
        if (!req.user || (req.user.role === 'learner' && !req.query.internal)) { // 'internal' flag for admin/lecturer to see drafts
            conditions.push('m.is_published = TRUE');
        }

        // Lecturer sees only their own modules
        if (req.user && req.user.role === 'lecturer') {
            conditions.push('m.instructor_id = ?');
            params.push(req.user.id);
        }

        // Apply query parameters from frontend for filtering (for learners/public)
        if (req.query.category && (!req.user || req.user.role === 'learner')) {
            conditions.push('m.category = ?');
            params.push(req.query.category);
        }
        if (req.query.difficulty && (!req.user || req.user.role === 'learner')) {
            conditions.push('m.difficulty = ?');
            params.push(req.query.difficulty);
        }
        if (req.query.duration_hours_max && (!req.user || req.user.role === 'learner')) {
            conditions.push('m.duration_hours <= ?');
            params.push(parseInt(req.query.duration_hours_max));
        }
        if (req.query.price_max && (!req.user || req.user.role === 'learner')) {
            conditions.push('m.price <= ?');
            params.push(parseFloat(req.query.price_max));
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' GROUP BY m.id ORDER BY m.created_at DESC';

        const [modules] = await pool.execute(query, params);
        res.status(200).json(modules);
    } catch (err) {
        console.error('Error fetching modules:', err);
        res.status(500).json({ message: 'Server error fetching modules' });
    }
});


// @route   GET /api/modules/:id
// @desc    Get a single module by ID
// @access  Lecturer, Admin, Learner (if enrolled or published)
app.get('/api/modules/:id', authenticateToken, async (req, res) => {
    const moduleId = req.params.id;
    try {
        let query = `
            SELECT 
                m.id, 
                m.module_name, 
                m.description, 
                m.instructor_id, 
                m.is_published, 
                m.category, 
                m.difficulty, 
                m.duration_hours, 
                m.price,
                u.firstname AS instructor_firstname, 
                u.lastname AS instructor_lastname
            FROM modules m
            JOIN users u ON m.instructor_id = u.id
            WHERE m.id = ?
        `;
        const [modules] = await pool.execute(query, [moduleId]);
        const module = modules[0];

        if (!module) {
            return res.status(404).json({ message: 'Module not found' });
        }

        // Authorization logic for module access
        if (req.user.role === 'learner') {
            // Check if learner is enrolled or if module is published
            const [enrollments] = await pool.execute('SELECT id FROM enrollments WHERE user_id = ? AND module_id = ?', [req.user.id, moduleId]);
            if (!module.is_published && enrollments.length === 0) {
                return res.status(403).json({ message: 'Access denied: Module not published and you are not enrolled.' });
            }
        } else if (req.user.role === 'lecturer' && module.instructor_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied: You are not the instructor for this module.' });
        }
        // Admin has full access

        res.status(200).json(module);
    } catch (err) {
        console.error('Error fetching module:', err);
        res.status(500).json({ message: 'Server error fetching module' });
    }
});

// @route   POST /api/modules
// @desc    Create a new module
// @access  Lecturer, Admin
app.post('/api/modules', authenticateToken, authorizeRole(['lecturer', 'admin']), async (req, res) => {
    const { module_name, description, instructor_id, is_published, category, difficulty, duration_hours, price } = req.body;

    if (!module_name || !description || !instructor_id) {
        return res.status(400).json({ message: 'Module name, description, and instructor ID are required' });
    }

    // If lecturer, ensure they are creating a module for themselves
    if (req.user.role === 'lecturer' && instructor_id !== req.user.id) {
        return res.status(403).json({ message: 'Lecturers can only create modules for themselves.' });
    }
    // If admin, check if the provided instructor_id belongs to a lecturer
    if (req.user.role === 'admin') {
        const [instructorCheck] = await pool.execute('SELECT id FROM users WHERE id = ? AND role = "lecturer"', [instructor_id]);
        if (instructorCheck.length === 0) {
            return res.status(400).json({ message: 'Instructor ID must belong to an existing lecturer.' });
        }
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO modules (module_name, description, instructor_id, is_published, category, difficulty, duration_hours, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [module_name, description, instructor_id, is_published, category, difficulty, duration_hours, price]
        );
        res.status(201).json({ message: 'Module created successfully', moduleId: result.insertId });
    } catch (err) {
        console.error('Error creating module:', err);
        res.status(500).json({ message: 'Server error creating module' });
    }
});

// @route   PUT /api/modules/:id
// @desc    Update a module
// @access  Lecturer (for their own modules), Admin
app.put('/api/modules/:id', authenticateToken, authorizeRole(['lecturer', 'admin']), async (req, res) => {
    const moduleId = req.params.id;
    const { module_name, description, instructor_id, is_published, category, difficulty, duration_hours, price } = req.body;

    try {
        const [existingModule] = await pool.execute('SELECT instructor_id FROM modules WHERE id = ?', [moduleId]);
        if (existingModule.length === 0) {
            return res.status(404).json({ message: 'Module not found' });
        }

        // Authorization: Lecturer can only update their own modules
        if (req.user.role === 'lecturer' && existingModule[0].instructor_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied: You are not authorized to update this module.' });
        }

        // If admin is changing instructor_id, ensure it's a valid lecturer
        if (req.user.role === 'admin' && instructor_id && instructor_id !== existingModule[0].instructor_id) {
            const [instructorCheck] = await pool.execute('SELECT id FROM users WHERE id = ? AND role = "lecturer"', [instructor_id]);
            if (instructorCheck.length === 0) {
                return res.status(400).json({ message: 'New instructor ID must belong to an existing lecturer.' });
            }
        }
        
        await pool.execute(
            `UPDATE modules SET 
                module_name = ?, 
                description = ?, 
                instructor_id = ?, 
                is_published = ?,
                category = ?,
                difficulty = ?,
                duration_hours = ?,
                price = ?
            WHERE id = ?`,
            [module_name, description, instructor_id, is_published, category, difficulty, duration_hours, price, moduleId]
        );
        res.status(200).json({ message: 'Module updated successfully' });
    } catch (err) {
        console.error('Error updating module:', err);
        res.status(500).json({ message: 'Server error updating module' });
    }
});

// @route   DELETE /api/modules/:id
// @desc    Delete a module
// @access  Lecturer (for their own modules), Admin
app.delete('/api/modules/:id', authenticateToken, authorizeRole(['lecturer', 'admin']), async (req, res) => {
    const moduleId = req.params.id;
    try {
        const [existingModule] = await pool.execute('SELECT instructor_id FROM modules WHERE id = ?', [moduleId]);
        if (existingModule.length === 0) {
            return res.status(404).json({ message: 'Module not found' });
        }

        // Authorization: Lecturer can only delete their own modules
        if (req.user.role === 'lecturer' && existingModule[0].instructor_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied: You are not authorized to delete this module.' });
        }

        // The database's CASCADE DELETE will handle associated content and enrollments
        const [result] = await pool.execute('DELETE FROM modules WHERE id = ?', [moduleId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Module not found' });
        }
        res.status(200).json({ message: 'Module deleted successfully' });
    } catch (err) {
        console.error('Error deleting module:', err);
        res.status(500).json({ message: 'Server error deleting module' });
    }
});


// --- Content Management Routes (Lecturer) ---

// @route   GET /api/modules/:moduleId/content
// @desc    Get all content for a specific module
// @access  Lecturer (for their own modules), Learner (if enrolled or module published)
app.get('/api/modules/:moduleId/content', authenticateToken, async (req, res) => {
    const moduleId = req.params.moduleId;
    try {
        const [module] = await pool.execute('SELECT instructor_id, is_published FROM modules WHERE id = ?', [moduleId]);
        if (module.length === 0) {
            return res.status(404).json({ message: 'Module not found' });
        }

        // Authorization:
        // - Lecturer can access their own module content (draft or published)
        // - Learner can access content if enrolled OR module is published
        // - Admin can access all
        if (req.user.role === 'lecturer' && module[0].instructor_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied: Not your module.' });
        }
        if (req.user.role === 'learner') {
            const [enrollment] = await pool.execute('SELECT id FROM enrollments WHERE user_id = ? AND module_id = ?', [req.user.id, moduleId]);
            if (!module[0].is_published && enrollment.length === 0) {
                return res.status(403).json({ message: 'Access denied: Module not published and you are not enrolled.' });
            }
        }

        // Join with user_content_progress to see if the current user completed content
        const [content] = await pool.execute(`
            SELECT 
                c.id, 
                c.module_id, 
                c.title, 
                c.content_type, 
                c.content_text, 
                c.file_path, 
                c.quiz_data,
                (CASE WHEN ucp.is_completed IS TRUE THEN TRUE ELSE FALSE END) AS user_completed_content
            FROM content c
            LEFT JOIN user_content_progress ucp ON c.id = ucp.content_id AND ucp.user_id = ?
            WHERE c.module_id = ?
            ORDER BY c.created_at ASC
        `, [req.user.id, moduleId]); // Pass req.user.id for the LEFT JOIN condition
        
        res.status(200).json(content);
    } catch (err) {
        console.error('Error fetching module content:', err);
        res.status(500).json({ message: 'Server error fetching module content' });
    }
});

// @route   POST /api/modules/:moduleId/content
// @desc    Add new content to a module
// @access  Lecturer (for their own modules), Admin
app.post('/api/modules/:moduleId/content', authenticateToken, authorizeRole(['lecturer', 'admin']), upload.single('materialFile'), async (req, res) => {
    const moduleId = req.params.moduleId;
    const { title, content_type, quiz_data } = req.body;
    // Fix: Ensure content_text is explicitly null if it's undefined or an empty string
    const content_text = req.body.content_text || null; 
    const file_path = req.file ? `/uploads/${req.file.filename}` : null;

    if (!title || !content_type) {
        // If it's a quiz, quiz_data is required instead of content_text/file
        if (content_type === 'Quizzes' && !quiz_data) {
            return res.status(400).json({ message: 'Quiz title and quiz data are required.' });
        } else if (content_type !== 'Quizzes' && !content_text && !file_path) {
            // Updated validation to use the corrected `content_text`
            return res.status(400).json({ message: 'Content title and either text or a file are required.' });
        }
        return res.status(400).json({ message: 'Title and content type are required.' });
    }

    try {
        const [module] = await pool.execute('SELECT instructor_id FROM modules WHERE id = ?', [moduleId]);
        if (module.length === 0) {
            return res.status(404).json({ message: 'Module not found' });
        }
        // Authorization: Lecturer can only add content to their own modules
        if (req.user.role === 'lecturer' && module[0].instructor_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied: Not authorized to add content to this module.' });
        }

        let parsedQuizData = null;
        if (content_type === 'Quizzes' && quiz_data) {
            try {
                parsedQuizData = JSON.parse(quiz_data); // quiz_data comes as a stringified JSON
                // Basic validation for quiz_data structure if needed
                if (!Array.isArray(parsedQuizData) || parsedQuizData.some(q => !q.question_text || !Array.isArray(q.options) || q.options.length === 0)) {
                    throw new Error('Invalid quiz data format.');
                }
            } catch (jsonErr) {
                // If parsing fails, remove the uploaded file if exists
                if (file_path) {
                    fs.unlinkSync(path.join(__dirname, file_path));
                }
                return res.status(400).json({ message: 'Invalid quiz data format. Must be a valid JSON array of questions.' });
            }
        }

        await pool.execute(
            'INSERT INTO content (module_id, title, content_type, content_text, file_path, quiz_data) VALUES (?, ?, ?, ?, ?, ?)',
            // Pass the corrected content_text variable here
            [moduleId, title, content_type, content_text, file_path, parsedQuizData ? JSON.stringify(parsedQuizData) : null] // Store quiz_data as JSON string
        );
        res.status(201).json({ message: 'Content added successfully' });
    } catch (err) {
        console.error('Error adding content:', err);
        // Clean up uploaded file if an error occurred after upload
        if (file_path && fs.existsSync(path.join(__dirname, file_path))) {
            fs.unlinkSync(path.join(__dirname, file_path));
        }
        res.status(500).json({ message: 'Server error adding content' });
    }
});

// @route   DELETE /api/content/:id
// @desc    Delete a content item
// @access  Lecturer (for their own module's content), Admin
app.delete('/api/content/:id', authenticateToken, authorizeRole(['lecturer', 'admin']), async (req, res) => {
    const contentId = req.params.id;
    try {
        const [content] = await pool.execute('SELECT module_id, file_path FROM content WHERE id = ?', [contentId]);
        if (content.length === 0) {
            return res.status(404).json({ message: 'Content not found' });
        }

        const moduleId = content[0].module_id;
        const [module] = await pool.execute('SELECT instructor_id FROM modules WHERE id = ?', [moduleId]);

        // Authorization: Lecturer can only delete content from their own modules
        if (req.user.role === 'lecturer' && module[0].instructor_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied: Not authorized to delete content from this module.' });
        }

        // Delete associated file if it exists
        if (content[0].file_path) {
            const filePath = path.join(__dirname, content[0].file_path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        const [result] = await pool.execute('DELETE FROM content WHERE id = ?', [contentId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Content not found' });
        }
        res.status(200).json({ message: 'Content deleted successfully' });
    } catch (err) {
        console.error('Error deleting content:', err);
        res.status(500).json({ message: 'Server error deleting content' });
    }
});


// --- Enrollment Routes (Learner) ---

// @route   POST /api/enroll
// @desc    Enroll a learner in a module
// @access  Learner
app.post('/api/enroll', authenticateToken, authorizeRole(['learner']), async (req, res) => {
    const { module_id } = req.body;
    const user_id = req.user.id;

    if (!module_id) {
        return res.status(400).json({ message: 'Module ID is required' });
    }

    try {
        // Check if module exists and is published
        const [module] = await pool.execute('SELECT id, is_published, price FROM modules WHERE id = ?', [module_id]);
        if (module.length === 0) {
            return res.status(404).json({ message: 'Module not found' });
        }
        if (!module[0].is_published) {
            return res.status(400).json({ message: 'Cannot enroll in an unpublished module.' });
        }
        if (module[0].price > 0) {
            return res.status(400).json({ message: 'This is a paid module. Payment integration is not yet implemented.' });
        }

        // Check if already enrolled
        const [existingEnrollment] = await pool.execute('SELECT id FROM enrollments WHERE user_id = ? AND module_id = ?', [user_id, module_id]);
        if (existingEnrollment.length > 0) {
            return res.status(400).json({ message: 'Already enrolled in this module' });
        }

        await pool.execute('INSERT INTO enrollments (user_id, module_id) VALUES (?, ?)', [user_id, module_id]);
        res.status(201).json({ message: 'Enrollment successful' });
    } catch (err) {
        console.error('Error during enrollment:', err);
        res.status(500).json({ message: 'Server error during enrollment' });
    }
});

// @route   GET /api/enrollments
// @desc    Get all modules a learner is enrolled in
// @access  Learner
app.get('/api/enrollments', authenticateToken, authorizeRole(['learner']), async (req, res) => {
    const user_id = req.user.id;
    try {
        // Select enrollments with module details
        const [enrollments] = await pool.execute(`
            SELECT 
                e.id, 
                e.module_id, 
                e.enrollment_date, 
                e.is_completed, 
                m.module_name, 
                m.description,
                m.price,
                u.firstname AS instructor_firstname,
                u.lastname AS instructor_lastname
            FROM enrollments e
            JOIN modules m ON e.module_id = m.id
            JOIN users u ON m.instructor_id = u.id
            WHERE e.user_id = ?
            ORDER BY e.enrollment_date DESC
        `, [user_id]);
        res.status(200).json(enrollments);
    } catch (err) {
        console.error('Error fetching enrollments:', err);
        res.status(500).json({ message: 'Server error fetching enrollments' });
    }
});

// @route   PUT /api/enrollments/:enrollmentId/complete
// @desc    Mark an enrollment as complete
// @access  Learner
app.put('/api/enrollments/:enrollmentId/complete', authenticateToken, authorizeRole(['learner']), async (req, res) => {
    const enrollmentId = req.params.enrollmentId;
    const user_id = req.user.id;
    try {
        const [enrollment] = await pool.execute('SELECT id FROM enrollments WHERE id = ? AND user_id = ?', [enrollmentId, user_id]);
        if (enrollment.length === 0) {
            return res.status(404).json({ message: 'Enrollment not found or not authorized' });
        }

        await pool.execute('UPDATE enrollments SET is_completed = TRUE, completed_date = CURRENT_TIMESTAMP WHERE id = ?', [enrollmentId]);
        res.status(200).json({ message: 'Enrollment marked as complete' });
    } catch (err) {
        console.error('Error marking enrollment complete:', err);
        res.status(500).json({ message: 'Server error marking enrollment complete' });
    }
});

// @route   POST /api/content/:contentId/complete
// @desc    Mark a content item as complete for the current user
// @access  Learner
app.post('/api/content/:contentId/complete', authenticateToken, authorizeRole(['learner']), async (req, res) => {
    const contentId = req.params.contentId;
    const user_id = req.user.id;

    try {
        // First, check if the content exists and belongs to a module the user is enrolled in.
        const [content] = await pool.execute('SELECT module_id FROM content WHERE id = ?', [contentId]);
        if (content.length === 0) {
            return res.status(404).json({ message: 'Content item not found.' });
        }

        const module_id = content[0].module_id;
        const [enrollment] = await pool.execute('SELECT id FROM enrollments WHERE user_id = ? AND module_id = ?', [user_id, module_id]);

        if (enrollment.length === 0) {
            return res.status(403).json({ message: 'You are not enrolled in the module this content belongs to.' });
        }

        // Check if already marked complete
        const [existingProgress] = await pool.execute(
            'SELECT id FROM user_content_progress WHERE user_id = ? AND content_id = ?',
            [user_id, contentId]
        );

        if (existingProgress.length === 0) {
            await pool.execute(
                'INSERT INTO user_content_progress (user_id, content_id, is_completed) VALUES (?, ?, TRUE)',
                [user_id, contentId]
            );
        } else {
             // Optionally update 'completed_at' if you want to reflect the latest completion time
             await pool.execute(
                 'UPDATE user_content_progress SET completed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND content_id = ?',
                 [user_id, contentId]
             );
        }

        res.status(200).json({ message: 'Content marked as complete successfully.' });
    } catch (err) {
        console.error('Error marking content complete:', err);
        res.status(500).json({ message: 'Server error marking content complete.' });
    }
});

// @route   GET /api/modules/:moduleId/learners
// @desc    Get all learners enrolled in a specific module (for lecturer/admin)
// @access  Lecturer (for their own modules), Admin
app.get('/api/modules/:moduleId/learners', authenticateToken, authorizeRole(['lecturer', 'admin']), async (req, res) => {
    const moduleId = req.params.moduleId;
    try {
        const [module] = await pool.execute('SELECT instructor_id FROM modules WHERE id = ?', [moduleId]);
        if (module.length === 0) {
            return res.status(404).json({ message: 'Module not found' });
        }

        // Authorization: Lecturer can only see learners for their own modules
        if (req.user.role === 'lecturer' && module[0].instructor_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied: Not authorized to view learners for this module.' });
        }

        const [learners] = await pool.execute(`
            SELECT 
                u.id, 
                u.firstname, 
                u.lastname, 
                u.email, 
                e.enrollment_date,
                u.is_active -- Assuming learner active status is relevant
            FROM users u
            JOIN enrollments e ON u.id = e.user_id
            WHERE e.module_id = ? AND u.role = 'learner'
            ORDER BY e.enrollment_date ASC
        `, [moduleId]);
        res.status(200).json(learners);
    } catch (err) {
        console.error('Error fetching enrolled learners:', err);
        res.status(500).json({ message: 'Server error fetching enrolled learners' });
    }
});


// --- Quiz Routes (Learner) ---

// @route   POST /api/quizzes/:contentId/submit
// @desc    Submit a quiz attempt
// @access  Learner
app.post('/api/quizzes/:contentId/submit', authenticateToken, authorizeRole(['learner']), async (req, res) => {
    const quizContentId = req.params.contentId;
    const user_id = req.user.id;
    const { answers } = req.body; // Array of submitted answers (indices)

    if (!Array.isArray(answers)) {
        return res.status(400).json({ message: 'Answers must be an array.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction(); // Start a transaction

        // 1. Get the quiz content to verify answers
        const [quizRows] = await connection.execute('SELECT module_id, quiz_data FROM content WHERE id = ? AND content_type = "Quizzes"', [quizContentId]);
        const quizContent = quizRows[0];

        if (!quizContent) {
            await connection.rollback();
            return res.status(404).json({ message: 'Quiz content not found or is not a quiz.' });
        }

        const quiz_data = JSON.parse(quizContent.quiz_data); // Parse stored JSON
        let correctAnswers = 0;
        const totalQuestions = quiz_data.length;

        // Compare submitted answers with correct answers
        for (let i = 0; i < totalQuestions; i++) {
            if (quiz_data[i] && quiz_data[i].correct_answer_index !== undefined && answers[i] !== undefined) {
                if (parseInt(answers[i]) === quiz_data[i].correct_answer_index) {
                    correctAnswers++;
                }
            } else {
                // If quiz_data or submitted answers are malformed/incomplete
                console.warn(`Quiz data or submitted answers for question ${i} is incomplete/malformed.`);
            }
        }

        const score = (correctAnswers / totalQuestions) * 100;

        // 2. Record the quiz attempt
        await connection.execute(
            'INSERT INTO user_quiz_attempts (user_id, quiz_content_id, score, submitted_answers) VALUES (?, ?, ?, ?)',
            [user_id, quizContentId, score.toFixed(2), JSON.stringify(answers)]
        );

        // 3. Mark the content as complete in user_content_progress if it's the first attempt or successful enough
        // We ensure a record exists. If user attempts multiple times, we only care about first completion for overall module progress.
        const [existingProgress] = await connection.execute(
            'SELECT id FROM user_content_progress WHERE user_id = ? AND content_id = ?',
            [user_id, quizContentId]
        );

        if (existingProgress.length === 0) {
            await connection.execute(
                'INSERT INTO user_content_progress (user_id, content_id, is_completed) VALUES (?, ?, TRUE)',
                [user_id, quizContentId]
            );
        } else {
             // Optionally update 'completed_at' if you want to reflect the latest completion time
             await connection.execute(
                 'UPDATE user_content_progress SET completed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND content_id = ?',
                 [user_id, quizContentId]
             );
        }

        await connection.commit(); // Commit the transaction
        res.status(200).json({ score, correctAnswers, totalQuestions, message: 'Quiz submitted successfully' });

    } catch (err) {
        if (connection) await connection.rollback(); // Rollback on error
        console.error('Error submitting quiz:', err);
        res.status(500).json({ message: 'Server error submitting quiz.' });
    } finally {
        if (connection) connection.release(); // Always release connection
    }
});

// @route   GET /api/quizzes/:contentId/attempts
// @desc    Get all attempts for a specific quiz by the current user
// @access  Learner
app.get('/api/quizzes/:contentId/attempts', authenticateToken, authorizeRole(['learner']), async (req, res) => {
    const quizContentId = req.params.contentId;
    const user_id = req.user.id;
    try {
        const [attempts] = await pool.execute(
            'SELECT id, score, attempt_date, submitted_answers FROM user_quiz_attempts WHERE user_id = ? AND quiz_content_id = ? ORDER BY attempt_date DESC',
            [user_id, quizContentId]
        );
        res.status(200).json(attempts);
    } catch (err) {
        console.error('Error fetching quiz attempts:', err);
        res.status(500).json({ message: 'Server error fetching quiz attempts' });
    }
});


// --- Admin Reports Routes ---
// @route   GET /api/admin/reports
// @desc    Get various system reports (enrollment stats, revenue, completion rates)
// @access  Admin
app.get('/api/admin/reports', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Enrollment Statistics (Total enrollments per module)
        const [enrollmentStats] = await connection.execute(`
            SELECT
                m.id AS module_id,
                m.module_name,
                COUNT(e.id) AS total_enrollments,
                SUM(CASE WHEN e.is_completed = TRUE THEN 1 ELSE 0 END) AS completed_enrollments,
                COUNT(DISTINCT e.user_id) AS total_learners
            FROM modules m
            LEFT JOIN enrollments e ON m.id = e.module_id
            GROUP BY m.id
            ORDER BY m.module_name;
        `);

        // 2. Module Completion Rates
        // This is largely derived from enrollmentStats, but we can make it explicit
        const moduleCompletionRates = enrollmentStats.map(module => ({
            module_id: module.module_id,
            module_name: module.module_name,
            total_enrollments: module.total_enrollments,
            completed_enrollments: module.completed_enrollments,
            completion_rate_percentage: module.total_enrollments > 0
                ? ((module.completed_enrollments / module.total_enrollments) * 100).toFixed(2)
                : '0.00'
        }));


        // 3. Revenue Reports (Mocked as payment integration isn't real)
        // In a real system, this would query a 'payments' or 'transactions' table.
        const revenueReports = [
            { period: 'Q1 2024', revenue: 12500.50, transactions: 250, details: 'Initial sales' },
            { period: 'Q2 2024', revenue: 18000.75, transactions: 380, details: 'Growth period' },
            { period: 'Q3 2024', revenue: 15000.00, transactions: 300, details: 'Steady sales' },
            { period: 'Total', revenue: 45501.25, transactions: 930, details: 'Overall revenue to date' }
        ];

        await connection.commit();

        res.status(200).json({
            enrollment: enrollmentStats,
            completion: moduleCompletionRates,
            revenue: revenueReports
        });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error fetching admin reports:', err);
        res.status(500).json({ message: 'Server error fetching reports' });
    } finally {
        if (connection) connection.release();
    }
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Reminder about JWT_SECRET for production
    if (process.env.JWT_SECRET === 'supersecretjwtkey' || !process.env.JWT_SECRET) {
        console.warn('!!! WARNING: Using default JWT_SECRET. Please change this in your .env file for production !!!');
    }
});
