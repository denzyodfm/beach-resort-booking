import type { Booking, CottageCategory, Room, RoomType } from "./types";

const cottageImages: Record<RoomType, string> = {
  cove: "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1400&q=80",
  rock: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1400&q=80",
  rd: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
  hall: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1400&q=80",
  pavillon: "https://images.unsplash.com/photo-1602002418082-a4443e081dd1?auto=format&fit=crop&w=1400&q=80",
};

const cottageGallery = [
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1000&q=80",
];

export const defaultBookingIncludes = [
  "Daily breakfast and resort transfers",
  "Flexible payment status tracking",
  "Guest dashboard visibility after sign in",
];

export const defaultCategories: CottageCategory[] = [
  { id: "cove", name: "Cove cottages", description: "Cove 1 to 45 - Php700/day", sortOrder: 10 },
  { id: "rock", name: "Rock cottages", description: "Rock 1 to 6 - Php800/day", sortOrder: 20 },
  { id: "rd", name: "RD cottages", description: "RD 1 to 8 - Php800/day", sortOrder: 30 },
  { id: "hall", name: "VGP Hall", description: "Event cottage - Php4,500/day", sortOrder: 40 },
  { id: "pavillon", name: "Pavillon", description: "Open-air cottage - Php3,500/day", sortOrder: 50 },
];

type NumberedCottageType = "cove" | "rock" | "rd";

const groupDetails: Record<
  NumberedCottageType,
  {
    label: string;
    count: number;
    baseRate: number;
    maxGuests: number;
    size: string;
    description: string;
    longDescription: string;
    amenities: string[];
  }
> = {
  cove: {
    label: "Cove",
    count: 45,
    baseRate: 700,
    maxGuests: 4,
    size: "42 sq m",
    description: "Beachside cottage close to the cove path and resort gardens.",
    longDescription:
      "A relaxed BOLIHON cottage with air-conditioned sleeping space, private bath, shaded porch, and quick access to the beach path.",
    amenities: ["Air conditioning", "Private bath", "Porch", "Beach access", "Breakfast available"],
  },
  rock: {
    label: "Rock",
    count: 6,
    baseRate: 800,
    maxGuests: 5,
    size: "55 sq m",
    description: "Larger cottage near the rock garden with extra living space.",
    longDescription:
      "Rock cottages are designed for families and groups who want more floor area, a quiet porch, and easy access to the scenic rock garden.",
    amenities: ["Family layout", "Garden view", "Private bath", "Mini fridge", "Outdoor seating"],
  },
  rd: {
    label: "RD",
    count: 8,
    baseRate: 800,
    maxGuests: 4,
    size: "48 sq m",
    description: "Comfortable RD cottage with convenient access to resort facilities.",
    longDescription:
      "RD cottages balance privacy and convenience with bright interiors, a private bathroom, and a short walk to dining, reception, and the beach.",
    amenities: ["Central location", "Private bath", "Queen bed", "Work nook", "Resort access"],
  },
};

function slugify(value: string) {
  return value.toLowerCase().replace(/\s+/g, "-");
}

function getCategory(type: string) {
  return defaultCategories.find((category) => category.id === type);
}

function createCottage(type: NumberedCottageType, number: number): Room {
  const detail = groupDetails[type];
  const name = `${detail.label} ${number}`;

  return {
    id: `cottage_${type}_${number}`,
    slug: slugify(name),
    name,
    type,
    categoryId: type,
    categoryName: getCategory(type)?.name || detail.label,
    description: detail.description,
    longDescription: `${detail.longDescription} This unit is ${name}, with editable rate, details, and image controls available in the admin dashboard.`,
    pricePerNight: detail.baseRate,
    maxGuests: detail.maxGuests,
    bedrooms: type === "rock" ? 2 : 1,
    bathrooms: 1,
    size: detail.size,
    image: cottageImages[type],
    gallery: cottageGallery,
    amenities: detail.amenities,
    bookingIncludes: defaultBookingIncludes,
    featured: number <= (type === "cove" ? 3 : 1),
    available: true,
  };
}

const specialCottages: Room[] = [
  {
    id: "cottage_vgp_hall",
    slug: "vgp-hall",
    name: "VGP Hall",
    type: "hall",
    categoryId: "hall",
    categoryName: getCategory("hall")?.name || "VGP Hall",
    description: "Large BOLIHON event cottage for gatherings, meetings, and celebrations.",
    longDescription:
      "VGP Hall is a spacious bookable cottage-style venue at BOLIHON with flexible seating, private facilities, and admin-editable rate, details, and image controls.",
    pricePerNight: 4500,
    maxGuests: 60,
    bedrooms: 0,
    bathrooms: 2,
    size: "Event hall",
    image: cottageImages.hall,
    gallery: cottageGallery,
    amenities: ["Event space", "Private bath", "Outdoor seating", "Resort access"],
    bookingIncludes: ["Flexible event setup", "Private bath access", "Guest dashboard visibility after sign in"],
    featured: true,
    available: true,
  },
  {
    id: "cottage_pavillon",
    slug: "pavillon",
    name: "Pavillon",
    type: "pavillon",
    categoryId: "pavillon",
    categoryName: getCategory("pavillon")?.name || "Pavillon",
    description: "Open-air BOLIHON pavillon cottage for casual events and family stays.",
    longDescription:
      "The Pavillon is a breezy bookable cottage-style space with shaded gathering areas, nearby resort facilities, and editable admin details.",
    pricePerNight: 3500,
    maxGuests: 40,
    bedrooms: 0,
    bathrooms: 1,
    size: "Open-air pavillon",
    image: cottageImages.pavillon,
    gallery: cottageGallery,
    amenities: ["Open-air space", "Private bath", "Beach access", "Resort access"],
    bookingIncludes: ["Open-air shaded use", "Beach access", "Guest dashboard visibility after sign in"],
    featured: true,
    available: true,
  },
];

export const rooms: Room[] = [
  ...(["cove", "rock", "rd"] as const).flatMap((type) =>
    Array.from({ length: groupDetails[type].count }, (_, index) => createCottage(type, index + 1)),
  ),
  ...specialCottages,
];

export const sampleBookings: Booking[] = [];

export function getRoomBySlug(slug: string) {
  return rooms.find((room) => room.slug === slug);
}

export function getRoomById(id: string) {
  return rooms.find((room) => room.id === id);
}

export function getCategoryById(id: string) {
  return defaultCategories.find((category) => category.id === id);
}

export function normalizeRoom(row: Room | Record<string, unknown>, categories = defaultCategories): Room {
  const source = row as Record<string, unknown>;
  const categoryId = String(source.categoryId || source.category_id || source.type || "cove");
  const category = categories.find((item) => item.id === categoryId);
  const name = String(source.name || "Cottage");
  const primaryImage =
    (source.room_images as Array<{ image_url?: string }> | undefined)?.[0]?.image_url ||
    String(source.image || source.image_url || cottageImages[categoryId] || cottageImages.cove);
  const gallery =
    Array.isArray(source.gallery) && source.gallery.length
      ? source.gallery.map(String)
      : (source.room_images as Array<{ image_url?: string }> | undefined)
          ?.map((image) => image.image_url)
          .filter(Boolean) as string[] | undefined;
  const nestedAmenities = source.room_amenities as Array<{ amenities?: { name?: string } }> | undefined;
  const includesValue = source.bookingIncludes || source.booking_includes;
  const normalizedAmenities = nestedAmenities?.map((item) => item.amenities?.name).filter(Boolean) as string[] | undefined;

  return {
    id: String(source.id || slugify(name)),
    slug: String(source.slug || slugify(name)),
    name,
    type: categoryId,
    categoryId,
    categoryName: String(source.categoryName || source.category_name || category?.name || categoryId),
    description: String(source.description || ""),
    longDescription: String(source.longDescription || source.long_description || source.description || ""),
    pricePerNight: Number(source.pricePerNight ?? source.price_per_night ?? 0),
    maxGuests: Number(source.maxGuests ?? source.max_guests ?? 1),
    bedrooms: Number(source.bedrooms ?? 1),
    bathrooms: Number(source.bathrooms ?? 1),
    size: String(source.size || source.size_sq_ft || ""),
    image: primaryImage,
    gallery: gallery?.length ? gallery : cottageGallery,
    amenities: Array.isArray(source.amenities)
      ? source.amenities.map(String)
      : normalizedAmenities || [],
    bookingIncludes: Array.isArray(includesValue)
      ? includesValue.map(String)
      : defaultBookingIncludes,
    featured: Boolean(source.featured ?? source.is_featured ?? false),
    available: Boolean(source.available ?? source.is_active ?? true),
  };
}

export function normalizeCategory(row: CottageCategory | Record<string, unknown>): CottageCategory {
  const source = row as Record<string, unknown>;
  const name = String(source.name || "Category");
  return {
    id: String(source.id || slugify(name)),
    name,
    description: String(source.description || ""),
    sortOrder: Number(source.sortOrder ?? source.sort_order ?? 0),
  };
}

export function nightsBetween(checkIn: string, checkOut: string) {
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diff / 86_400_000) + 1);
}
