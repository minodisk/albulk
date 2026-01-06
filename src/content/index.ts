// Content script for Google Photos
// This script runs on photos.google.com pages

console.log('[Albulk] Content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'BULK_INVITE') {
    handleBulkInvite(message.emails)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }
});

async function handleBulkInvite(emails: string[]): Promise<void> {
  console.log('[Albulk] Starting bulk invite for:', emails);

  // TODO: Implement actual invite logic
  // 1. Find the share dialog
  // 2. For each email, input and add
  // 3. Report progress

  for (const email of emails) {
    await inviteUser(email);
    // Add delay between invites to avoid rate limiting
    await delay(500);
  }
}

async function inviteUser(email: string): Promise<void> {
  console.log('[Albulk] Inviting:', email);

  // TODO: Implement the actual DOM manipulation
  // This will need to be updated based on Google Photos UI analysis
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
