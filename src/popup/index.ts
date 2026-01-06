// Popup script
const emailsTextarea = document.getElementById('emails') as HTMLTextAreaElement;
const inviteBtn = document.getElementById('invite-btn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

// Load saved emails from storage
chrome.storage.local.get(['emails'], (result) => {
  if (result.emails) {
    emailsTextarea.value = result.emails;
  }
});

// Save emails on change
emailsTextarea.addEventListener('input', () => {
  chrome.storage.local.set({ emails: emailsTextarea.value });
});

// Handle invite button click
inviteBtn.addEventListener('click', async () => {
  const emails = emailsTextarea.value
    .split('\n')
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  if (emails.length === 0) {
    showStatus('Please enter at least one email address', 'error');
    return;
  }

  inviteBtn.disabled = true;
  showStatus(`Inviting ${emails.length} users...`, 'info');

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id || !tab.url?.includes('photos.google.com')) {
      showStatus('Please open Google Photos album sharing page first', 'error');
      inviteBtn.disabled = false;
      return;
    }

    // Send message to content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'BULK_INVITE',
      emails,
    });

    if (response.success) {
      showStatus(`Successfully invited ${emails.length} users!`, 'success');
    } else {
      showStatus(`Error: ${response.error}`, 'error');
    }
  } catch (error) {
    showStatus(`Error: ${(error as Error).message}`, 'error');
  } finally {
    inviteBtn.disabled = false;
  }
});

function showStatus(message: string, type: 'success' | 'error' | 'info'): void {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
}
