// Contact page specific functionality
document.addEventListener('DOMContentLoaded', function() {
    // Contact form is already initialized in main.js
    // Additional contact page functionality can be added here
    
    // Example: Initialize map functionality if needed
    initMapFunctionality();
});

// Initialize map functionality (placeholder)
function initMapFunctionality() {
    // This would integrate with a mapping service like Google Maps
    // For now, it's just a placeholder
    console.log('Map functionality would be initialized here');
    
    // Example: Add click handler for get directions button
    const directionsBtn = document.querySelector('.btn-secondary');
    if (directionsBtn) {
        directionsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // In a real implementation, this would open directions in Google Maps
            const address = 'NO 1 College road, Close to 44 Hospital Kaduna, NO Jesse Jackson Street Asokoro Abuja';
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
            window.open(mapsUrl, '_blank');
        });
    }
}