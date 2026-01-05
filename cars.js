// Cars management functionality
let cars = [];
let filteredCars = [];

// DOM Elements
const carsContainer = document.getElementById('carsContainer');
const featuredCarsContainer = document.getElementById('featuredCars');
const searchInput = document.getElementById('searchInput');
const filterToggle = document.getElementById('filterToggle');
const filters = document.getElementById('filters');
const resultsCount = document.getElementById('resultsCount');

// Filter Elements
const brandFilter = document.getElementById('brandFilter');
const categoryFilter = document.getElementById('categoryFilter');
const priceMin = document.getElementById('priceMin');
const priceMax = document.getElementById('priceMax');
const yearMin = document.getElementById('yearMin');
const yearMax = document.getElementById('yearMax');
const fuelType = document.getElementById('fuelType');
const transmission = document.getElementById('transmission');
const resetFilters = document.getElementById('resetFilters');

// View Toggle
const gridView = document.getElementById('gridView');
const listView = document.getElementById('listView');

// Car Details Modal
const carDetailsModal = document.getElementById('carDetailsModal');
const closeCarModal = document.getElementById('closeCarModal');

// Modal state tracking
let modalOpen = false;

// Initialize cars functionality
document.addEventListener('DOMContentLoaded', function() {
    // Load cars based on current page
    if (carsContainer || featuredCarsContainer) {
        loadCars();
    }
    
    // Set up event listeners
    setupCarsEventListeners();
    
    // Close modal on outside click
    if (carDetailsModal) {
        window.addEventListener('click', function(event) {
            if (event.target === carDetailsModal) {
                closeCarDetails();
            }
        });
    }
});

// Set up cars event listeners
function setupCarsEventListeners() {
    // Filters and search
    // filterToggle is handled in main.js
    
    if (searchInput) {
        searchInput.addEventListener('input', filterCars);
    }
    
    if (brandFilter) {
        brandFilter.addEventListener('change', filterCars);
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterCars);
    }
    
    if (priceMin) {
        priceMin.addEventListener('input', filterCars);
    }
    
    if (priceMax) {
        priceMax.addEventListener('input', filterCars);
    }
    
    if (yearMin) {
        yearMin.addEventListener('input', filterCars);
    }
    
    if (yearMax) {
        yearMax.addEventListener('input', filterCars);
    }
    
    if (fuelType) {
        fuelType.addEventListener('change', filterCars);
    }
    
    if (transmission) {
        transmission.addEventListener('change', filterCars);
    }
    
    // resetFilters is handled in main.js
    
    // View toggle
    // View toggles are handled in main.js
    
    // Modal close
    if (closeCarModal) {
        closeCarModal.addEventListener('click', closeCarDetails);
    }
    
    // Close modal on Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && modalOpen && carDetailsModal) {
            closeCarDetails();
        }
    });
}

// Load cars from Supabase
async function loadCars() {
    try {
        // Show skeleton loader while fetching
        if (carsContainer) renderSkeletonLoader(carsContainer);
        if (featuredCarsContainer) renderSkeletonLoader(featuredCarsContainer);

        const { data, error } = await supabase
            .from('cars')
            .select('*')
            .eq('status', 'available')
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        cars = data;
        filteredCars = [...cars];
        
        // Render cars based on current page
        if (carsContainer) {
            renderCars();
            populateBrandFilter();
            updateResultsCount();
        }
        
        if (featuredCarsContainer) {
            renderFeaturedCars();
        }
        
    } catch (error) {
        console.error('Error loading cars:', error);
        showError('Error loading cars. Please try again later.');
    }
}

// Render Skeleton Loader
function renderSkeletonLoader(container) {
    container.innerHTML = Array(6).fill(`
        <div class="car-card skeleton-card">
            <div class="car-card-header skeleton"></div>
            <div class="car-info">
                <div class="skeleton-title skeleton"></div>
                <div class="skeleton-price skeleton"></div>
                <div class="skeleton-specs">
                    <div class="skeleton-spec skeleton"></div>
                    <div class="skeleton-spec skeleton"></div>
                    <div class="skeleton-spec skeleton"></div>
                </div>
                <div class="skeleton-actions">
                    <div class="skeleton-btn skeleton"></div>
                    <div class="skeleton-btn skeleton"></div>
                </div>
            </div>
        </div>
    `).join('');
}

// Render cars in the main grid
function renderCars() {
    if (!carsContainer) return;
    
    if (filteredCars.length === 0) {
        carsContainer.innerHTML = `
            <div class="loading" style="grid-column: 1 / -1;">
                <i class="fas fa-car" style="font-size: 3rem; margin-bottom: 1rem; color: var(--secondary);"></i>
                <h3>No cars found</h3>
                <p>No cars match your current filters. Try adjusting your search criteria.</p>
                <button class="btn btn-primary" onclick="resetAllFilters()">Reset Filters</button>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    filteredCars.forEach(car => {
        const mainImage = car.images && car.images.length > 0 ? car.images[0] : 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80';
        
        html += `
            <div class="car-card" data-id="${car.id}">
                <div class="car-card-header">
                    <img src="${mainImage}" alt="${car.make} ${car.model}" class="car-image">
                </div>
                <div class="car-info">
                    <div class="car-make-model">
                        <span>${car.make} ${car.model}</span>
                        <span class="car-year">${car.year}</span>
                    </div>
                    <div class="car-price">${formatCurrency(car.price)}</div>
                    <div class="car-specs">
                        <span><i class="fas fa-gas-pump"></i> ${car.meta.fuelType}</span>
                        <span><i class="fas fa-cog"></i> ${car.meta.transmission}</span>
                        <span><i class="fas fa-road"></i> ${car.meta.mileage.toLocaleString()} mi</span>
                    </div>
                    <div class="car-actions">
                        <button class="btn btn-primary view-details" data-id="${car.id}">
                            <i class="fas fa-eye"></i> Details
                        </button>
                        <button class="btn btn-success buy-now" data-id="${car.id}" onclick="handleBuyNowClick(event, '${car.id}')">
                            <i class="fas fa-shopping-cart"></i> Buy
                        </button>
                        <button class="btn btn-secondary share-car" data-id="${car.id}">
                            <i class="fas fa-share-alt"></i> Share
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    carsContainer.innerHTML = html;
    
    // Add event listeners to the new buttons
    document.querySelectorAll('.view-details').forEach(button => {
        button.addEventListener('click', function() {
            const carId = this.getAttribute('data-id');
            openCarDetails(carId, true); // Track the view from details button
        });
    });

    document.querySelectorAll('.share-car').forEach(button => {
        button.addEventListener('click', function() {
            const carId = this.getAttribute('data-id');
            shareCar(carId);
        });
    });
}

/**
 * Handles the 'Buy' button click.
 * It tracks the click for analytics and then opens the details modal.
 * @param {Event} event - The click event.
 * @param {string} carId - The ID of the car.
 */
function handleBuyNowClick(event, carId) {
    event.stopPropagation(); // Prevent event bubbling
    trackContactClick(carId); // Track the click immediately
    openCarDetails(carId, false); // Do NOT track a view, just open the modal.
}

// Render featured cars on homepage
function renderFeaturedCars() {
    if (!featuredCarsContainer) return;
    
    // Get first 6 cars as featured
    const featuredCars = cars.slice(0, 6);
    
    if (featuredCars.length === 0) {
        featuredCarsContainer.innerHTML = '<div class="loading"><p>No featured cars available.</p></div>';
        return;
    }
    
    let html = '';
    
    featuredCars.forEach(car => {
        const mainImage = car.images && car.images.length > 0 ? car.images[0] : 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80';
        
        html += `
            <div class="car-card" data-id="${car.id}">
                <div class="car-card-header">
                    <img src="${mainImage}" alt="${car.make} ${car.model}" class="car-image">
                </div>
                <div class="car-info">
                    <div class="car-make-model">
                        <span>${car.make} ${car.model}</span>
                        <span class="car-year">${car.year}</span>
                    </div>
                    <div class="car-price">${formatCurrency(car.price)}</div>
                    <div class="car-specs">
                        <span><i class="fas fa-gas-pump"></i> ${car.meta.fuelType}</span>
                        <span><i class="fas fa-cog"></i> ${car.meta.transmission}</span>
                        <span><i class="fas fa-road"></i> ${car.meta.mileage.toLocaleString()} mi</span>
                    </div>
                    <div class="car-actions">
                        <button class="btn btn-primary view-details" data-id="${car.id}">
                            <i class="fas fa-eye"></i> Details
                        </button>
                        <button class="btn btn-success buy-now" data-id="${car.id}" onclick="handleBuyNowClick(event, '${car.id}')">
                            <i class="fas fa-shopping-cart"></i> Buy
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    featuredCarsContainer.innerHTML = html;
    
    // Add event listeners to view details buttons (featured)
    document.querySelectorAll('.view-details').forEach(button => {
        button.addEventListener('click', function() {
            const carId = this.getAttribute('data-id');
            openCarDetails(carId, true); // Track the view from details button
        });
    });
}

// Populate brand filter with unique car makes
function populateBrandFilter() {
    if (!brandFilter) return;
    
    const brands = [...new Set(cars.map(car => car.make))].sort();
    
    brands.forEach(brand => {
        const option = document.createElement('option');
        option.value = brand;
        option.textContent = brand;
        brandFilter.appendChild(option);
    });
}

// Filter cars based on search and filter criteria
function filterCars() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const selectedBrand = brandFilter ? brandFilter.value : '';
    const selectedCategory = categoryFilter ? categoryFilter.value : '';
    const minPrice = priceMin && priceMin.value ? parseInt(priceMin.value) : 0;
    const maxPrice = priceMax && priceMax.value ? parseInt(priceMax.value) : Number.MAX_SAFE_INTEGER;
    const minYear = yearMin && yearMin.value ? parseInt(yearMin.value) : 0;
    const maxYear = yearMax && yearMax.value ? parseInt(yearMax.value) : new Date().getFullYear();
    const selectedFuelType = fuelType ? fuelType.value : '';
    const selectedTransmission = transmission ? transmission.value : '';
    
    filteredCars = cars.filter(car => {
        // Search term filter
        const searchMatch = 
            car.make.toLowerCase().includes(searchTerm) ||
            car.model.toLowerCase().includes(searchTerm) ||
            car.year.toString().includes(searchTerm);
        
        // Brand filter
        const brandMatch = selectedBrand ? car.make === selectedBrand : true;
        
        // Category filter
        const categoryMatch = selectedCategory ? car.meta.category === selectedCategory : true;
        
        // Price filter
        const priceMatch = car.price >= minPrice && car.price <= maxPrice;
        
        // Year filter
        const yearMatch = car.year >= minYear && car.year <= maxYear;
        
        // Fuel type filter
        const fuelMatch = selectedFuelType ? car.meta.fuelType === selectedFuelType : true;
        
        // Transmission filter
        const transmissionMatch = selectedTransmission ? car.meta.transmission === selectedTransmission : true;
        
        return searchMatch && brandMatch && categoryMatch && priceMatch && yearMatch && fuelMatch && transmissionMatch;
    });
    
    if (carsContainer) {
        renderCars();
        updateResultsCount();
    }
}

// Update results count
function updateResultsCount() {
    if (!resultsCount) return;
    
    const count = filteredCars.length;
    resultsCount.textContent = `${count} car${count !== 1 ? 's' : ''} found`;
}

// Reset all filters
function resetAllFilters() {
    if (searchInput) searchInput.value = '';
    if (brandFilter) brandFilter.value = '';
    if (categoryFilter) categoryFilter.value = '';
    if (priceMin) priceMin.value = '';
    if (priceMax) priceMax.value = '';
    if (yearMin) yearMin.value = '';
    if (yearMax) yearMax.value = '';
    if (fuelType) fuelType.value = '';
    if (transmission) transmission.value = '';
    
    filterCars();
}

// Open car details modal
async function openCarDetails(carId, trackView = true) {
    // treat ids as strings to handle numeric or string IDs from backend
    const idStr = String(carId);
    const car = cars.find(c => String(c.id) === idStr);
    if (!car) return;
    
    // Only track the view if specified
    if (trackView) {
        trackCarView(carId);
    }
    
    const modalTitle = document.getElementById('carModalTitle');
    const modalBody = document.getElementById('carModalBody');
    
    if (!modalTitle || !modalBody) return;
    
    modalTitle.textContent = `${car.year} ${car.make} ${car.model}`;
    
    // Create WhatsApp message
    const whatsappMessage = `Hi, I'm interested in the ${car.year} ${car.make} ${car.model} listed for ${formatCurrency(car.price)}.`;
    const encodedMessage = encodeURIComponent(whatsappMessage);
    const whatsappUrl = `https://wa.me/2348141984899?text=${encodedMessage}`;
    
    // Generate gallery HTML
    let galleryHtml = '';
    if (car.images && car.images.length > 0) {
        galleryHtml = `
            <div class="car-gallery">
                <img src="${car.images[0]}" alt="${car.make} ${car.model}" class="main-image" id="mainCarImage">
        `;
        
        car.images.forEach((image, index) => {
            galleryHtml += `
                <img src="${image}" alt="${car.make} ${car.model}" class="thumbnail" data-index="${index}">
            `;
        });
        
        galleryHtml += '</div>';
    } else {
        galleryHtml = `
            <div class="car-gallery">
                <img src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80" 
                     alt="${car.make} ${car.model}" class="main-image">
            </div>
        `;
    }
    
    // Generate features HTML
    let featuresHtml = '';
    if (car.meta.features && car.meta.features.length > 0) {
        featuresHtml = `
            <div class="car-features">
                <h4>Features</h4>
                <div class="features-list">
                    ${car.meta.features.map(feature => `<span class="feature-tag">${feature}</span>`).join('')}
                </div>
            </div>
        `;
    }
    
    modalBody.innerHTML = `
        <div class="modal-layout">
            <div class="modal-left-column">
                ${galleryHtml}
                <div class="modal-card car-price-card">
                    <h3>${formatCurrency(car.price)}</h3>
                </div>
            </div>
            <div class="modal-right-column">
                <div class="modal-card">
                    <h4>Key Specifications</h4>
                <div class="car-specs-detail">
                    <div class="spec-item">
                        <span class="spec-label">Make</span>
                        <span class="spec-value">${car.make}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Model</span>
                        <span class="spec-value">${car.model}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Year</span>
                        <span class="spec-value">${car.year}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Category</span>
                        <span class="spec-value">${car.meta.category}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Fuel Type</span>
                        <span class="spec-value">${car.meta.fuelType}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Transmission</span>
                        <span class="spec-value">${car.meta.transmission}</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Mileage</span>
                        <span class="spec-value">${car.meta.mileage.toLocaleString()} mi</span>
                    </div>
                    <div class="spec-item">
                        <span class="spec-label">Seats</span>
                        <span class="spec-value">${car.meta.seats}</span>
                    </div>
                </div>
                ${featuresHtml}
            </div>
            <div>
                <div class="car-description">
                    <h4>Description</h4>
                    <p>${car.meta.description || 'No description available.'}</p>
                </div>
                <div class="modal-actions">
                    <a href="${whatsappUrl}" target="_blank" class="btn btn-whatsapp" id="contactSellerBtn">
                        <i class="fab fa-whatsapp"></i> Contact NP Automobile
                    </a>
                    <button class="btn btn-secondary" id="shareCarBtn" data-id="${car.id}">
                        <i class="fas fa-share-alt"></i> Share
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add event listener for thumbnail clicks
    if (car.images && car.images.length > 0) {
        document.querySelectorAll('.thumbnail').forEach(thumb => {
            thumb.addEventListener('click', function() {
                const index = this.getAttribute('data-index');
                document.getElementById('mainCarImage').src = car.images[index];
            });
        });
    }
    
    // Add event listener for share button
    const shareBtn = document.getElementById('shareCarBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', function() {
            shareCar(idStr);
        });
    }
    
    // Add event listener for contact button
    const contactBtn = document.getElementById('contactSellerBtn');
    if (contactBtn) {
        contactBtn.addEventListener('click', function() {
            // The click is now tracked by handleBuyNowClick, so we don't track it here.
        });
    }
    
    if (carDetailsModal) {
        carDetailsModal.classList.add('active');
        modalOpen = true;
        document.body.style.overflow = 'hidden';
    }
}

// Close car details modal
function closeCarDetails() {
    if (carDetailsModal) {
        carDetailsModal.classList.remove('active');
        modalOpen = false;
        document.body.style.overflow = 'auto';
    }
}

// Track contact button click analytics
async function trackContactClick(carId) {
    try {
        // First dispatch the event immediately for real-time updates
        const event = new CustomEvent('carContactClicked', {
            detail: { carId: String(carId) }
        });
        window.dispatchEvent(event);

        console.log('Contact click event dispatched for car:', carId);

        // Then save to database (non-blocking)
        try {
            await supabase
                .from('analytics')
                .insert({
                    car_id: carId,
                    event_type: 'contact_click', // This will trigger the real-time listener in admin.js
                    user_ip: 'unknown',
                    user_agent: navigator.userAgent
                });

            console.log('Contact click saved to database for car:', carId);
        } catch (dbError) {
            console.warn('Could not save contact click to database:', dbError);
        }

    } catch (error) {
        console.error('Error tracking contact click:', error);
    }
}

// Track car view analytics - FIXED VERSION
async function trackCarView(carId) {
    try {
        // First dispatch the event immediately for real-time updates
        const event = new CustomEvent('carViewTracked', { 
            detail: { carId: String(carId) } 
        });
        window.dispatchEvent(event);
        
        console.log('Car view event dispatched for car:', carId);
        
        // Then save to database (non-blocking)
        try {
            await supabase
                .from('analytics')
                .insert({
                    car_id: carId,
                    event_type: 'view',
                    user_ip: 'unknown',
                    user_agent: navigator.userAgent
                });
            
            console.log('Car view saved to database for car:', carId);
        } catch (dbError) {
            console.warn('Could not save car view to database:', dbError);
            // Continue anyway since we've already dispatched the event
        }
        
    } catch (error) {
        console.error('Error tracking view:', error);
    }
}

// Share car listing
function shareCar(carId) {
    const idStr = String(carId);
    const car = cars.find(c => String(c.id) === idStr);
    
    if (!car) return;
    
    const shareText = `Check out this ${car.year} ${car.make} ${car.model} for ${formatCurrency(car.price)} on AutoMarket!`;
    const shareUrl = window.location.origin + '/cars.html';
    
    if (navigator.share) {
        navigator.share({
            title: `${car.year} ${car.make} ${car.model}`,
            text: shareText,
            url: shareUrl
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(`${shareText} ${shareUrl}`).then(() => {
            showToast('Link copied to clipboard!', 'success');
        });
    }
}

// Show error message
function showError(message) {
    const container = carsContainer || featuredCarsContainer;
    if (container) {
        container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Oops! Something went wrong</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="loadCars()">
                    <i class="fas fa-sync-alt"></i> Try Again
                </button>
            </div>
        `;
    }
    showToast(message, 'error');
}
