# Cosmos Space Dashboard

A static front-end dashboard powered by three public APIs.

## Run
Open `index.html` through a local web server (recommended), for example:
- VS Code Live Server, or
- `python -m http.server 8000` then visit http://localhost:8000

## APIs
- NASA APOD: https://api.nasa.gov/planetary/apod (uses the public DEMO_KEY; replace `NASA_API_KEY` in `js/index.js` with your own key for higher rate limits)
- The Space Devs Launch Library 2: https://ll.thespacedevs.com/2.2.0/launch/upcoming/
- Solar System OpenData: https://api.le-systeme-solaire.net/rest/bodies/

## Notes
- The app fetches live data when opened and includes loading/error states.
- Third-party APIs may occasionally rate-limit or be temporarily unavailable.
- Internet access is required for API data and externally hosted assets/fonts.
