// Background service worker
console.log('[Albulk] Background service worker started');

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Albulk] Extension installed');
});
