# ADR 001: Chrome Extension for Bulk Album Invitation on Google Photos

## Status

Proposed

## Context

When sharing albums on Google Photos, users need to click buttons repeatedly to invite multiple people one by one. This process is tedious and time-consuming when inviting a large number of people.

### Current Pain Points

- Users must select each invitee individually
- Large group invitations take significant time
- Repetitive work increases the risk of human error

## Decision

Develop a Chrome extension that enables bulk invitation of multiple users on Google Photos album sharing screen.

### Tech Stack

- **Manifest Version**: V3 (latest Chrome extension specification)
- **Language**: TypeScript
- **Build Tool**: Vite + CRXJS (optimized for Chrome extension development)
- **UI**: Preact or Vanilla JS (prioritizing lightweight)

### Architecture

```
albulk/
├── src/
│   ├── manifest.json       # Extension configuration
│   ├── content/            # Content Script (Google Photos manipulation)
│   │   └── index.ts
│   ├── popup/              # Popup UI
│   │   ├── index.html
│   │   └── index.ts
│   └── background/         # Service Worker
│       └── index.ts
├── docs/
│   └── adrs/
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Functional Requirements

1. **Contact List Management**
   - Save frequently invited users
   - Group feature (e.g., family, friends, colleagues)
   - Import/Export functionality

2. **Bulk Invitation Execution**
   - Select multiple users from saved lists
   - Execute invitations in bulk
   - Progress indicator

3. **UI/UX**
   - Seamless integration with Google Photos sharing screen
   - Simple and intuitive interface

### Implementation Phases

#### Phase 1: Foundation Setup
- [ ] Project setup (Vite + TypeScript + CRXJS)
- [ ] Basic Manifest V3 configuration
- [ ] Development environment setup

#### Phase 2: Google Photos Analysis
- [ ] Investigate DOM structure of album sharing screen
- [ ] Analyze invitation operation event flow
- [ ] Identify required selectors

#### Phase 3: Content Script Implementation
- [ ] Detect Google Photos sharing screen
- [ ] Automate invitation operations
- [ ] Error handling

#### Phase 4: User Interface
- [ ] Implement popup UI
- [ ] Contact list management feature
- [ ] Group management feature

#### Phase 5: Data Persistence
- [ ] Data storage using Chrome Storage API
- [ ] Import/Export functionality

#### Phase 6: Testing & Release
- [ ] E2E testing
- [ ] Chrome Web Store submission preparation

## Technical Considerations

### Risks and Mitigations

1. **Google Photos UI Changes**
   - Selectors may change over time
   - Mitigation: Prepare multiple selector patterns, regular maintenance

2. **Rate Limiting**
   - Too many invitation operations in short time may be blocked
   - Mitigation: Add appropriate delays between operations

3. **Authentication & Security**
   - Do not handle user's Google account credentials
   - Store contact lists only in local storage

### Permission Requirements (manifest.json)

```json
{
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://photos.google.com/*"
  ]
}
```

## Consequences

### Pros

- Significantly streamlined invitation process for large groups
- Reusable contact groups
- Reduced human error

### Cons

- Need to track Google Photos UI changes
- Chrome extension maintenance cost

## References

- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [CRXJS Vite Plugin](https://crxjs.dev/vite-plugin)
