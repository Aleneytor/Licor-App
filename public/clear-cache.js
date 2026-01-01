// This script helps unregister any existing service workers
// Run this in your browser console if you're experiencing issues with cached content

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
            registration.unregister();
            console.log('Service Worker unregistered:', registration);
        }
        console.log('All service workers have been unregistered. Please refresh the page.');
    });
}

// Also clear all caches
if ('caches' in window) {
    caches.keys().then(function (names) {
        for (let name of names) {
            caches.delete(name);
            console.log('Cache deleted:', name);
        }
        console.log('All caches have been cleared. Please refresh the page.');
    });
}
