import * as Location from "expo-location";

export interface AccuratePosition {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

/**
 * Requests location permission and fetches high-accuracy GPS coordinates.
 * FlowHRMS requires GPS accuracy better than 200m per policy (D-P2-03).
 */
export async function getAccuratePosition(): Promise<{
  position: AccuratePosition | null;
  error: string | null;
}> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return {
        position: null,
        error: "Location permission denied. Please enable GPS permissions to check in.",
      };
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });

    return {
      position: {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        timestamp: loc.timestamp,
      },
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to obtain GPS position";
    return { position: null, error: message };
  }
}
