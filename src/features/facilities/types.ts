export type FacilityType = "BASKETBALL_WHOLE" | "BASKETBALL_HALF" | "PICKLEBALL" | "BADMINTON" | "OTHER";

export type FacilityCardViewModel = {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: FacilityType;
  typeLabel: string;
  images: Array<{
    url: string;
    alt: string;
  }>;
  price: {
    amountMinor: number;
    currency: "PHP";
  };
};
