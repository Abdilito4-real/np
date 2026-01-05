/**
 * This script contains the logic for real-time analytics updates on the admin dashboard.
 * You should integrate this code into your existing `admin.js` file.
 */

document.addEventListener('DOMContentLoaded', () => {

    // Ensure this code runs only when the admin dashboard is visible.
    // You might have a better way to check if the user is on the admin page.
    const adminDashboard = document.getElementById('adminDashboard');
    if (!adminDashboard || adminDashboard.style.display === 'none') {
        console.log("Analytics listeners not attached: Not on admin dashboard.");
        return;
    }

    console.log("Attaching real-time analytics listeners.");

    /**
     * Listens for 'carContactClicked' events dispatched from the public site.
     * When an event is caught, it increments the 'buy_clicks' for the specific car
     * in the Supabase database and then refreshes the dashboard stats.
     */
    window.addEventListener('carContactClicked', async (event) => {
        const { carId } = event.detail;
        if (!carId) {
            console.error('carContactClicked event is missing carId.');
            return;
        }

        console.log(`'carContactClicked' event received for carId: ${carId}. Updating stats...`);
        showLoading('Updating click count...');

        try {
            // Use Supabase RPC to increment the 'buy_clicks' count for the car.
            // This is the most efficient way to perform an increment.
            const { error } = await supabase.rpc('increment_buy_clicks', { car_id_to_increment: carId });

            if (error) {
                throw error;
            }

            // After successfully updating the database, refresh the dashboard UI.
            // You should call your existing functions to refresh the stats and the table.
            // For example:
            // await fetchAdminStats();
            // await fetchAndDisplayCars(currentView, currentSearch);
            
            // Since I don't have your functions, I'll log a success message.
            console.log(`Successfully incremented buy_clicks for carId: ${carId}. Refresh your dashboard data to see the change.`);
            showToast('Buy click tracked successfully!', 'success');

        } catch (error) {
            console.error('Error incrementing buy clicks:', error.message);
            showToast('Error tracking click.', 'error');
        } finally {
            hideLoading();
        }
    });

    // You would have a similar listener for 'carViewTracked'
    // window.addEventListener('carViewTracked', async (event) => { ... });

});