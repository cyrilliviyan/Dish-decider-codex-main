export type VegPreference = "veg" | "non_veg" | "mixed";
export type SpicePreference = "mild" | "medium" | "hot";
export type MenuCategory = "starter" | "main" | "bread" | "rice" | "dessert" | "drink";

export type Hotel = {
  id: string;
  name: string;
  location: string;
  owner_name: string;
  mobile_number: string;
  email: string;
  owner_pin: string;
  budget_split: Record<string, number>;
  currency: string;
};

export type MenuItem = {
  id: string;
  hotel_id: string;
  name: string;
  category: MenuCategory;
  price: number;
  veg_flag: boolean;
  spice_level: SpicePreference;
  serves_count: number;
  must_try: boolean;
  is_available: boolean;
};

export type OrderFormValues = {
  hotelId: string;
  partySize: number;
  budget: number;
  vegPref: VegPreference;
  spicePref: SpicePreference;
  allergies: string;
};

export type HotelFormValues = {
  id?: string;
  name: string;
  location: string;
  ownerName: string;
  mobileNumber: string;
  email: string;
  ownerPin: string;
  currency: string;
};

export type MenuItemFormValues = {
  id?: string;
  hotelId: string;
  name: string;
  category: MenuCategory;
  price: number;
  vegFlag: boolean;
  spiceLevel: SpicePreference;
  servesCount: number;
  mustTry: boolean;
  isAvailable: boolean;
};

export type ParsedMenuItem = Omit<MenuItemFormValues, "hotelId" | "isAvailable">;

export type SuggestedItem = {
  item_id: string;
  name: string;
  category: MenuCategory;
  quantity: number;
  unit_price: number;
  line_total: number;
  reason: string;
};

export type Suggestion = {
  starters: SuggestedItem[];
  mains: SuggestedItem[];
  total_price: number;
  summary: string;
  order_id?: string;
  source?: "claude" | "fallback";
};

export type OrderStatus = "pending" | "confirmed" | "cancelled";
