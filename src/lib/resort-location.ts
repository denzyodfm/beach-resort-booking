/**
 * Where the resort is and how guests get there. Shared by the public "How to get here"
 * page, the staff location map, and the booking confirmation email/SMS.
 *
 * Set NEXT_PUBLIC_RESORT_LAT and NEXT_PUBLIC_RESORT_LNG to the resort ENTRANCE (drop a pin
 * at the gate in Google Maps, long-press, copy the numbers). Until then the map falls back
 * to a name search, which may land on the barangay instead of the gate.
 */

export type DirectionsRoute = {
  from: string;
  steps: string[];
};

export const resortLocation = {
  name: "Bolihon Beach Resort",
  address: "Carmen, Agusan del Norte, Philippines",
  /** From the resort's signed front-desk procedures (SOP 20261001/20261002). */
  streetAddress: "Sitio Bolihon, Tagcatong, Carmen, Agusan del Norte",
  contactPhone: "0917 093 8537 (Globe)",
  facebookPage: "Bolihon Beach Resort",
  latitude: parseCoordinate(process.env.NEXT_PUBLIC_RESORT_LAT, 90),
  longitude: parseCoordinate(process.env.NEXT_PUBLIC_RESORT_LNG, 180),
  /** Where cars and tricycles stop. Leave empty to hide the parking note. */
  parkingNote: "",
  /** Short routes from main landmarks and public transport. Routes with no steps are hidden. */
  routes: [
    {
      from: "Butuan City",
      steps: [
        "From Butuan City, head west on the national highway through Libertad and Bancasi.",
        "Continue past Manapa into Buenavista town proper.",
        "Keep going west to Nasipit (Triangulo junction), then on through Santa Ana.",
        "Pass Amontay Beach Resort and continue toward Cahayagan, Carmen.",
        "Bolihon Beach Resort is on the coast at Cahayagan — about 38 km, roughly 50 minutes in total.",
      ],
    },
  ] as DirectionsRoute[],
  /** Origin of the route map on the "How to get here" page. */
  routeMapOrigin: "Butuan City, Agusan del Norte, Philippines",
};

function parseCoordinate(value: string | undefined, limit: number) {
  const number = Number(value);
  return value?.trim() && Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

function destination() {
  const { latitude, longitude, name, address } = resortLocation;
  return latitude !== null && longitude !== null ? `${latitude},${longitude}` : `${name}, ${address}`;
}

/** Universal Maps link: opens the Google Maps app on Android/iOS, the website elsewhere. */
export function getDirectionsUrl(origin?: string) {
  const from = origin ? `&origin=${encodeURIComponent(origin)}` : "";
  return `https://www.google.com/maps/dir/?api=1${from}&destination=${encodeURIComponent(destination())}`;
}

/** Keyless Google Maps embed showing the driving route from `origin` to the resort. */
export function getRouteEmbedUrl(origin: string) {
  return `https://www.google.com/maps?saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination())}&output=embed`;
}

/** Keyless Google Maps embed for an iframe. */
export function getMapEmbedUrl() {
  return `https://www.google.com/maps?q=${encodeURIComponent(destination())}&z=16&output=embed`;
}

/** Apple Maps link for iPhone users who don't have Google Maps installed. */
export function getAppleMapsUrl() {
  const { latitude, longitude, name } = resortLocation;
  const query = latitude !== null && longitude !== null ? `ll=${latitude},${longitude}&q=${encodeURIComponent(name)}` : `q=${encodeURIComponent(destination())}`;
  return `https://maps.apple.com/?${query}`;
}
