// ============================================
// SECURITY & SESSION MANAGEMENT
// ============================================



// Security Configuration
const SECURITY_CONFIG = {
    SESSION_TIMEOUT: 60 * 60 * 1000, // 60 minutes
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/ // Min 8 chars, uppercase, lowercase, number, symbol
};

// Security State
let securityState = {
    failedLoginAttempts: 0,
    lastLoginAttempt: null,
    isLockedOut: false,
    sessionStartTime: null,
    lastActivityTime: null,
    inactivityTimer: null,
    warningShown: false
};

// ============================================
// DAILY STATS RESET SYSTEM
// ============================================

const STATS_RESET_KEY = 'last_stats_reset';
const DAILY_RESET_HOUR = 0; // Midnight

/**
 * Check and reset stats if 24 hours have passed
 */
function checkAndResetDailyStats() {
    const now = new Date();
    const lastReset = localStorage.getItem(STATS_RESET_KEY);
    
    if (!lastReset) {
        // First time - set initial reset time
        localStorage.setItem(STATS_RESET_KEY, now.toISOString());
        return;
    }
    
    const lastResetDate = new Date(lastReset);
    const timeSinceReset = now - lastResetDate;
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    // Check if 24 hours have passed since last reset
    if (timeSinceReset >= twentyFourHours) {
        resetDailyStats();
        localStorage.setItem(STATS_RESET_KEY, now.toISOString());
    }
}

/**
 * Reset daily stats (buy clicks, details clicks, etc.)
 */
function resetDailyStats() {
    console.log('Resetting daily stats...');
    
    // Reset the carAnalytics object for daily stats
    Object.keys(carAnalytics).forEach(carId => {
        if (carAnalytics[carId]) {
            carAnalytics[carId].daily_details_clicks = 0;
            carAnalytics[carId].daily_buy_clicks = 0;
        }
    });
    
    // Update the UI
    fetchDashboardStats();
    
    // Show notification
    showToast('Daily stats have been reset', 'info');
    
    // Log the reset action
    logAdminActivity('DAILY_STATS_RESET', {
        timestamp: new Date().toISOString()
    });
}

/**
 * Initialize daily stats reset system
 */
function initDailyStatsReset() {
    // Check on admin dashboard load
    checkAndResetDailyStats();
    
    // Check every hour to see if we need to reset
    setInterval(checkAndResetDailyStats, 60 * 60 * 1000); // Check every hour
}

/**
 * Log admin activity to database for audit trail
 */
async function logAdminActivity(action, details = {}) {
    try {
        await supabase
            .from('admin_logs')
            .insert({
                admin_id: currentAdminUser?.id,
                action: action,
                description: JSON.stringify(details),
                created_at: new Date().toISOString()
            });
    } catch (error) {
        console.error('Error logging admin activity:', error);
    }
}

/**
 * Validate password strength
 */
function validatePasswordStrength(password) {
    const errors = [];
    
    if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
        errors.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters`);
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain uppercase letters');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain lowercase letters');
    }
    if (!/\d/.test(password)) {
        errors.push('Password must contain numbers');
    }
    if (!/[@$!%*?&]/.test(password)) {
        errors.push('Password must contain special characters (@$!%*?&)');
    }
    
    return { isValid: errors.length === 0, errors };
}

/**
 * Check if admin is locked out due to failed attempts
 */
function isAdminLockedOut() {
    if (!securityState.isLockedOut) return false;
    
    const timeSinceLastAttempt = Date.now() - securityState.lastLoginAttempt;
    
    // Check if lockout duration has passed
    if (timeSinceLastAttempt > SECURITY_CONFIG.LOCKOUT_DURATION) {
        securityState.isLockedOut = false;
        securityState.failedLoginAttempts = 0;
        return false;
    }
    
    return true;
}

/**
 * Handle failed login attempt
 */
function handleFailedLoginAttempt() {
    securityState.failedLoginAttempts++;
    securityState.lastLoginAttempt = Date.now();
    
    if (securityState.failedLoginAttempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
        securityState.isLockedOut = true;
        logAdminActivity('FAILED_LOGINS', { 
            attempts: securityState.failedLoginAttempts,
            lockedOut: true 
        });
        return true; // Locked out
    }
    
    return false; // Not locked out yet
}

/**
 * Reset login attempts on successful login
 */
function resetLoginAttempts() {
    securityState.failedLoginAttempts = 0;
    securityState.isLockedOut = false;
    securityState.lastLoginAttempt = null;
}

/**
 * Setup session timeout and inactivity detection
 */
function setupSessionManagement() {
    clearSessionManagement(); // Prevent duplicate timers

    securityState.sessionStartTime = Date.now();
    securityState.lastActivityTime = Date.now();
    securityState.warningShown = false;
    
    createSessionWarningModal();

    // Timer UI Elements
    const timerDisplay = document.getElementById('sessionTimerDisplay');
    const timeText = document.getElementById('sessionTimeRemaining');
    const resetBtn = document.getElementById('resetSessionBtn');

    if (timerDisplay) timerDisplay.style.display = 'flex';

    // Manual Reset Button
    if (resetBtn) {
        resetBtn.onclick = function() {
            securityState.lastActivityTime = Date.now();
            securityState.warningShown = false;
            hideSessionWarning();
            showToast('Session timer reset', 'success');
            if (timeText) timeText.classList.remove('timer-warning');
        };
    }
    
    // Check for inactivity
    securityState.inactivityTimer = setInterval(() => {
        const inactiveTime = Date.now() - securityState.lastActivityTime;
        const timeLeft = SECURITY_CONFIG.SESSION_TIMEOUT - inactiveTime;
        const warningThreshold = 2 * 60 * 1000; // 2 minutes
        const redThreshold = 10 * 60 * 1000; // 10 minutes

        // Update Visual Timer
        if (timeText) {
            const totalSeconds = Math.max(0, Math.floor(timeLeft / 1000));
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            timeText.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            if (timeLeft <= redThreshold) {
                timeText.classList.add('timer-warning');
            } else {
                timeText.classList.remove('timer-warning');
            }
        }
        
        if (timeLeft <= 0) {
            hideSessionWarning();
            showToast('Session expired due to inactivity. Please log in again.', 'warning');
            handleLogout();
        } else if (timeLeft <= warningThreshold) {
            if (!securityState.warningShown) {
                showSessionWarning();
                securityState.warningShown = true;
            }
            updateSessionWarningTimer(timeLeft);
        }
    }, 1000); // Check every second for accurate countdown
}

/**
 * Update last activity time
 */
function updateLastActivity() {
    // Only update if warning is not shown
    if (!securityState.warningShown) {
        securityState.lastActivityTime = Date.now();
    }
}

function createSessionWarningModal() {
    if (document.getElementById('sessionWarningModal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'sessionWarningModal';
    modal.className = 'session-warning-modal';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="session-warning-content">
            <div class="session-warning-icon"><i class="fas fa-clock"></i></div>
            <h3>Session Expiring</h3>
            <p>Your session will expire in <span id="sessionCountdown">2:00</span> due to inactivity.</p>
            <div class="session-timer">
                <div class="session-progress" id="sessionProgress"></div>
            </div>
            <p>Do you want to stay logged in?</p>
            <button id="extendSessionBtn" class="btn btn-primary">Extend Session</button>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('extendSessionBtn').addEventListener('click', extendSession);
}

function showSessionWarning() {
    const modal = document.getElementById('sessionWarningModal');
    if (modal) modal.style.display = 'flex';
}

function hideSessionWarning() {
    const modal = document.getElementById('sessionWarningModal');
    if (modal) modal.style.display = 'none';
}

function extendSession() {
    securityState.lastActivityTime = Date.now();
    securityState.warningShown = false;
    hideSessionWarning();
    showToast('Session extended.', 'success');
}

/**
 * Clear session management
 */
function clearSessionManagement() {
    if (securityState.inactivityTimer) {
        clearInterval(securityState.inactivityTimer);
    }
}

function updateSessionWarningTimer(timeLeft) {
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    const countdownEl = document.getElementById('sessionCountdown');
    const progressEl = document.getElementById('sessionProgress');
    
    if (countdownEl) countdownEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    if (progressEl) {
        const percentage = (timeLeft / (2 * 60 * 1000)) * 100;
        progressEl.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    }
}

/**
 * Hash password with salt (client-side security layer)
 * Note: Always use HTTPS and server-side hashing in production!
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Admin dashboard functionality
let adminCars = [];
let currentEditingCar = null;
let uploadedCarImages = [];
let carAnalytics = {};
let currentAdminUser = null;
let clicksChart = null;
let statsData = {
    detailsClicks: 0,
    buyClicks: 0,
    totalViews: 0
};

// Toast notification function
function showToast(message, type = 'info', duration = 7000) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="toast-icon ${icons[type] || icons.info}"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close">&times;</button>
    `;
    
    // Close button functionality
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('exit');
        setTimeout(() => toast.remove(), 300);
    });
    
    toastContainer.appendChild(toast);
    
    // Auto-close after duration
    if (duration > 0) {
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('exit');
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }
}

// Show loading overlay
function showLoading(text = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    if (overlay) {
        overlay.classList.add('active');
        if (loadingText) loadingText.textContent = text;
    }
}

// Hide loading overlay
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// DOM Elements
const adminLoginSection = document.getElementById('adminLoginSection');
const adminDashboard = document.getElementById('adminDashboard');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminEmail = document.getElementById('adminEmail');
const adminPassword = document.getElementById('adminPassword');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const fabAddCarBtn = document.getElementById('fabAddCarBtn');
const backToTopBtn = document.getElementById('backToTopBtn');

const adminCarsTable = document.getElementById('adminCarsTable');
const adminLoading = document.getElementById('adminLoading');
const addCarBtn = document.getElementById('addCarBtn');
const carFormModal = document.getElementById('carFormModal');
const closeCarFormModal = document.getElementById('closeCarFormModal');
const cancelCarForm = document.getElementById('cancelCarForm');
const saveCarBtn = document.getElementById('saveCarBtn');
const carFormTitle = document.getElementById('carFormTitle');
const imageUploadArea = document.getElementById('imageUploadArea');
const carImagesInput = document.getElementById('carImages');
const uploadedImagesContainer = document.getElementById('uploadedImages');

// Mobile Navigation Elements
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const mobileSidebar = document.getElementById('mobileSidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarClose = document.getElementById('sidebarClose');
const addCarBtnMobile = document.getElementById('addCarBtnMobile');
const sidebarItems = document.querySelectorAll('.sidebar-item[data-view]');

// Stats Elements
const totalCars = document.getElementById('totalCars');
const availableCars = document.getElementById('availableCars');
const soldCars = document.getElementById('soldCars');
const detailsClicks = document.getElementById('detailsClicks');

const totalClicksToday = document.getElementById('totalClicksToday');
const inventoryValue = document.getElementById('inventoryValue');
const unreadMessagesCount = document.getElementById('unreadMessagesCount');
const unreadMessagesText = document.getElementById('unreadMessagesText');

// View Options
const viewOptions = document.querySelectorAll('.view-options button');
const carSearch = document.getElementById('carSearch');
const selectAll = document.getElementById('selectAll');
const bulkActions = document.getElementById('bulkActions');
const bulkDelete = document.getElementById('bulkDelete');
const bulkStatus = document.getElementById('bulkStatus');
const selectedCount = document.getElementById('selectedCount');

// Initialize admin functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    checkAdminAuthState();
    
    // Setup login form if on login page
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLogin);
    }

    
    // Setup logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});

// --- Car Details Modal Logic ---

// Event listener to open modal based on URL hash, BUT only on the correct page.
window.addEventListener('DOMContentLoaded', () => {
    // Only run this logic on the main admin page (admin.html)
    const path = window.location.pathname;
    if (path.endsWith('/admin.html') || path.endsWith('/admin/')) {
        const hash = window.location.hash;
        if (hash.startsWith('#view-car-')) {
            const carId = hash.substring('#view-car-'.length);
            showCarDetailsModal(carId);
        }
    }
});
// Check admin authentication state
async function checkAdminAuthState() {
    try {
        // Strict Session Check: If sessionStorage flag is missing, force logout
        // This ensures closing the tab/browser requires a fresh login
        if (!sessionStorage.getItem('admin_session_active')) {
            await window.supabase.auth.signOut();
            // Fall through to show login page
        }

        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            currentAdminUser = user;
            
            // Verify role in users table
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();
                
            if (profileError) {
                console.warn('Error checking admin role:', profileError.message);
            } else if (profile && profile.role !== 'admin') {
                console.warn(`User is authenticated but has role: ${profile.role}`);
                await window.supabase.auth.signOut();
                showToast('Access denied: Admin privileges required.', 'error');
                if (adminLoginSection) adminLoginSection.style.display = 'block';
                if (adminDashboard) adminDashboard.style.display = 'none';
                return;
            }

            // User is logged in, show dashboard and hide login
            if (adminLoginSection) adminLoginSection.style.display = 'none';
            if (adminDashboard) adminDashboard.style.display = 'block';

            // Show floating buttons
            if (fabAddCarBtn) fabAddCarBtn.style.display = '';
            if (backToTopBtn) backToTopBtn.style.display = '';
            
            // Initialize dashboard
            if (adminCarsTable) {
                loadAdminCars();
                setupAdminEventListeners();
                initializeEnhancedDashboard();
                setupSessionManagement();
            }
        } else {
            // No user logged in, show login page
            if (adminLoginSection) adminLoginSection.style.display = 'block';
            if (adminDashboard) adminDashboard.style.display = 'none';

            // Hide floating buttons
            if (fabAddCarBtn) fabAddCarBtn.style.display = 'none';
            if (backToTopBtn) backToTopBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking auth state:', error);
    }
}

// Handle admin login
async function handleAdminLogin(e) {
    e.preventDefault();
    
    const email = (adminEmail.value || '').trim();
    const password = (adminPassword.value || '');
    
    // Security: Check if admin is locked out
    if (isAdminLockedOut()) {
        const remainingTime = Math.ceil((SECURITY_CONFIG.LOCKOUT_DURATION - (Date.now() - securityState.lastLoginAttempt)) / 60000);
        showToast(`Too many failed attempts. Try again in ${remainingTime} minutes.`, 'error');
        loginError.textContent = `Account temporarily locked. Try again in ${remainingTime} minutes.`;
        return;
    }
    
    if (!email || !password) {
        showToast('Please enter both email and password.', 'warning');
        return;
    }
    
    // Security: Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address.', 'warning');
        return;
    }
    
    loginBtn.innerHTML = '<div class="spinner"></div> Authenticating...';
    loginBtn.disabled = true;
    loginError.textContent = '';
    
    try {
        console.debug('Attempting admin login for', email);
        const { data, error } = await window.supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            // Security: Log failed attempt
            handleFailedLoginAttempt();
            
            const isLocked = isAdminLockedOut();
            const attemptsLeft = SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - securityState.failedLoginAttempts;
            
            let errorMsg = error.message || 'Invalid email or password.';
            if (isLocked) {
                errorMsg = `Account locked. Too many failed attempts. Try again in 15 minutes.`;
            } else if (attemptsLeft > 0) {
                errorMsg += ` (${attemptsLeft} attempts remaining)`;
            }
            
            showToast(errorMsg, 'error');
            loginError.textContent = errorMsg;
            // Log error with some additional context for debugging
            console.error('Login error:', error);
            try {
                // If supabase client returned a more detailed response, log it
                console.debug('Supabase auth error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            } catch (e) {
                console.debug('Could not stringify auth error', e);
            }
            hideLoading();
            return;
        }
        
        if (data.user) {
            // Security: Reset login attempts on success
            resetLoginAttempts();
            
            // Set session flag for this tab only
            sessionStorage.setItem('admin_session_active', 'true');

            currentAdminUser = data.user;
            
            // Security: Log successful login
            logAdminActivity('ADMIN_LOGIN', { 
                email: email,
                timestamp: new Date().toISOString()
            });
            
            // Clear form
            adminEmail.value = '';
            adminPassword.value = '';
            loginError.textContent = '';
            
            showToast('✓ Authentication successful. Loading dashboard...', 'success');
            
            // Security: Setup session management
            setupSessionManagement();
            
            // Show dashboard
            if (adminLoginSection) adminLoginSection.style.display = 'none';
            if (adminDashboard) adminDashboard.style.display = 'block';

            // Show floating buttons
            if (fabAddCarBtn) fabAddCarBtn.style.display = '';
            if (backToTopBtn) backToTopBtn.style.display = '';
            
            // Initialize dashboard
            if (adminCarsTable) {
                loadAdminCars();
                setupAdminEventListeners();
                initializeEnhancedDashboard();
            }
        }
    } catch (error) {
        handleFailedLoginAttempt();
        showToast('An error occurred during authentication. Please try again.', 'error');
        console.error('Unexpected error:', error);
    } finally {
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        loginBtn.disabled = false;
        hideLoading();
    }
}

/**
 * Closes the Car Details modal and cleans up the URL.
 */
function closeCarDetailsModal() {
    const modal = document.getElementById('car-details-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
    // Clean up the URL hash to prevent re-opening on refresh
    if (window.location.hash.startsWith('#view-car-')) {
        history.pushState("", document.title, window.location.pathname + window.location.search);
    }
}

/**
 * Fetches car data and populates the details modal.
 * @param {string} carId The ID of the car to display.
 */
async function showCarDetailsModal(carId) {
    const modal = document.getElementById('car-details-modal');
    if (!modal) return;

    const modalContent = modal.querySelector('.modal-content-dynamic');
    modalContent.innerHTML = '<div class="modal-loader"></div>'; // Show loader inside modal

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
        // In a real app, you would fetch from your backend/API
        // const { data: car, error } = await supabase.from('cars').select('*').eq('id', carId).single();
        // if (error) throw error;

        // Using mock data for demonstration as the car list isn't available here.
        // This structure should match your actual car object.
        const car = {
            make: 'Tesla', model: 'Model S', year: 2022, price: 79990,
            meta: {
                description: 'A beautiful, high-performance electric sedan with long range and cutting-edge technology. This example is in pristine condition with low mileage.',
                mileage: 15000,
            },
            images: ['https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=60', 'https://images.unsplash.com/photo-1617808522942-6b995a0d6494?auto=format&fit=crop&w=800&q=60', 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=800&q=60']
        };

        // Populate modal with fetched data
        modalContent.innerHTML = `
            <div class="image-gallery">
                <img src="${car.images[0]}" alt="${car.make} ${car.model}" class="main-image">
                <div class="thumbnail-strip">
                    ${car.images.map(src => `<img src="${src}" alt="Thumbnail" class="thumbnail">`).join('')}
                </div>
            </div>
            <div class="car-info">
                <h2>${car.make} ${car.model}</h2>
                <p class="car-description">${car.meta.description}</p>
                <ul class="car-specs">
                    <li><strong>Year:</strong> ${car.year}</li>
                    <li><strong>Price:</strong> ${formatCurrency(car.price)}</li>
                    <li><strong>Mileage:</strong> ${car.meta.mileage.toLocaleString()} km</li>
                </ul>
            </div>
        `;
    } catch (error) {
        modalContent.innerHTML = `<p class="error-message">Failed to load car details. Please try again.</p>`;
        console.error('Error fetching car details:', error);
    }
}

// Handle logout
async function handleLogout() {
    try {
        showLoading('Logging out...');
        
        // Security: Log logout action
        logAdminActivity('ADMIN_LOGOUT', { 
            timestamp: new Date().toISOString(),
            sessionDuration: Date.now() - securityState.sessionStartTime
        });
        
        // Security: Clear session management
        clearSessionManagement();
        sessionStorage.removeItem('admin_session_active');
        
        const { error } = await supabase.auth.signOut();
        
        if (error) throw error;
        
        currentAdminUser = null;
        adminCars = [];
        carAnalytics = {};
        
        // Reset form
        adminEmail.value = '';
        adminPassword.value = '';
        loginError.textContent = '';
        
        showToast('✓ Logged out successfully!', 'success');
        
        // Show login page
        if (adminLoginSection) adminLoginSection.style.display = 'block';
        if (adminDashboard) adminDashboard.style.display = 'none';

        // Hide floating buttons
        if (fabAddCarBtn) fabAddCarBtn.style.display = 'none';
        if (backToTopBtn) backToTopBtn.style.display = 'none';
        
        // Redirect to home after 2 seconds
        setTimeout(() => {
            hideLoading();
            window.location.href = 'index.html';
        }, 1500);
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error during logout. Please try again.', 'error');
        hideLoading();
    }
}
window.handleLogout = handleLogout;

// Show login error
function showLoginError(message) {
    if (loginError) {
        loginError.textContent = message;
        loginError.style.display = 'block';
    }
}

// Set up admin event listeners
/**
 * Setup mobile menu interactions
 */
function setupMobileMenu() {
    // Re-fetch elements to ensure they exist
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileSidebar = document.getElementById('mobileSidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebarClose = document.getElementById('sidebarClose');
    const sidebarItems = document.querySelectorAll('.sidebar-item[data-view]');
    const addCarBtnMobile = document.getElementById('addCarBtnMobile');

    // Toggle mobile menu
    if (mobileMenuToggle) {
        mobileMenuToggle.onclick = function(e) {
            e.preventDefault();
            if (mobileSidebar) {
                mobileSidebar.classList.toggle('active');
            }
            if (sidebarOverlay) {
                sidebarOverlay.classList.toggle('active');
            }
        };
    }

    // Close sidebar on overlay click
    if (sidebarOverlay) {
        sidebarOverlay.onclick = closeMobileMenu;
    }

    // Close sidebar button
    if (sidebarClose) {
        sidebarClose.onclick = closeMobileMenu;
    }

    // Sidebar view filter buttons
    sidebarItems.forEach(item => {
        item.onclick = function() {
            const view = this.getAttribute('data-view');
            
            // Ensure we are on the cars view
            if (document.getElementById('carsView').style.display === 'none') {
                switchView('cars');
            }

            filterAdminCars(view);
            
            // Update active state on sidebar
            sidebarItems.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Update active state on top buttons
            viewOptions.forEach(btn => {
                if (btn.getAttribute('data-view') === view) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            
            closeMobileMenu();
        };
    });

    // Add car button on mobile sidebar
    if (addCarBtnMobile) {
        addCarBtnMobile.onclick = function() {
            openAddCarForm();
            closeMobileMenu();
        };
    }
}

/**
 * Close mobile menu
 */
function closeMobileMenu() {
    const mobileSidebar = document.getElementById('mobileSidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    
    if (mobileSidebar) {
        mobileSidebar.classList.remove('active');
    }
    if (sidebarOverlay) {
        sidebarOverlay.classList.remove('active');
    }
}
// Expose to window for HTML onclick handlers
window.closeMobileMenu = closeMobileMenu;

/**
 * Setup admin event listeners
 */
function setupAdminEventListeners() {
    // Mobile menu functionality
    setupMobileMenu();
    
    // Car form
    if (addCarBtn) {
        addCarBtn.addEventListener('click', openAddCarForm);
    }

    if (fabAddCarBtn) {
        fabAddCarBtn.addEventListener('click', openAddCarForm);
    }
    
    if (closeCarFormModal) {
        closeCarFormModal.addEventListener('click', closeCarForm);
    }
    
    if (cancelCarForm) {
        cancelCarForm.addEventListener('click', closeCarForm);
    }
    
    if (saveCarBtn) {
        saveCarBtn.addEventListener('click', saveCar);
    }
    
    // Price input formatting with thousand separators
    const priceInput = document.getElementById('carPrice');
    if (priceInput) {
        priceInput.addEventListener('input', function() {
            // Remove all non-digit characters
            let value = this.value.replace(/\D/g, '');
            
            // Add thousand separators
            if (value) {
                value = parseInt(value).toLocaleString('en-NG');
            }
            
            // Update the input
            this.value = value;
        });
    }
    
    // Image upload
    if (imageUploadArea) {
        // Use onclick to prevent duplicate listeners
        imageUploadArea.onclick = () => carImagesInput.click();
        
        // Drag and Drop functionality - Use on-events to prevent duplicates
        imageUploadArea.ondragenter = (e) => {
            e.preventDefault();
            e.stopPropagation();
            imageUploadArea.classList.add('drag-active');
        };

        imageUploadArea.ondragover = (e) => {
            e.preventDefault();
            e.stopPropagation();
            imageUploadArea.classList.add('drag-active');
        };

        imageUploadArea.ondragleave = (e) => {
            e.preventDefault();
            e.stopPropagation();
            imageUploadArea.classList.remove('drag-active');
        };

        imageUploadArea.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            imageUploadArea.classList.remove('drag-active');
            const dt = e.dataTransfer;
            const files = dt.files;
            processFiles(files);
        };
    }
    
    if (carImagesInput) {
        carImagesInput.onchange = handleImageUpload;
    }
    
    // View options
    viewOptions.forEach(button => {
        button.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            filterAdminCars(view);
            
            // Update active state
            viewOptions.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Search functionality
    if (carSearch) {
        carSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = adminCarsTable.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }

    // Select all checkbox
    if (selectAll) {
        selectAll.addEventListener('change', function() {
            const checkboxes = adminCarsTable.querySelectorAll('tbody input[type="checkbox"]');
            checkboxes.forEach(checkbox => checkbox.checked = this.checked);
            updateBulkActionsUI();
        });
    }

    // Bulk delete
    if (bulkDelete) {
        bulkDelete.addEventListener('click', bulkDeleteCars);
    }

    // Bulk status change
    if (bulkStatus) {
        bulkStatus.addEventListener('click', bulkChangeStatus);
    }

    // Confirmation Modal Listeners
    const closeConfirmationModalBtn = document.getElementById('closeConfirmationModal');
    const cancelConfirmationBtn = document.getElementById('cancelConfirmationBtn');
    if (closeConfirmationModalBtn) closeConfirmationModalBtn.addEventListener('click', closeConfirmationModal);
    if (cancelConfirmationBtn) cancelConfirmationBtn.addEventListener('click', closeConfirmationModal);

    // Manual stats reset button
    const resetStatsBtn = document.getElementById('resetStatsBtn');
    if (resetStatsBtn) {
        resetStatsBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to reset today\'s stats? This action cannot be undone.')) {
                resetDailyStats();
            }
        });
    }

    // Message Modal Listeners
    const closeMessageModalBtn = document.getElementById('closeMessageModal');
    const msgCloseBtn = document.getElementById('msgCloseBtn');
    const messageModal = document.getElementById('messageModal');

    if (closeMessageModalBtn) closeMessageModalBtn.onclick = () => messageModal.classList.remove('active');
    if (msgCloseBtn) msgCloseBtn.onclick = () => messageModal.classList.remove('active');

    // Track stats from cars.js
    trackRealTimeStats();
}

// ============================================
/**
 * Subscribes to real-time updates from the 'analytics' table.
 * This will update the dashboard live as users interact with the site.
 */
function subscribeToAnalytics() {
    console.log('Subscribing to real-time analytics updates...');

    const analyticsSubscription = supabase
        .channel('public:analytics')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'analytics' }, payload => {
            console.log('Real-time analytics event received:', payload.new);
            
            const { car_id, event_type } = payload.new;

            if (car_id && event_type) {
                // Ensure the car's analytics object exists
                if (!carAnalytics[car_id]) {
                    carAnalytics[car_id] = { 
                        details_clicks: 0, 
                        buy_clicks: 0,
                        daily_details_clicks: 0,
                        daily_buy_clicks: 0 
                    };
                }

                // Increment the correct stat
                if (event_type === 'view') {
                    carAnalytics[car_id].daily_details_clicks++;
                } else if (event_type === 'contact_click') {
                    carAnalytics[car_id].daily_buy_clicks++;
                }

                // Update the UI
                fetchDashboardStats();
                updateCarRowInTable(car_id);
                showToast(`New ${event_type.replace('_', ' ')} on a car!`, 'info');
            }
        })
        .subscribe();
}

/**
 * Subscribes to real-time updates from the 'messages' table.
 */
function subscribeToMessages() {
    console.log('Subscribing to real-time message updates...');
    
    supabase
        .channel('public:messages')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
            fetchDashboardStats(); // Update counts and badge
            
            // If currently viewing messages, refresh the list
            const messagesView = document.getElementById('messagesView');
            if (messagesView && messagesView.style.display !== 'none') {
                loadMessages();
            }
            
            if (payload.eventType === 'INSERT') {
                showToast('New message received!', 'info');
            }
        })
        .subscribe();
}

/**
 * Fetches and updates the main dashboard statistics cards with real data from the database.
 */
async function fetchDashboardStats() {
    console.log("Fetching dashboard stats from database...");
    try {
        // 1. Fetch car counts and inventory value
        const { data: carStats, error: carStatsError } = await supabase
            .from('cars')
            .select('status, price, created_at', { count: 'exact' });

        if (carStatsError) throw carStatsError;

        const totalCarCount = carStats.length;
        const availableCarCount = carStats.filter(c => c.status === 'available').length;
        const soldCarCount = carStats.filter(c => c.status === 'sold').length;
        const totalValue = carStats.reduce((sum, car) => sum + (car.price || 0), 0);

        // Calculate average inventory age for available cars
        const availableCarsForAge = carStats.filter(c => c.status === 'available');
        let avgAge = 0;
        if (availableCarsForAge.length > 0) {
            const now = new Date();
            const totalAgeInDays = availableCarsForAge.reduce((sum, car) => {
                return sum + (now - new Date(car.created_at)) / (1000 * 60 * 60 * 24);
            }, 0);
            avgAge = totalAgeInDays / availableCarsForAge.length;
        }

        // 2. Fetch analytics counts for today
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        const isoToday = today.toISOString();

        const { data: analyticsStats, error: analyticsError } = await supabase
            .from('analytics')
            .select('event_type')
            .gte('created_at', isoToday);

        if (analyticsError) throw analyticsError;

        const totalDetailsClicks = analyticsStats.filter(e => e.event_type === 'view').length;
        const totalBuyClicks = analyticsStats.filter(e => e.event_type === 'contact_click').length;

        // 3. Update the UI
        if (totalCars) totalCars.textContent = totalCarCount;
        if (availableCars) availableCars.textContent = availableCarCount;
        if (soldCars) soldCars.textContent = soldCarCount;
        if (inventoryValue) inventoryValue.textContent = formatCurrency(totalValue);
        if (averageInventoryAge) averageInventoryAge.textContent = `${avgAge.toFixed(1)} Days`;

        // 4. Update clicks and fetch unread messages
        if (detailsClicks) detailsClicks.textContent = totalDetailsClicks;

        // Fetch unread messages count
        const { count: unreadCount, error: messagesError } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('is_read', false);

        if (!messagesError) {
            if (unreadMessagesCount) unreadMessagesCount.textContent = unreadCount;
            if (unreadMessagesText) {
                unreadMessagesText.textContent = unreadCount > 0 
                    ? `${unreadCount} awaiting reply` 
                    : 'All caught up';
            }
            
            // Update notification badge
            const messagesBadge = document.getElementById('messagesBadge');
            if (messagesBadge) {
                if (unreadCount > 0) {
                    messagesBadge.classList.add('active');
                } else {
                    messagesBadge.classList.remove('active');
                }
            }
        }

        console.log("Dashboard stats updated successfully.");
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        showToast('Could not load dashboard stats.', 'error');
    }
}

// ============================================
// REAL-TIME STATS TRACKING
// ============================================

/**
 * Track real-time stats from user interactions - FIXED
 */
function trackRealTimeStats() {
    console.log("Attaching real-time analytics listeners...");
    
    // Remove any existing listeners to prevent duplicates
    window.removeEventListener('carViewTracked', handleCarViewTracked);
    
    // Add new listeners
    window.addEventListener('carViewTracked', handleCarViewTracked);
    
    console.log("Real-time analytics listeners attached successfully");
}

/**
 * Handle car view tracking events - FIXED VERSION
 */
function handleCarViewTracked(event) {
    const carId = event.detail?.carId;
    console.log('Car view tracked event received:', carId, event.detail);
    
    if (carId) {
        // Initialize analytics object if it doesn't exist
        if (!carAnalytics[carId]) {
            carAnalytics[carId] = { 
                details_clicks: 0, 
                buy_clicks: 0,
                daily_details_clicks: 0,
                daily_buy_clicks: 0 
            };
        }
        
        // Increment both total and daily stats for DETAILS CLICKS
        carAnalytics[carId].details_clicks++;
        carAnalytics[carId].daily_details_clicks++;
        
        // Update the UI
        fetchDashboardStats();
        updateCarRowInTable(carId);
        
        console.log(`Details click tracked for car ${carId}:`, carAnalytics[carId]);
    }
}

/**
 * Toggle dashboard skeleton loader
 */
function toggleDashboardSkeleton(show) {
    const skeleton = document.getElementById('dashboardSkeleton');
    const carsView = document.getElementById('carsView');
    
    if (!skeleton || !carsView) return;
    
    if (show) {
        skeleton.style.display = 'block';
        carsView.style.display = 'none';
    } else {
        skeleton.style.display = 'none';
        carsView.style.display = 'block';
    }
}

// Update the loadAdminCars function to include analytics loading
async function loadAdminCars() {
    toggleDashboardSkeleton(true);
    carAnalytics = {}; // Reset in-memory analytics

    try {
        // 1. Fetch all cars
        const { data: carsData, error: carsError } = await supabase
            .from('cars')
            .select('*, details_clicks, buy_clicks') // Explicitly select the click columns
            .order('created_at', { ascending: false });

        if (carsError) throw carsError;
        adminCars = carsData || [];

        // 2. Initialize analytics object for all cars to ensure they appear in the table
        adminCars.forEach(car => {
            if (!carAnalytics[car.id]) {
                carAnalytics[car.id] = { 
                    // Initialize with lifetime clicks from the car table
                    details_clicks: car.details_clicks || 0,
                    buy_clicks: car.buy_clicks || 0,
                    daily_details_clicks: 0,
                    daily_buy_clicks: 0 
                };
            }
        });

        renderAdminCarsTable(adminCars);

        // Hide the inline loader once cars are loaded
        if (adminLoading) adminLoading.style.display = 'none';

        // 3. Fetch today's analytics from the database
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isoToday = today.toISOString();

        const { data: analyticsData, error: analyticsError } = await supabase
            .from('analytics')
            .select('car_id, event_type')
            .gte('created_at', isoToday);

        if (analyticsError) throw analyticsError;

        // 4. Process analytics data and populate the carAnalytics object
        analyticsData.forEach(event => {
            const { car_id, event_type } = event;
            if (carAnalytics[car_id]) {
                if (event_type === 'view') {
                    carAnalytics[car_id].daily_details_clicks++;
                } else if (event_type === 'contact_click') {
                    carAnalytics[car_id].daily_buy_clicks++;
                }
            }
        });

        // 5. Finalize Dashboard Setup in Correct Order
        renderAdminCarsTable(adminCars); // Render table with all data
        fetchDashboardStats();           // Fetch and update main stat cards
        renderClicksChart();             // Render the analytics chart

        // 6. Initialize Background Processes
        trackRealTimeStats();    // Listen for events from cars.js
        initDailyStatsReset();   // Setup the daily stat reset timer
        subscribeToAnalytics();  // Subscribe to real-time database changes
        subscribeToMessages();   // Subscribe to real-time message updates

        toggleDashboardSkeleton(false);
        showToast('Dashboard loaded successfully!', 'success');
    } catch (error) {
        console.error('Error loading admin cars:', error);
        showToast('Error loading cars. Please refresh the page.', 'error');
        toggleDashboardSkeleton(false);
        if (adminLoading) adminLoading.style.display = 'none';
    }
}

// Render admin cars table
function renderAdminCarsTable(cars) {
    if (!adminCarsTable) return;
    
    if (cars.length === 0) {
        adminCarsTable.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 3rem;">
                    <i class="fas fa-car" style="font-size: 3rem; margin-bottom: 1rem; color: var(--secondary);"></i>
                    <h3>No cars found</h3>
                    <p>Get started by adding your first car to the inventory.</p>
                    <button class="btn btn-primary" onclick="openAddCarForm()">
                        <i class="fas fa-plus"></i> Add Your First Car
                    </button>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    
    cars.forEach(car => {
        const mainImage = car.images && car.images.length > 0 ? car.images[0] : 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80';
        const statusClass = car.status === 'available' ? 'status-available' : 'status-sold';
        const statusText = car.status === 'available' ? 'Available' : 'Sold';
        
        const analytics = carAnalytics[car.id] || { 
            details_clicks: 0, // lifetime
            buy_clicks: 0, // lifetime
            daily_details_clicks: 0,
            daily_buy_clicks: 0 
        };
        
        // Use daily stats for display
        const detailsClicksCount = analytics.daily_details_clicks;
        const buyClicksCount = analytics.daily_buy_clicks;
        const lifetimeBuyClicks = analytics.buy_clicks; // Get lifetime clicks
        
        html += `
            <tr>
                <td>
                    <!-- The value here should be the car's ID -->
                    <input type="checkbox" value="${car.id}" onchange="updateBulkActionsUI()">
                </td>
                <td>
                    <img src="${mainImage}" alt="${car.make} ${car.model}" 
                         style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px;">
                </td>
                <td>
                    <strong>${car.make} ${car.model}</strong>
                    <br>
                    <small style="color: var(--secondary);">${car.meta.category}</small>
                </td>
                <td>${car.year}</td>
                <td>${formatCurrency(car.price)}</td>
                <td class="${statusClass}">${statusText}</td>
                <td>
                    <span class="stat-bubble-daily" title="Today's Views">${detailsClicksCount}</span>
                </td>
                <td>
                    <span class="stat-bubble-daily" title="Today's Buy Clicks">${buyClicksCount}</span>
                    <span class="stat-bubble-lifetime" title="Lifetime Buy Clicks">${lifetimeBuyClicks}</span></td>
                <td>${formatDate(car.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-edit btn-sm edit-car" data-id="${car.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-delete btn-sm delete-car" data-id="${car.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    adminCarsTable.innerHTML = html;
    
    // Add event listeners to edit and delete buttons
    document.querySelectorAll('.edit-car').forEach(button => {
        button.addEventListener('click', function() {
            const carId = this.getAttribute('data-id');
            openEditCarForm(carId);
        });
    });
    
    document.querySelectorAll('.delete-car').forEach(button => {
        button.addEventListener('click', function() {
            const carId = this.getAttribute('data-id');
            deleteCar(carId);
        });
    });
}

/**
 * Updates a single car's row in the admin table with the latest analytics.
 * This avoids re-rendering the entire table for a small change.
 * @param {string | number} carId The ID of the car to update.
 */
function updateCarRowInTable(carId) {
    const row = adminCarsTable.querySelector(`input[value="${carId}"]`)?.closest('tr');
    if (!row) return;

    const analytics = carAnalytics[carId] || { 
        details_clicks: 0,
        buy_clicks: 0,
        daily_details_clicks: 0,
        daily_buy_clicks: 0 
    };

    // Use daily stats for display
    const detailsClicksCount = analytics.daily_details_clicks;
    const buyClicksCount = analytics.daily_buy_clicks;
    const lifetimeBuyClicks = analytics.buy_clicks;

    // Find the specific cells to update
    const detailsClicksCell = row.children[6]; // 7th column
    const buyClicksCell = row.children[7];     // 8th column

    if (detailsClicksCell) {
        detailsClicksCell.innerHTML = `<span class="stat-bubble-daily" title="Today's Views">${detailsClicksCount}</span>`;
    }

    if (buyClicksCell) {
        buyClicksCell.innerHTML = `
            <span class="stat-bubble-daily" title="Today's Buy Clicks">${buyClicksCount}</span>
            <span class="stat-bubble-lifetime" title="Lifetime Buy Clicks">${lifetimeBuyClicks}</span>`;
    }
}

// Filter admin cars by status
function filterAdminCars(status) {
    let filteredCars = adminCars;
    
    if (status === 'available') {
        filteredCars = adminCars.filter(car => car.status === 'available');
    } else if (status === 'sold') {
        filteredCars = adminCars.filter(car => car.status === 'sold');
    }
    
    renderAdminCarsTable(filteredCars);
}

// Open add car form
function openAddCarForm() {
    currentEditingCar = null;
    carFormTitle.textContent = 'Add New Car';
    resetCarForm();
    carFormModal.classList.add('active');
}

// Open edit car form
async function openEditCarForm(carId) {
    try {
        const { data, error } = await supabase
            .from('cars')
            .select('*')
            .eq('id', carId)
            .single();
        
        if (error) throw error;
        
        currentEditingCar = data;
        carFormTitle.textContent = `Edit ${data.make} ${data.model}`;
        populateCarForm(data);
        carFormModal.classList.add('active');
    } catch (error) {
        console.error('Error loading car for edit:', error);
        alert('Error loading car details. Please try again.');
    }
}

// Close car form modal
function closeCarForm() {
    carFormModal.classList.remove('active');
    resetCarForm();
}

// Reset car form
function resetCarForm() {
    document.getElementById('carMake').value = '';
    document.getElementById('carModel').value = '';
    document.getElementById('carYear').value = '';
    document.getElementById('carPrice').value = '';
    document.getElementById('carCategory').value = 'Sedan';
    document.getElementById('carFuelType').value = 'Gasoline';
    document.getElementById('carTransmission').value = 'Automatic';
    document.getElementById('carMileage').value = '';
    document.getElementById('carSeats').value = '5';
    document.getElementById('carStatus').value = 'available';
    document.getElementById('carDescription').value = '';
    document.getElementById('carFeatures').value = '';
    uploadedCarImages = [];
    
    if (uploadedImagesContainer) {
        uploadedImagesContainer.innerHTML = '';
    }
}

// Populate car form with existing data
function populateCarForm(car) {
    document.getElementById('carMake').value = car.make;
    document.getElementById('carModel').value = car.model;
    document.getElementById('carYear').value = car.year;
    // Format price with thousand separators
    const formattedPrice = car.price.toLocaleString('en-NG');
    document.getElementById('carPrice').value = formattedPrice;
    document.getElementById('carCategory').value = car.meta.category;
    document.getElementById('carFuelType').value = car.meta.fuelType;
    document.getElementById('carTransmission').value = car.meta.transmission;
    document.getElementById('carMileage').value = car.meta.mileage;
    document.getElementById('carSeats').value = car.meta.seats;
    document.getElementById('carStatus').value = car.status;
    document.getElementById('carDescription').value = car.meta.description || '';
    document.getElementById('carFeatures').value = car.meta.features ? car.meta.features.join(', ') : '';
    
    // Handle images
    uploadedCarImages = car.images || [];
    renderUploadedImages();
}

// Handle image upload
function handleImageUpload(event) {
    const files = event.target.files;
    processFiles(files);
    // Reset the file input
    carImagesInput.value = '';
}

function processFiles(files) {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            showToast('Please upload only image files.', 'warning');
            continue;
        }
        
        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image size should be less than 5MB.', 'warning');
            continue;
        }
        
        // Create a preview
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedCarImages.push(e.target.result);
            renderUploadedImages();
        };
        reader.readAsDataURL(file);
    }
}

// Render uploaded images
function renderUploadedImages() {
    if (!uploadedImagesContainer) return;
    
    uploadedImagesContainer.innerHTML = '';
    
    uploadedCarImages.forEach((image, index) => {
        const imageDiv = document.createElement('div');
        imageDiv.className = 'uploaded-image';
        
        imageDiv.innerHTML = `
            <img src="${image}" alt="Car image ${index + 1}">
            <button class="remove-image" data-index="${index}">&times;</button>
        `;
        
        uploadedImagesContainer.appendChild(imageDiv);
    });
    
    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-image').forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            uploadedCarImages.splice(index, 1);
            renderUploadedImages();
        });
    });
}

// Save car (add or update) - FIXED VERSION
async function saveCar() {
    // Validate form
    const make = document.getElementById('carMake').value.trim();
    const model = document.getElementById('carModel').value.trim();
    const year = parseInt(document.getElementById('carYear').value);
    const priceInput = document.getElementById('carPrice').value.replace(/,/g, ''); // Remove commas
    const price = parseFloat(priceInput);
    const category = document.getElementById('carCategory').value;
    const fuelType = document.getElementById('carFuelType').value;
    const transmission = document.getElementById('carTransmission').value;
    const mileage = parseInt(document.getElementById('carMileage').value);
    const seats = parseInt(document.getElementById('carSeats').value);
    const status = document.getElementById('carStatus').value;
    const description = document.getElementById('carDescription').value.trim();
    const features = document.getElementById('carFeatures').value
        .split(',')
        .map(f => f.trim());
    
    // Validation
    if (!make || !model || !year || !price || !mileage || !seats) {
        showToast('Please fill in all required fields.', 'warning');
        return;
    }
    
    if (year < 1990 || year > new Date().getFullYear()) {
        showToast('Please enter a valid year.', 'error');
        return;
    }
    
    if (price <= 0) {
        showToast('Please enter a valid price.', 'error');
        return;
    }
    
    if (mileage < 0) {
        showToast('Please enter a valid mileage.', 'error');
        return;
    }
    
    if (seats < 2 || seats > 9) {
        showToast('Please enter a valid number of seats (2-9).', 'error');
        return;
    }
    
    if (uploadedCarImages.length === 0) {
        showToast('Please upload at least one car image.', 'warning');
        return;
    }
    
    // Prepare car data - REMOVED price limit
    const carData = {
        make,
        model,
        year,
        price: price, // No artificial limit - let database handle it
        status,
        images: uploadedCarImages,
        meta: {
            category,
            fuelType,
            transmission,
            mileage,
            seats,
            features,
            description
        },
        updated_at: new Date().toISOString()
    };
    
    saveCarBtn.innerHTML = '<div class="spinner"></div> Saving...';
    saveCarBtn.disabled = true;
    showLoading(currentEditingCar ? 'Updating car...' : 'Adding car...');
    
    try {
        if (currentEditingCar) {
            // Update existing car
            const { error } = await supabase
                .from('cars')
                .update(carData)
                .eq('id', currentEditingCar.id);
            
            if (error) throw error;
            
            // Security: Log the update action
            logAdminActivity('CAR_UPDATED', {
                car_id: currentEditingCar.id,
                make,
                model,
                changes: { old: currentEditingCar, new: carData }
            });
            
            showToast(`${currentEditingCar.make} ${currentEditingCar.model} updated successfully!`, 'success');
        } else {
            // Add new car
            carData.created_at = new Date().toISOString();
            carData.is_deleted = false;
            
            const { error } = await supabase
                .from('cars')
                .insert([carData]);
            
            if (error) throw error;
            
            // Security: Log the new car addition
            logAdminActivity('CAR_ADDED', {
                make,
                model,
                year,
                price,
                timestamp: new Date().toISOString()
            });
            
            showToast(`${make} ${model} added successfully!`, 'success');
        }
        
        closeCarForm();
        loadAdminCars();
    } catch (error) {
        console.error('Error saving car:', error);
        
        // FIXED: Better error handling that suggests database modification
        if (error.code === '22003') {
            showToast('Database error: Price field needs adjustment. Please contact support to modify the price column in the database.', 'error');
        } else if (error.code === '42501') {
            showToast('Permission denied: Please run the SQL fix provided to update database policies.', 'error');
        } else if (error.code === '23505') {
            showToast('A car with these details already exists.', 'error');
        } else {
            showToast('Error saving car. Please try again.', 'error');
        }
    } finally {
        saveCarBtn.innerHTML = '<i class="fas fa-save"></i> Save Car';
        saveCarBtn.disabled = false;
        hideLoading();
    }
}

// --- Confirmation Modal Logic ---

function showConfirmationModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmationModal');
    const titleEl = document.getElementById('confirmationTitle');
    const messageEl = document.getElementById('confirmationMessage');
    const confirmBtn = document.getElementById('confirmActionBtn');

    if (!modal || !titleEl || !messageEl || !confirmBtn) return;

    titleEl.textContent = title;
    messageEl.innerHTML = message; // Use innerHTML to allow for strong tags

    // Clone and replace the button to remove old event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.onclick = () => {
        onConfirm();
        closeConfirmationModal();
    };

    modal.classList.add('active');
}

function closeConfirmationModal() {
    const modal = document.getElementById('confirmationModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Delete car (hard delete)
async function deleteCar(carId) {
    const car = adminCars.find(c => c.id == carId);
    if (!car) {
        showToast('Car not found.', 'error');
        return;
    }
    
    const message = `Are you sure you want to permanently delete the <strong>${car.year} ${car.make} ${car.model}</strong>? This action cannot be undone.`;

    showConfirmationModal('Confirm Deletion', message, async () => {
        showLoading('Deleting car...');
        try {
            const { error } = await supabase
                .from('cars')
                .delete()
                .eq('id', carId);

            if (error) throw error;

            logAdminActivity('CAR_DELETED', { car_id: carId, make: car.make, model: car.model });
            showToast('Car deleted successfully!', 'success');
            await loadAdminCars();

        } catch (error) {
            console.error('Error deleting car:', error);
            showToast('Error deleting car. Please try again.', 'error');
        } finally {
            hideLoading();
        }
    });
}

// Show admin error
function showAdminError(message) {
    if (adminCarsTable) {
        adminCarsTable.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 3rem; color: var(--danger);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <h3>Error</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="loadAdminCars()">Try Again</button>
                </td>
            </tr>
        `;
    }
}

// Update bulk actions UI
function updateBulkActionsUI() {
    const checkboxes = adminCarsTable.querySelectorAll('tbody input[type="checkbox"]');
    const selectedCheckboxes = adminCarsTable.querySelectorAll('tbody input[type="checkbox"]:checked');
    const selectAllCheckbox = selectAll;
    
    if (selectedCheckboxes.length > 0) {
        bulkActions.style.display = 'flex';
        selectedCount.textContent = `${selectedCheckboxes.length} items selected`;
    } else {
        bulkActions.style.display = 'none';
    }
    
    // Update select all checkbox state
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = selectedCheckboxes.length === checkboxes.length && checkboxes.length > 0;
    }
}

// Bulk delete cars
async function bulkDeleteCars() {
    const selectedCheckboxes = adminCarsTable.querySelectorAll('tbody input[type="checkbox"]:checked');
    if (selectedCheckboxes.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedCheckboxes.length} car(s)? This action cannot be undone.`)) {
        return;
    }
    
    showLoading(`Deleting ${selectedCheckboxes.length} cars...`);
    
    try {
        const carIds = Array.from(selectedCheckboxes).map(cb => cb.value);
        
        for (const carId of carIds) {
            await supabase
                .from('cars')
                .delete()
                .eq('id', carId);
        }
        
        showToast(`${carIds.length} car(s) deleted successfully!`, 'success');
        loadAdminCars();
    } catch (error) {
        console.error('Error deleting cars:', error);
        showToast('Error deleting cars. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Bulk change status
async function bulkChangeStatus() {
    const selectedCheckboxes = adminCarsTable.querySelectorAll('tbody input[type="checkbox"]:checked');
    if (selectedCheckboxes.length === 0) return;
    
    const newStatus = prompt('Enter new status (available/sold):', 'available');
    if (!newStatus || !['available', 'sold'].includes(newStatus)) {
        showToast('Invalid status. Please enter available or sold.', 'warning');
        return;
    }
    
    showLoading(`Updating ${selectedCheckboxes.length} car(s)...`);
    
    try {
        const carIds = Array.from(selectedCheckboxes).map(cb => cb.value);
        
        for (const carId of carIds) {
            await supabase
                .from('cars')
                .update({ status: newStatus })
                .eq('id', carId);
        }
        
        showToast(`${carIds.length} car(s) status updated to ${newStatus}!`, 'success');
        loadAdminCars();
    } catch (error) {
        console.error('Error updating status:', error);
        showToast('Error updating status. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}







// ============================================
// ENHANCED CHART RENDERING & CONTROLS
// ============================================

let currentChartRange = '7d';

/**
 * Enhanced chart rendering with better visual feedback
 */
async function renderClicksChart(range = '7d') {
    try {
        currentChartRange = range;
        console.log(`Fetching chart data for ${range}...`);
        
        const { data, error } = await fetchChartData(range);
        if (error) throw error;

        const canvas = document.getElementById('clicksOverTimeChart');
        if (!canvas) {
            console.warn("Chart canvas not found.");
            return;
        }
        
        const ctx = canvas.getContext('2d');

        // Destroy existing chart
        if (clicksChart) {
            clicksChart.destroy();
        }

        // Show loading state
        canvas.parentElement.classList.add('loading-pulse');

        // Create enhanced chart
        clicksChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Details Clicks',
                    data: data.detailsClicks,
                    borderColor: '#0ea5a4',
                    backgroundColor: 'rgba(14, 165, 164, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#0ea5a4',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4,
                    cubicInterpolationMode: 'monotone',
                    segment: {
                        borderColor: ctx => {
                            return ctx.p1.parsed.y > ctx.p0.parsed.y ? '#0ea5a4' : '#ef4444';
                        }
                    }
                }, {
                    label: 'Buy Clicks',
                    data: data.buyClicks,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#10b981',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4,
                    cubicInterpolationMode: 'monotone',
                    segment: {
                        borderColor: ctx => {
                            return ctx.p1.parsed.y > ctx.p0.parsed.y ? '#10b981' : '#ef4444';
                        }
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 750,
                    easing: 'easeOutQuart'
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#94a3b8',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 12,
                        boxPadding: 6,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            maxRotation: 0
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            stepSize: 1,
                            callback: function(value) {
                                return value === 0 ? '0' : value;
                            }
                        }
                    }
                },
                elements: {
                    line: {
                        tension: 0.4
                    }
                }
            }
        });

        // Remove loading state
        canvas.parentElement.classList.remove('loading-pulse');
        
        // Update time range buttons active state
        updateTimeRangeButtons(range);
        
        // Update last update time
        updateLastUpdateTime();
        
        console.log("Enhanced chart rendered successfully.");
    } catch (error) {
        console.error('Error rendering enhanced chart:', error);
        showToast('Could not load chart data.', 'error');
    }
}

/**
 * Fetch chart data with different time ranges
 */
async function fetchChartData(range = '7d') {
    let days;
    switch(range) {
        case '30d':
            days = 30;
            break;
        case '90d':
            days = 90;
            break;
        case '1y':
            days = 365;
            break;
        default:
            days = 7;
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    return supabase
        .rpc('get_daily_clicks', { start_date: startDate.toISOString() });
}

/**
 * Update time range button states
 */
function updateTimeRangeButtons(activeRange) {
    const buttons = document.querySelectorAll('.time-range-btn');
    buttons.forEach(button => {
        if (button.getAttribute('data-range') === activeRange) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

/**
 * Update last update time display
 */
function updateLastUpdateTime() {
    const now = new Date();
    const timeEl = document.getElementById('lastUpdateTime');
    if (timeEl) {
        const timeString = now.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        timeEl.textContent = `Updated at ${timeString}`;
    }
}

/**
 * Setup chart controls
 */
function setupChartControls() {
    // Time range buttons
    const timeRangeBtns = document.querySelectorAll('.time-range-btn');
    timeRangeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const range = this.getAttribute('data-range');
            renderClicksChart(range);
        });
    });

    // Auto-refresh chart every 30 seconds
    setInterval(() => {
        const refreshIndicator = document.querySelector('.refresh-indicator');
        if (refreshIndicator) {
            refreshIndicator.classList.add('updating');
            renderClicksChart(currentChartRange).finally(() => {
                refreshIndicator.classList.remove('updating');
            });
        }
    }, 30000);
}

/**
 * Calculate and display trends for stats
 */
function calculateStatTrends() {
    // This would typically compare current data with previous period
    const statCards = document.querySelectorAll('.stat-card');
    
    statCards.forEach(card => {
        const statInfo = card.querySelector('.stat-info');
        if (!statInfo) return;

        // Generate random trend for demo (replace with actual data comparison)
        const trends = ['up', 'down', 'neutral'];
        const trend = trends[Math.floor(Math.random() * trends.length)];
        const percentage = trend === 'up' ? Math.random() * 20 : trend === 'down' ? Math.random() * 15 : 0;
        
        // Add trend indicator to card
        let trendEl = card.querySelector('.stat-trend');
        if (!trendEl) {
            trendEl = document.createElement('div');
            trendEl.className = `stat-trend trend-${trend}`;
            statInfo.appendChild(trendEl);
        }
        
        const icon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
        trendEl.innerHTML = `${icon} ${percentage.toFixed(1)}%`;
    });
}

// ============================================
// ENHANCED VISUAL FEEDBACK FUNCTIONS
// ============================================

/**
 * Create click feedback animation
 */
function createClickFeedback(x, y) {
    const feedback = document.createElement('div');
    feedback.className = 'click-feedback';
    feedback.style.left = `${x - 50}px`;
    feedback.style.top = `${y - 50}px`;
    
    document.body.appendChild(feedback);
    
    feedback.classList.add('active');
    
    setTimeout(() => {
        feedback.remove();
    }, 300);
}

/**
 * Highlight table row temporarily
 */
function highlightRow(carId) {
    const row = document.querySelector(`input[value="${carId}"]`)?.closest('tr');
    if (row) {
        row.classList.add('row-highlight');
        setTimeout(() => {
            row.classList.remove('row-highlight');
        }, 1000);
    }
}

/**
 * Animate stat number counting
 */
function animateStatNumber(element, targetValue, duration = 1000) {
    const startValue = parseInt(element.textContent) || 0;
    const increment = (targetValue - startValue) / (duration / 16);
    let current = startValue;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= targetValue) || 
            (increment < 0 && current <= targetValue)) {
            element.textContent = targetValue;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
}

// ============================================
// UPDATE INITIALIZATION
// ============================================

// Update your initialization to include enhanced features
function initializeEnhancedDashboard() {
    // Setup chart controls
    setupChartControls();
    
    // Calculate trends
    calculateStatTrends();
    
    // Add click feedback
    document.addEventListener('click', function(e) {
        // Only create feedback for chart area
        if (e.target.closest('.chart-container')) {
            createClickFeedback(e.clientX, e.clientY);
        }
    });
    
    // Enhanced table row interactions
    const tableRows = document.querySelectorAll('.admin-table tbody tr');
    tableRows.forEach(row => {
        row.addEventListener('mouseenter', function() {
            this.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
        });
        
        row.addEventListener('mouseleave', function() {
            this.style.backgroundColor = '';
        });
    });
}

// ============================================
// MESSAGES FUNCTIONALITY
// ============================================

window.switchView = function(view) {
    const carsView = document.getElementById('carsView');
    const messagesView = document.getElementById('messagesView');
    const navCarsBtn = document.getElementById('navCarsBtn');
    const navMessagesBtn = document.getElementById('navMessagesBtn');

    if (view === 'cars') {
        carsView.style.display = 'block';
        messagesView.style.display = 'none';
        navCarsBtn.classList.add('btn-primary');
        navCarsBtn.classList.remove('btn-secondary');
        navMessagesBtn.classList.add('btn-secondary');
        navMessagesBtn.classList.remove('btn-primary');
    } else {
        carsView.style.display = 'none';
        messagesView.style.display = 'block';
        navCarsBtn.classList.add('btn-secondary');
        navCarsBtn.classList.remove('btn-primary');
        navMessagesBtn.classList.add('btn-primary');
        navMessagesBtn.classList.remove('btn-secondary');
        loadMessages();
    }
};

async function loadMessages() {
    const tbody = document.getElementById('messagesTableBody');
    const loading = document.getElementById('messagesLoading');
    
    if(!tbody) return;
    
    tbody.innerHTML = '';
    if(loading) loading.style.display = 'block';

    try {
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderMessagesTable(messages);
    } catch (error) {
        console.error('Error loading messages:', error);
        showToast('Error loading messages', 'error');
    } finally {
        if(loading) loading.style.display = 'none';
    }
}

function renderMessagesTable(messages) {
    const tbody = document.getElementById('messagesTableBody');
    if (!tbody) return;

    if (messages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No messages found.</td></tr>';
        return;
    }

    tbody.innerHTML = messages.map(msg => `
        <tr style="${!msg.is_read ? 'background-color: rgba(14, 165, 164, 0.05); font-weight: 600;' : ''}">
            <td>
                ${msg.is_read 
                    ? '<span style="color: var(--secondary);"><i class="fas fa-check-circle"></i> Read</span>' 
                    : '<span style="color: var(--primary);"><i class="fas fa-circle"></i> New</span>'}
            </td>
            <td>${msg.name}</td>
            <td>${msg.subject}</td>
            <td>${new Date(msg.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openMessageModal('${msg.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteMessage('${msg.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

window.openMessageModal = async function(id) {
    const modal = document.getElementById('messageModal');
    
    try {
        const { data: msg, error } = await supabase
            .from('messages')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error) throw error;

        document.getElementById('msgName').textContent = msg.name;
        document.getElementById('msgEmail').textContent = msg.email;
        document.getElementById('msgPhone').textContent = msg.phone || 'N/A';
        document.getElementById('msgSubject').textContent = msg.subject;
        document.getElementById('msgDate').textContent = new Date(msg.created_at).toLocaleString();
        document.getElementById('msgBody').textContent = msg.message;
        document.getElementById('msgReplyBtn').href = `mailto:${msg.email}?subject=Re: ${msg.subject}`;

        modal.classList.add('active');

        // Mark as read if not already
        if (!msg.is_read) {
            await supabase.from('messages').update({ is_read: true }).eq('id', id);
            loadMessages(); // Refresh table to update status
            fetchDashboardStats(); // Refresh stats to update badge
        }
    } catch (error) {
        console.error('Error opening message:', error);
        showToast('Could not load message details', 'error');
    }
};

window.deleteMessage = async function(id) {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
        const { error } = await supabase.from('messages').delete().eq('id', id);
        if (error) throw error;
        showToast('Message deleted', 'success');
        loadMessages();
    } catch (error) {
        console.error('Error deleting message:', error);
        showToast('Failed to delete message', 'error');
    }
};