# Allhouse 0.1.0 local alpha — acceptance checklist

This is a test plan, not a statement that tests have passed. Record actual results in `QA-REPORT.md`.

## Automated runtime gates

- The overlay HTTP service listens only on loopback.
- Unknown routes and invalid overlay credentials cannot obtain workspace data.
- Untrusted Host and Origin requests are rejected.
- Editing a draft does not change the published overlay.
- Explicit publication updates the output snapshot.
- Preview tests do not enter the OBS event stream.
- Explicit OBS tests are labelled as tests.
- Queue controls pause, resume, skip and clear consistently.
- Restart restores saved preferences and publication without replaying old alerts.
- Invalid and oversized imports are rejected without replacing good state.
- Workspace exports do not contain overlay credentials.
- User-supplied strings are rendered as text rather than executable HTML.
- Event history and queue remain bounded.

## Desktop and beginner-user gates

- A fresh launch offers a working sample path without requiring platform login.
- Live Twitch, YouTube, Kick and TikTok status accurately reflects implemented capabilities.
- Connect buttons do not claim success from simulated activity.
- Thai and English text, labels, punctuation and fonts are legible.
- Light, dark and system appearance choices remain readable.
- The user can identify saved draft versus published output.
- The OBS guide includes URL, dimensions and a clear explicit test action.
- A connected browser is not described as proof of live OBS program output.
- TTS shows actual locally installed voices and explains when Thai or English voices are missing.
- TTS stop cancels active speech and pending messages.
- Audio audition is not described as verified OBS audio routing.
- All controls have keyboard focus and labels.
- The smallest supported window keeps important controls reachable.
- Closing and reopening the desktop preserves settings.

## Release limitations to report explicitly

Real platform authorization/events, managed cloud TTS, installer signing, actual OBS video/audio verification and endurance testing require separate evidence. A passing local alpha test suite does not complete the 40-feature roadmap or certify a production stream.
