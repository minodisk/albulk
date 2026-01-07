// Content script for Google Photos
// This script runs on photos.google.com pages

console.log('[Albulk] Content script loaded');

// Selectors for Google Photos share dialog
const SELECTORS = {
  input: 'input.I4p4db',
  candidateList: 'div[role="option"].AZW99',
  sendButton: 'button[aria-label="送信"], button[jsname="JfJFVc"]',
  shareDialog: 'div[role="dialog"]',
  addRecipientButton: 'div[role="button"][aria-label="宛先を追加"], div[jsname="BLFFMe"]',
  membersButton: 'div[role="button"][jsname="FQOgnc"]',
  membersList: 'div.xb66Id[jsname="uxYO5d"]',
  memberItem: 'div.yWiWP[role="listitem"]',
  memberName: 'div.UNoCVe',
  membersDialogCloseButton: 'button[aria-label="閉じる"][data-mdc-dialog-action="TvD9Pc"]',
  albumInfo: '[data-current-recipients-info]',
} as const;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'BULK_INVITE') {
    handleBulkInvite(message.emails)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'CHECK_DIALOG') {
    const dialog = document.querySelector(SELECTORS.shareDialog);
    const input = document.querySelector(SELECTORS.input);
    sendResponse({
      hasDialog: !!dialog,
      hasInput: !!input,
    });
    return true;
  }

  if (message.type === 'GET_CURRENT_MEMBERS') {
    getCurrentMembers().then((members) => sendResponse({ members }));
    return true;
  }
});

interface Member {
  id: string;
  name: string;
}

interface InviteResult {
  success: boolean;
  invited: string[];
  failed: string[];
  skipped: string[];  // Already shared members
  notVerified: string[];  // Could not verify after adding
  error?: string;
}

const BATCH_SIZE = 10;

async function handleBulkInvite(emails: string[]): Promise<InviteResult> {
  console.log('[Albulk] Starting bulk invite for:', emails.length, 'emails');

  const result: InviteResult = {
    success: true,
    invited: [],
    failed: [],
    skipped: [],
    notVerified: [],
  };

  // Get current member count before starting (for verification later)
  const existingMembers = await getCurrentMembers();
  const existingMemberCount = existingMembers.length;
  console.log('[Albulk] Existing members:', existingMemberCount);

  const emailsToInvite = emails;

  // Split emails into batches
  const batches: string[][] = [];
  for (let i = 0; i < emailsToInvite.length; i += BATCH_SIZE) {
    batches.push(emailsToInvite.slice(i, i + BATCH_SIZE));
  }

  console.log(`[Albulk] Processing ${batches.length} batches of up to ${BATCH_SIZE} emails each`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`[Albulk] Processing batch ${batchIndex + 1}/${batches.length}`);

    const batchResult = await processBatch(batch);
    result.invited.push(...batchResult.invited);
    result.failed.push(...batchResult.failed);

    if (batchResult.error) {
      result.error = batchResult.error;
      break;
    }

    // Wait before next batch
    if (batchIndex < batches.length - 1) {
      console.log('[Albulk] Waiting before next batch...');
      await delay(1000);
    }
  }

  // Verify added members
  console.log('[Albulk] Verifying added members...');
  await delay(1000);
  const finalMembers = await getCurrentMembers();
  const finalMemberCount = finalMembers.length;
  const addedCount = finalMemberCount - existingMemberCount;

  console.log(`[Albulk] Member count: before=${existingMemberCount}, after=${finalMemberCount}, added=${addedCount}`);

  // Check if the number of added members matches what we expected
  const expectedAdditions = result.invited.length;
  if (addedCount < expectedAdditions) {
    console.log(`[Albulk] Warning: Expected to add ${expectedAdditions} members, but only ${addedCount} were added`);
    // We can't determine exactly which ones failed, so mark some as not verified
    const unverifiedCount = expectedAdditions - addedCount;
    // Mark the last N invites as not verified (rough estimate)
    for (let i = 0; i < unverifiedCount && result.invited.length > 0; i++) {
      const email = result.invited.pop();
      if (email) {
        result.notVerified.push(email);
      }
    }
  } else if (addedCount > expectedAdditions) {
    console.log(`[Albulk] Note: Added ${addedCount} members (more than expected ${expectedAdditions}), possibly due to pending invites`);
  } else {
    console.log(`[Albulk] All ${expectedAdditions} members appear to have been added successfully`);
  }

  result.success = result.failed.length === 0 && result.notVerified.length === 0 && !result.error;
  console.log(`[Albulk] Done. Invited: ${result.invited.length}, Failed: ${result.failed.length}, Skipped: ${result.skipped.length}, Not verified: ${result.notVerified.length}`);

  // Log emails that were not invited
  if (result.skipped.length > 0) {
    console.log('[Albulk] Skipped (already shared):');
    console.log(result.skipped.join('\n'));
  }
  if (result.failed.length > 0) {
    console.log('[Albulk] Failed (not found):');
    console.log(result.failed.join('\n'));
  }
  if (result.notVerified.length > 0) {
    console.log('[Albulk] Not verified:');
    console.log(result.notVerified.join('\n'));
  }

  return result;
}

async function getCurrentMembers(): Promise<Member[]> {
  const members: Member[] = [];

  // Click the members button to open the list
  const membersButton = document.querySelector<HTMLElement>(SELECTORS.membersButton);
  if (!membersButton) {
    console.log('[Albulk] Members button not found');
    return members;
  }

  // Open the list twice to ensure all members are loaded
  // (Google Photos lazy-loads members, first open shows ~50, second shows all)
  console.log('[Albulk] Opening members list (1st time for preload)...');
  membersButton.click();

  // Wait for members list to fully load
  await waitForMembersList(2000);

  // Close by clicking close button
  let closeButton = document.querySelector<HTMLElement>(SELECTORS.membersDialogCloseButton);
  if (closeButton) {
    console.log('[Albulk] Closing members dialog (1st time)...');
    closeButton.click();
    await delay(500);
  } else {
    console.log('[Albulk] Close button not found (1st time)');
  }

  // Open again to get full list
  console.log('[Albulk] Opening members list (2nd time for full list)...');
  membersButton.click();

  // Wait for members list to fully load again
  await waitForMembersList(2000);

  // Wait for members list to appear
  const membersList = document.querySelector(SELECTORS.membersList);
  if (!membersList) {
    console.log('[Albulk] Members list not found after clicking button');
    closeButton = document.querySelector<HTMLElement>(SELECTORS.membersDialogCloseButton);
    if (closeButton) closeButton.click();
    return members;
  }

  // Scrape all member names
  const memberItems = membersList.querySelectorAll<HTMLElement>(SELECTORS.memberItem);
  console.log(`[Albulk] Found ${memberItems.length} members in list`);

  for (const item of memberItems) {
    const nameEl = item.querySelector(SELECTORS.memberName);
    const name = nameEl?.textContent?.trim() || '';
    const id = item.getAttribute('data-actor-id') || '';

    if (name) {
      members.push({ id, name });
    }
  }

  // Close the members list by clicking close button
  closeButton = document.querySelector<HTMLElement>(SELECTORS.membersDialogCloseButton);
  if (closeButton) {
    console.log('[Albulk] Closing members dialog (final)...');
    closeButton.click();
    await delay(500);
  } else {
    console.log('[Albulk] Close button not found (final)');
  }

  console.log('[Albulk] Current members:', members.map((m) => m.name));
  return members;
}

async function processBatch(emails: string[]): Promise<InviteResult> {
  const result: InviteResult = {
    success: true,
    invited: [],
    failed: [],
    skipped: [],
    notVerified: [],
  };

  // Open share dialog
  const input = await openShareDialog();
  if (!input) {
    return {
      ...result,
      success: false,
      failed: emails,
      error: 'Share dialog not found. Please open an album page first.',
    };
  }

  // Select users in this batch
  for (const email of emails) {
    try {
      const inviteResult = await inviteUser(email, input);
      switch (inviteResult.status) {
        case 'invited':
          result.invited.push(email);
          break;
        case 'already_shared':
          result.skipped.push(email);
          break;
        case 'not_found':
          result.failed.push(email);
          break;
      }
    } catch (error) {
      console.error(`[Albulk] Failed to invite ${email}:`, error);
      result.failed.push(email);
    }
    await delay(300);
  }

  // Send this batch
  if (result.invited.length > 0) {
    await clickSendButton();
    // Wait for dialog to close and reopen
    await delay(1000);
  }

  result.success = result.failed.length === 0;
  return result;
}

async function openShareDialog(): Promise<HTMLInputElement | null> {
  let input = document.querySelector<HTMLInputElement>(SELECTORS.input);

  if (!input) {
    const addButton = document.querySelector<HTMLElement>(SELECTORS.addRecipientButton);
    if (addButton) {
      console.log('[Albulk] Opening share dialog...');
      addButton.click();
      await delay(500);
      input = document.querySelector<HTMLInputElement>(SELECTORS.input);
    }
  }

  return input;
}

interface InviteUserResult {
  status: 'invited' | 'already_shared' | 'not_found';
  name?: string;
}

async function inviteUser(email: string, input: HTMLInputElement): Promise<InviteUserResult> {
  console.log('[Albulk] Inviting:', email);

  // Clear input and enter email
  input.focus();
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await delay(100);

  // Type email
  input.value = email;
  input.dispatchEvent(new Event('input', { bubbles: true }));

  // Wait for candidates to load
  await delay(500);

  // Find matching candidate
  const candidates = document.querySelectorAll<HTMLElement>(SELECTORS.candidateList);

  if (candidates.length === 0) {
    console.log(`[Albulk] No candidates found for: ${email}`);
    // Clear input
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return { status: 'not_found' };
  }

  // Check all candidates
  let disabledCandidate: HTMLElement | null = null;
  let availableCandidate: HTMLElement | null = null;

  for (const candidate of candidates) {
    const isDisabled = candidate.getAttribute('aria-disabled') === 'true';
    if (isDisabled && !disabledCandidate) {
      disabledCandidate = candidate;
    } else if (!isDisabled && !availableCandidate) {
      availableCandidate = candidate;
    }
  }

  // If there's only disabled candidates, the person is already shared
  if (!availableCandidate && disabledCandidate) {
    const nameElement = disabledCandidate.querySelector('.PNwDub');
    const name = nameElement?.getAttribute('data-name') || nameElement?.textContent || '';
    console.log(`[Albulk] Already shared: ${email} (${name})`);
    // Clear input
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return { status: 'already_shared', name };
  }

  // Click the first available candidate
  if (availableCandidate) {
    const nameElement = availableCandidate.querySelector('.PNwDub');
    const name = nameElement?.getAttribute('data-name') || nameElement?.textContent || '';
    availableCandidate.click();
    console.log(`[Albulk] Selected: ${name} for ${email}`);
    // Clear input for next search
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return { status: 'invited', name };
  }

  // Clear input
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return { status: 'not_found' };
}

async function clickSendButton(): Promise<void> {
  await delay(300);

  const sendButton = document.querySelector<HTMLButtonElement>(SELECTORS.sendButton);
  if (sendButton) {
    console.log('[Albulk] Clicking send button');
    sendButton.click();
  } else {
    console.log('[Albulk] Send button not found');
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForMembersList(timeout: number): Promise<void> {
  const startTime = Date.now();
  let lastCount = 0;
  let stableCount = 0;

  while (Date.now() - startTime < timeout) {
    await delay(200);

    const membersList = document.querySelector(SELECTORS.membersList);
    if (!membersList) {
      console.log('[Albulk] Waiting for members list to appear...');
      continue;
    }

    const currentCount = membersList.querySelectorAll(SELECTORS.memberItem).length;
    console.log(`[Albulk] Members list loading: ${currentCount} members`);

    if (currentCount === lastCount && currentCount > 0) {
      stableCount++;
      // If count is stable for 3 checks (600ms), assume loading is done
      if (stableCount >= 3) {
        console.log(`[Albulk] Members list loaded: ${currentCount} members (stable)`);
        return;
      }
    } else {
      stableCount = 0;
      lastCount = currentCount;
    }
  }

  console.log(`[Albulk] Members list wait timeout after ${timeout}ms`);
}
