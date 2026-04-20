import type { FacilityCardViewModel } from "@/features/facilities/types";

export const demoFacilities: FacilityCardViewModel[] = [
  {
    id: "facility-basketball-main",
    slug: "center-court",
    name: "Center Court",
    description: "Full indoor basketball court for leagues, scrimmages, and private rentals.",
    type: "BASKETBALL_WHOLE",
    typeLabel: "Whole Basketball Court",
    images: [
      {
        url: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80",
        alt: "Indoor basketball court"
      }
    ],
    price: {
      amountMinor: 250000,
      currency: "PHP"
    }
  },
  {
    id: "facility-basketball-half-a",
    slug: "3x3-court-a",
    name: "3x3 Court A",
    description: "Half-court setup optimized for 3x3 play, drills, and youth training sessions.",
    type: "BASKETBALL_HALF",
    typeLabel: "Half Basketball Court",
    images: [
      {
        url: "https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&w=1200&q=80",
        alt: "Half basketball court"
      }
    ],
    price: {
      amountMinor: 120000,
      currency: "PHP"
    }
  },
  {
    id: "facility-pickleball-1",
    slug: "pickleball-court-1",
    name: "Pickleball Court 1",
    description: "Dedicated pickleball court with competition markings and evening lighting.",
    type: "PICKLEBALL",
    typeLabel: "Pickleball Court",
    images: [
      {
        url: "https://commons.wikimedia.org/wiki/Special:FilePath/Outdoor_pickleball_courts.jpg",
        alt: "Outdoor pickleball courts"
      }
    ],
    price: {
      amountMinor: 90000,
      currency: "PHP"
    }
  },
  {
    id: "facility-badminton-1",
    slug: "badminton-court-1",
    name: "Badminton Court 1",
    description: "Indoor badminton lane with rubberized flooring and spectator-side clearance.",
    type: "BADMINTON",
    typeLabel: "Badminton Court",
    images: [
      {
        url: "https://commons.wikimedia.org/wiki/Special:FilePath/BOSE_Badminton_Court.jpg",
        alt: "Indoor badminton court"
      }
    ],
    price: {
      amountMinor: 70000,
      currency: "PHP"
    }
  }
];
