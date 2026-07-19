/**
 * Delivery Service
 * Handles delivery fee calculations and wilaya/commune data
 */

import { 
  mockDeliveryFees, 
  getDeliveryFee, 
  getAvailableWilayas, 
  getCommunesForWilaya, 
  calculateDeliveryFee,
  type DeliveryFee 
} from "@/mocks/delivery-fees";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch all delivery fees data
 */
export async function fetchDeliveryFees(): Promise<DeliveryFee[]> {
  await sleep(100);
  
  try {
    return mockDeliveryFees;
  } catch (error) {
    console.error('Error fetching delivery fees:', error);
    return [];
  }
}

/**
 * Calculate delivery fee based on wilaya, commune, and delivery mode
 */
export async function calculateDeliveryFeeAsync(
  wilaya: string, 
  commune: string, 
  mode: 'home' | 'office'
): Promise<number> {
  await sleep(50);
  
  try {
    return calculateDeliveryFee(wilaya, commune, mode);
  } catch (error) {
    console.error('Error calculating delivery fee:', error);
    return 0;
  }
}

/**
 * Get delivery fee details for specific wilaya and commune
 */
export async function getDeliveryFeeDetails(wilaya: string, commune: string): Promise<DeliveryFee | null> {
  await sleep(50);
  
  try {
    return getDeliveryFee(wilaya, commune);
  } catch (error) {
    console.error('Error getting delivery fee details:', error);
    return null;
  }
}

/**
 * Get all available wilayas for delivery
 */
export async function fetchAvailableWilayas(): Promise<string[]> {
  await sleep(50);
  
  try {
    return getAvailableWilayas();
  } catch (error) {
    console.error('Error fetching available wilayas:', error);
    return [];
  }
}

/**
 * Get all communes for a specific wilaya
 */
export async function fetchCommunesForWilaya(wilaya: string): Promise<string[]> {
  await sleep(50);
  
  try {
    return getCommunesForWilaya(wilaya);
  } catch (error) {
    console.error('Error fetching communes for wilaya:', error);
    return [];
  }
}

/**
 * Validate delivery address (wilaya and commune combination)
 */
export async function validateDeliveryAddress(wilaya: string, commune: string): Promise<boolean> {
  await sleep(30);
  
  try {
    const fee = getDeliveryFee(wilaya, commune);
    return fee !== null;
  } catch (error) {
    console.error('Error validating delivery address:', error);
    return false;
  }
}

/**
 * Get delivery fee summary for multiple locations
 */
export async function getDeliveryFeeSummary(locations: Array<{wilaya: string, commune: string}>): Promise<Array<{wilaya: string, commune: string, homeFee: number, officeFee: number}>> {
  await sleep(100);
  
  try {
    return locations.map(location => {
      const homeFee = calculateDeliveryFee(location.wilaya, location.commune, 'home');
      const officeFee = calculateDeliveryFee(location.wilaya, location.commune, 'office');
      
      return {
        wilaya: location.wilaya,
        commune: location.commune,
        homeFee,
        officeFee
      };
    });
  } catch (error) {
    console.error('Error getting delivery fee summary:', error);
    return [];
  }
}

/**
 * Get delivery fee statistics
 */
export async function getDeliveryFeeStatistics(): Promise<{
  totalWilayas: number;
  totalCommunes: number;
  averageHomeFee: number;
  averageOfficeFee: number;
  minHomeFee: number;
  maxHomeFee: number;
  minOfficeFee: number;
  maxOfficeFee: number;
}> {
  await sleep(100);
  
  try {
    const wilayas = getAvailableWilayas();
    const allFees = mockDeliveryFees;
    
    const homeFees = allFees.map(fee => fee.deliveryHome);
    const officeFees = allFees.map(fee => fee.deliveryOffice);
    
    const totalCommunes = allFees.length;
    const averageHomeFee = Math.round(homeFees.reduce((sum, fee) => sum + fee, 0) / homeFees.length);
    const averageOfficeFee = Math.round(officeFees.reduce((sum, fee) => sum + fee, 0) / officeFees.length);
    
    return {
      totalWilayas: wilayas.length,
      totalCommunes,
      averageHomeFee,
      averageOfficeFee,
      minHomeFee: Math.min(...homeFees),
      maxHomeFee: Math.max(...homeFees),
      minOfficeFee: Math.min(...officeFees),
      maxOfficeFee: Math.max(...officeFees)
    };
  } catch (error) {
    console.error('Error getting delivery fee statistics:', error);
    return {
      totalWilayas: 0,
      totalCommunes: 0,
      averageHomeFee: 0,
      averageOfficeFee: 0,
      minHomeFee: 0,
      maxHomeFee: 0,
      minOfficeFee: 0,
      maxOfficeFee: 0
    };
  }
}
