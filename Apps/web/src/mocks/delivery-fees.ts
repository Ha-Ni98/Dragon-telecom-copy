/**
 * Delivery fees mock data
 * Based on Algerian wilayas and communes with realistic delivery costs
 */

export interface DeliveryFee {
  wilaya: string;
  commune: string;
  deliveryOffice: number; // Delivery to office in DA
  deliveryHome: number;   // Delivery to home in DA
}

export const mockDeliveryFees: DeliveryFee[] = [
  // Algiers (01)
  { wilaya: "Algiers", commune: "Alger Centre", deliveryOffice: 300, deliveryHome: 500 },
  { wilaya: "Algiers", commune: "Bab Ezzouar", deliveryOffice: 350, deliveryHome: 550 },
  { wilaya: "Algiers", commune: "Hussein Dey", deliveryOffice: 400, deliveryHome: 600 },
  { wilaya: "Algiers", commune: "Kouba", deliveryOffice: 350, deliveryHome: 550 },
  { wilaya: "Algiers", commune: "Hydra", deliveryOffice: 300, deliveryHome: 500 },
  { wilaya: "Algiers", commune: "Rest", deliveryOffice: 500, deliveryHome: 700 },

  // Oran (31)
  { wilaya: "Oran", commune: "Oran Centre", deliveryOffice: 400, deliveryHome: 600 },
  { wilaya: "Oran", commune: "Bir El Djir", deliveryOffice: 450, deliveryHome: 650 },
  { wilaya: "Oran", commune: "Es Senia", deliveryOffice: 500, deliveryHome: 700 },
  { wilaya: "Oran", commune: "Rest", deliveryOffice: 600, deliveryHome: 800 },

  // Constantine (25)
  { wilaya: "Constantine", commune: "Constantine Centre", deliveryOffice: 450, deliveryHome: 650 },
  { wilaya: "Constantine", commune: "El Khroub", deliveryOffice: 500, deliveryHome: 700 },
  { wilaya: "Constantine", commune: "Rest", deliveryOffice: 600, deliveryHome: 800 },

  // Blida (09)
  { wilaya: "Blida", commune: "Blida Centre", deliveryOffice: 350, deliveryHome: 550 },
  { wilaya: "Blida", commune: "Boufarik", deliveryOffice: 400, deliveryHome: 600 },
  { wilaya: "Blida", commune: "Rest", deliveryOffice: 500, deliveryHome: 700 },

  // Batna (05)
  { wilaya: "Batna", commune: "Batna Centre", deliveryOffice: 500, deliveryHome: 700 },
  { wilaya: "Batna", commune: "Barika", deliveryOffice: 600, deliveryHome: 800 },
  { wilaya: "Batna", commune: "Rest", deliveryOffice: 700, deliveryHome: 900 },

  // Setif (19)
  { wilaya: "Setif", commune: "Setif Centre", deliveryOffice: 450, deliveryHome: 650 },
  { wilaya: "Setif", commune: "El Eulma", deliveryOffice: 500, deliveryHome: 700 },
  { wilaya: "Setif", commune: "Rest", deliveryOffice: 600, deliveryHome: 800 },

  // Annaba (23)
  { wilaya: "Annaba", commune: "Annaba Centre", deliveryOffice: 500, deliveryHome: 700 },
  { wilaya: "Annaba", commune: "El Bouni", deliveryOffice: 550, deliveryHome: 750 },
  { wilaya: "Annaba", commune: "Rest", deliveryOffice: 650, deliveryHome: 850 },

  // Tlemcen (13)
  { wilaya: "Tlemcen", commune: "Tlemcen Centre", deliveryOffice: 550, deliveryHome: 750 },
  { wilaya: "Tlemcen", commune: "Rest", deliveryOffice: 700, deliveryHome: 900 },

  // Bejaia (06)
  { wilaya: "Bejaia", commune: "Bejaia Centre", deliveryOffice: 500, deliveryHome: 700 },
  { wilaya: "Bejaia", commune: "Rest", deliveryOffice: 650, deliveryHome: 850 },

  // Mostaganem (27)
  { wilaya: "Mostaganem", commune: "Mostaganem Centre", deliveryOffice: 450, deliveryHome: 650 },
  { wilaya: "Mostaganem", commune: "Rest", deliveryOffice: 600, deliveryHome: 800 },

  // Tipaza (42)
  { wilaya: "Tipaza", commune: "Tipaza Centre", deliveryOffice: 400, deliveryHome: 600 },
  { wilaya: "Tipaza", commune: "Rest", deliveryOffice: 550, deliveryHome: 750 },

  // Boumerdes (35)
  { wilaya: "Boumerdes", commune: "Boumerdes Centre", deliveryOffice: 400, deliveryHome: 600 },
  { wilaya: "Boumerdes", commune: "Rest", deliveryOffice: 550, deliveryHome: 750 },

  // Chlef (02)
  { wilaya: "Chlef", commune: "Chlef Centre", deliveryOffice: 450, deliveryHome: 650 },
  { wilaya: "Chlef", commune: "Rest", deliveryOffice: 600, deliveryHome: 800 },

  // Djelfa (17)
  { wilaya: "Djelfa", commune: "Djelfa Centre", deliveryOffice: 600, deliveryHome: 800 },
  { wilaya: "Djelfa", commune: "Rest", deliveryOffice: 750, deliveryHome: 950 },

  // M'Sila (28)
  { wilaya: "M'Sila", commune: "M'Sila Centre", deliveryOffice: 550, deliveryHome: 750 },
  { wilaya: "M'Sila", commune: "Rest", deliveryOffice: 700, deliveryHome: 900 },

  // Ouargla (30)
  { wilaya: "Ouargla", commune: "Ouargla Centre", deliveryOffice: 700, deliveryHome: 900 },
  { wilaya: "Ouargla", commune: "Rest", deliveryOffice: 850, deliveryHome: 1050 },

  // Ghardaia (47)
  { wilaya: "Ghardaia", commune: "Ghardaia Centre", deliveryOffice: 800, deliveryHome: 1000 },
  { wilaya: "Ghardaia", commune: "Rest", deliveryOffice: 950, deliveryHome: 1150 },

  // Tamanrasset (11)
  { wilaya: "Tamanrasset", commune: "Tamanrasset Centre", deliveryOffice: 1200, deliveryHome: 1400 },
  { wilaya: "Tamanrasset", commune: "Rest", deliveryOffice: 1400, deliveryHome: 1600 },

  // Adrar (01)
  { wilaya: "Adrar", commune: "Adrar Centre", deliveryOffice: 1000, deliveryHome: 1200 },
  { wilaya: "Adrar", commune: "Rest", deliveryOffice: 1200, deliveryHome: 1400 },

  // Illizi (33)
  { wilaya: "Illizi", commune: "Illizi Centre", deliveryOffice: 1100, deliveryHome: 1300 },
  { wilaya: "Illizi", commune: "Rest", deliveryOffice: 1300, deliveryHome: 1500 },

  // Tindouf (37)
  { wilaya: "Tindouf", commune: "Tindouf Centre", deliveryOffice: 1000, deliveryHome: 1200 },
  { wilaya: "Tindouf", commune: "Rest", deliveryOffice: 1200, deliveryHome: 1400 }
];

/**
 * Get delivery fees for a specific wilaya and commune
 */
export function getDeliveryFee(wilaya: string, commune: string): DeliveryFee | null {
  // First try to find exact match
  const exactMatch = mockDeliveryFees.find(
    fee => fee.wilaya.toLowerCase() === wilaya.toLowerCase() && 
           fee.commune.toLowerCase() === commune.toLowerCase()
  );
  
  if (exactMatch) {
    return exactMatch;
  }
  
  // If no exact match, try to find "Rest" entry for the wilaya
  const restMatch = mockDeliveryFees.find(
    fee => fee.wilaya.toLowerCase() === wilaya.toLowerCase() && 
           fee.commune.toLowerCase() === "rest"
  );
  
  return restMatch || null;
}

/**
 * Get all wilayas available for delivery
 */
export function getAvailableWilayas(): string[] {
  const wilayas = new Set(mockDeliveryFees.map(fee => fee.wilaya));
  return Array.from(wilayas).sort();
}

/**
 * Get all communes for a specific wilaya
 */
export function getCommunesForWilaya(wilaya: string): string[] {
  const communes = mockDeliveryFees
    .filter(fee => fee.wilaya.toLowerCase() === wilaya.toLowerCase())
    .map(fee => fee.commune)
    .filter(commune => commune.toLowerCase() !== "rest"); // Exclude "Rest" from dropdown
  
  return communes.sort();
}

/**
 * Calculate delivery fee based on wilaya, commune, and delivery mode
 */
export function calculateDeliveryFee(
  wilaya: string, 
  commune: string, 
  mode: 'home' | 'office'
): number {
  const deliveryFee = getDeliveryFee(wilaya, commune);
  
  if (!deliveryFee) {
    return 0; // Default to 0 if no fee found
  }
  
  return mode === 'home' ? deliveryFee.deliveryHome : deliveryFee.deliveryOffice;
}
