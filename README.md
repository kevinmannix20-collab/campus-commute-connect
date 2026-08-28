# Campus Commute Connect

Looking for a Prototype DESIGN for the app:

I would like you to help me develop a design for an App. the service is called Commute Mate. Students at my school are often looking to coordinate their commute to and from campus. Generally two examples paint a picture: 1) a student who is taking a bus home late and doesn't want to go alone. They should be able to type in where they are going and at what time and see whether or not anyone else is doing the same. App will connect them so they can commute together. 2) A student is going home and doesn't have a car. Many students have cars with extra room and are going to similar areas. One student can input that theyd like a ride at x time and are going to location y. Drivers can scan through and determine if they want to give everyone rides.

I would like to somewhat model it after uber. Where you start by input where you're going when whether you'd prefer bus or car.  Once that's submitted you wait to see if you're matched. For drivers they scan scroll through a list of submissions by persons First Name & Last initial and click to go through and user is matched. Once a match happens There should be something like an itinerary.

Landing pages we need are 1) uber-like page that opens immediately where you type in where youre going, when, and preferred method of transport. 2) Landing page where people can look at status updates on their submissions. 3) Driver/fellow commuter page where they can look at submissions and either pair up on the bus or offer a ride.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ec357791-2dd9-4155-b82f-115bf70cb09a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Google Maps setup

The request screen uses Google Maps for address autocomplete, "use my current
location," and the pickup/destination map. This requires a Google Cloud API
key that isn't included in the repo — without it, the app still works, but
falls back to plain text location fields and no map.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/), create or reuse a project.
2. Under **APIs & Services → Library**, enable:
   - **Maps JavaScript API**
   - **Places API** and **Places API (New)** — the address-autocomplete widget this app uses runs on the classic Places API; enabling both avoids surprises depending on how your project's Places access is configured.
   - **Geocoding API** — used to turn "current location" coordinates back into a readable address.
3. Under **Credentials**, create a new API key.
4. Restrict the key to **HTTP referrers**, and add this app's deployed domain(s) plus `localhost:8080` for local dev. This key is visible in the browser by design (client-side Maps libraries require it) — the referrer restriction is what keeps it from being usable elsewhere.
5. Add it as `VITE_GOOGLE_MAPS_API_KEY` in a `.env.local` file at the repo root (see `.env.example`), and as an environment variable in your hosting platform for production. The `VITE_` prefix is required for Vite to expose it to browser code.
6. Billing must be enabled on the project for these APIs to work, but Google applies a $200/month credit automatically — at this app's expected usage, cost should be $0.
