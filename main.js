// Supabase Configuration
const SUPABASE_URL = 'https://pzjkueabaclfimqmylat.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6amt1ZWFiYWNsZmltcW15bGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzOTY3ODksImV4cCI6MjA3NDk3Mjc4OX0.6FI5GblT-_xFVT3u5naz3Gyb0RI653aEhLQhzqU6-qA';

// Ensure a single global supabase client exists. Do NOT redeclare a top-level identifier named `supabase`
// because the Supabase CDN or other scripts may already create a global `supabase` binding.
if (!window.supabase) {
    try {
        if (typeof createClient === 'function') {
            // CDN exposes `createClient`
            window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else if (window.supabase && typeof window.supabase.createClient === 'function') {
            // Some builds expose a `supabase` object with createClient
            window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            console.warn('Supabase client library not found. Ensure the CDN or bundle is loaded before main.js');
        }
    } catch (err) {
        console.error('Error initializing Supabase client:', err);
    }
} else {
    // Already initialized by another script — reuse it
    console.debug('Using existing global supabase client');
}

// Application State
let currentUser = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    checkAuthState();
    
    // Initialize page-specific functionality
    initPage();
});

// Check if user is authenticated
async function checkAuthState() {
    if (!window.supabase) return;

    const { data: { user } } = await window.supabase.auth.getUser();
    if (user) {
        currentUser = user;
    }
}

// Initialize page-specific functionality
function initPage() {
    // Initialize stats counter on homepage
    if (document.querySelector('.stats-grid')) {
        initStatsLayout();
        initStatsCounter();
    }
    
    // Initialize FAQ accordion on contact page
    if (document.querySelector('.faq-item')) {
        initFAQAccordion();
    }
    
    // Initialize contact form on contact page
    if (document.getElementById('contactForm')) {
        initContactForm();
    }

    // Initialize filter toggle on cars page
    if (document.getElementById('filterToggle')) {
        initFilterHandlers();
    }

    // Initialize view toggles
    if (document.getElementById('gridView')) {
        initViewToggles();
    }

    // Initialize back to top button
    initBackToTop();
}

// Initialize stats layout
function initStatsLayout() {
    const statsGrid = document.querySelector('.stats-grid');
    if (!statsGrid) return;

    // Inject CSS for grid layout
    if (!document.getElementById('stats-layout-style')) {
        const style = document.createElement('style');
        style.id = 'stats-layout-style';
        style.textContent = `
            @media (min-width: 992px) {
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 2rem;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Reorder cards to ensure specific positioning
    const cards = Array.from(statsGrid.children);
    const avgAgeCard = cards.find(card => card.textContent.includes('Avg. Inventory Age'));
    const invValueCard = cards.find(card => card.textContent.includes('Inventory Value'));

    if (avgAgeCard && invValueCard) {
        // Move to end
        statsGrid.appendChild(avgAgeCard);
        statsGrid.appendChild(invValueCard);
    }
}

// Initialize stats counter animation
function initStatsCounter() {
    const statNumbers = document.querySelectorAll('.stat-number');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const statNumber = entry.target;
                const target = parseInt(statNumber.getAttribute('data-count'));
                animateCounter(statNumber, target);
                observer.unobserve(statNumber);
            }
        });
    }, { threshold: 0.5 });
    
    statNumbers.forEach(stat => observer.observe(stat));
}

// Animate counter from 0 to target value
function animateCounter(element, target) {
    let current = 0;
    const increment = target / 100;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 20);
}

// Initialize FAQ accordion
function initFAQAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            // Close all other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            item.classList.toggle('active');
        });
    });
}

// Initialize contact form
function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;
    
    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(this);
        const data = Object.fromEntries(formData);
        
        // Simple validation
        if (!data.name || !data.email || !data.subject || !data.message) {
            showToast('Please fill in all required fields.', 'error');
            return;
        }
        
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        submitBtn.innerHTML = '<div class="spinner"></div> Sending...';
        submitBtn.disabled = true;
        
        try {
            const { error } = await window.supabase
                .from('messages')
                .insert([{
                    name: data.name,
                    email: data.email,
                    phone: data.phone || null,
                    subject: data.subject,
                    message: data.message,
                    created_at: new Date().toISOString(),
                    is_read: false
                }]);

            if (error) throw error;

            showToast('Thank you for your message! We will get back to you soon.', 'success');
            contactForm.reset();
        } catch (error) {
            console.error('Error sending message:', error);
            showToast('Failed to send message. Please try again.', 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Initialize filter handlers
function initFilterHandlers() {
    const filterToggle = document.getElementById('filterToggle');
    const filters = document.getElementById('filters');
    const resetBtn = document.getElementById('resetFilters');
    const searchInput = document.getElementById('searchInput');
    
    if (filterToggle && filters) {
        // Toggle filters visibility
        filterToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Toggle active class
            filters.classList.toggle('active');
            
            // Update button state
            if (filters.classList.contains('active')) {
                filterToggle.innerHTML = '<i class="fas fa-times"></i> Close';
                filterToggle.classList.add('active');
            } else {
                filterToggle.innerHTML = '<i class="fas fa-filter"></i> Filters';
                filterToggle.classList.remove('active');
            }
        });

        // Close filters when clicking outside (UX improvement for mobile)
        document.addEventListener('click', (e) => {
            if (filters.classList.contains('active') && 
                !filters.contains(e.target) && 
                !filterToggle.contains(e.target)) {
                
                filters.classList.remove('active');
                filterToggle.innerHTML = '<i class="fas fa-filter"></i> Filters';
                filterToggle.classList.remove('active');
            }
        });
    }

    // Handle reset filters
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (filters) {
                const inputs = filters.querySelectorAll('input, select');
                inputs.forEach(input => {
                    input.value = '';
                    // Dispatch change event for listeners in cars.js
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    if (input.tagName === 'INPUT') {
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                });
            }
            
            if (searchInput) {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }
}

// Initialize view toggles
function initViewToggles() {
    const gridBtn = document.getElementById('gridView');
    const listBtn = document.getElementById('listView');
    const container = document.getElementById('carsContainer');
    
    if (gridBtn && listBtn && container) {
        gridBtn.addEventListener('click', () => {
            container.classList.remove('list-view');
            gridBtn.classList.add('active');
            listBtn.classList.remove('active');
        });
        
        listBtn.addEventListener('click', () => {
            container.classList.add('list-view');
            listBtn.classList.add('active');
            gridBtn.classList.remove('active');
        });
    }
}

// Initialize back to top button
function initBackToTop() {
    const backToTopBtn = document.getElementById('backToTopBtn');
    
    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });
        
        backToTopBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}

// Utility function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0
    }).format(amount);
}

// Utility function to format date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Close modals when clicking outside
document.addEventListener('click', function(event) {
    const modals = document.querySelectorAll('.modal');
    
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Close modals when pressing Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
    }
});

// Toast Notification System
function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';

    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
        <button class="toast-close" style="background:none;border:none;color:inherit;cursor:pointer;font-size:1.2rem;margin-left:auto;opacity:0.8;">&times;</button>
    `;

    container.appendChild(toast);

    // Close button functionality
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('exit');
        setTimeout(() => toast.remove(), 300);
    });

    // Remove after 7 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('exit');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }
    }, 7000);
}
