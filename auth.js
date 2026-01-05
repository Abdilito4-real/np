// Authentication functions
async function handleAdminLogin(event) {
    if (event) event.preventDefault();
    
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const loginError = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');
    
    if (!email || !password) {
        showLoginError('Please enter both email and password');
        return;
    }
    
    loginBtn.innerHTML = '<div class="spinner"></div> Logging in...';
    loginBtn.disabled = true;
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            showLoginError('Invalid credentials. Please try again.');
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
            loginBtn.disabled = false;
            return;
        }
        
        currentUser = data.user;
        window.location.href = 'admin.html';
        
    } catch (error) {
        console.error('Login error:', error);
        showLoginError('An error occurred. Please try again.');
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        loginBtn.disabled = false;
    }
}

// Handle logout
async function handleLogout() {
    try {
        await supabase.auth.signOut();
        currentUser = null;
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Show login error
function showLoginError(message) {
    const loginError = document.getElementById('loginError');
    if (loginError) {
        loginError.textContent = message;
        loginError.style.display = 'block';
    }
}

// Check if user is admin (you might want to add additional checks)
function isAdmin(user) {
    // Add your admin verification logic here
    // This could check against a specific email or user metadata
    return user && user.email === 'admin@automarket.com';
}

// Initialize admin auth if on admin page
if (window.location.pathname.includes('admin.html')) {
    document.addEventListener('DOMContentLoaded', function() {
        const adminLoginForm = document.getElementById('adminLoginForm');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (adminLoginForm) {
            adminLoginForm.addEventListener('submit', handleAdminLogin);
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
        
        // Check if user is already logged in
        checkAuthState().then(() => {
            if (currentUser) {
                // User is logged in, show dashboard
                document.getElementById('adminLoginSection').style.display = 'none';
                document.getElementById('adminDashboard').style.display = 'block';
            } else {
                // User is not logged in, show login form
                document.getElementById('adminLoginSection').style.display = 'flex';
                document.getElementById('adminDashboard').style.display = 'none';
            }
        });
    });
}