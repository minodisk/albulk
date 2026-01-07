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

interface InviteResponse {
  success: boolean;
  invited: string[];
  failed: string[];
  skipped: string[];
  notVerified: string[];
  error?: string;
}

// Handle invite button click
inviteBtn.addEventListener('click', async () => {
  const rawEmails = emailsTextarea.value
    .split('\n')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);

  // Deduplicate emails
  const emails = [...new Set(rawEmails)];
  const duplicateCount = rawEmails.length - emails.length;

  if (emails.length === 0) {
    showStatus('Please enter at least one email address', 'error');
    return;
  }

  if (duplicateCount > 0) {
    console.log(`[Albulk] Removed ${duplicateCount} duplicate emails`);
  }

  inviteBtn.disabled = true;
  showStatus(`Processing ${emails.length} users...`, 'info');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id || !tab.url?.includes('photos.google.com')) {
      showStatus('Please open Google Photos first', 'error');
      inviteBtn.disabled = false;
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'BULK_INVITE',
      emails,
    }) as InviteResponse;

    if (response.error) {
      showStatus(response.error, 'error');
    } else {
      const parts: string[] = [];

      if (response.invited?.length > 0) {
        parts.push(`Invited: ${response.invited.length}`);
      }
      if (response.skipped?.length > 0) {
        parts.push(`Skipped: ${response.skipped.length}`);
      }
      if (response.failed?.length > 0) {
        parts.push(`Failed: ${response.failed.length}`);
      }
      if (response.notVerified?.length > 0) {
        parts.push(`Unverified: ${response.notVerified.length}`);
      }

      if (parts.length === 0) {
        showStatus('No users were processed', 'error');
      } else {
        const hasProblems = (response.failed?.length > 0) || (response.notVerified?.length > 0);
        showStatus(parts.join(' | '), hasProblems ? 'info' : 'success');
      }
    }
  } catch (error) {
    const err = error as Error;
    if (err.message.includes('Receiving end does not exist')) {
      showStatus('Please refresh the Google Photos page and try again', 'error');
    } else {
      showStatus(`Error: ${err.message}`, 'error');
    }
  } finally {
    inviteBtn.disabled = false;
  }
});

function showStatus(message: string, type: 'success' | 'error' | 'info'): void {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
}
