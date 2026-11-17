# Add panel protection, solar playlists, and custom OSD fonts

This update expands Aerial’s screensaver controls with panel-protection options, time-of-day playlists, and customizable on-screen display fonts. It also adds clearer apply/revert controls, update notices, and related settings UI.

## What changed

- Panel protection
  - Add optional custom brightness and gradual dimming
  - Add panel-off and standby timers
  - Add text protections that move, drift, or fade the on-screen display
  - Restore brightness via the watcher and boot hook

- Solar mode
  - Let users choose a city and play videos tagged for sunrise, day, sunset, or night
  - Add solar-time calculation and refresh
  - Add video durations for playlist totals

- OSD customization
  - Add bold and shadow options
  - Improve layout for overlapping text and clock blocks
  - Allow users to add or remove custom fonts using a phone-accessible upload page

- Screensaver controls
  - Add an apply-status check
  - Add an option to restore LG’s stock screensaver

- Settings and localization
  - Add update notices
  - Add release notes and an About panel
  - Add translations for the new controls

- Release metadata
  - Bump the app version to `3.0.6`

## Testing

- Startup tests updated to cover playback behavior when protection is active
- Startup tests updated for solar playlist fallback
- Screensaver test flow updated
- Manual verification recommended on LG webOS hardware for:
  - brightness restoration
  - panel and standby timers
  - solar mode
  - font uploads
  - apply/revert behavior
