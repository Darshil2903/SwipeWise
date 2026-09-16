import * as Location from 'expo-location';

export async function getForegroundLocationPermission() {
  const current = await Location.getForegroundPermissionsAsync();
  return current?.status || 'undetermined';
}

export async function requestForegroundCoordinates() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    return { status: permission.status || 'denied', coords: null };
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
    mayShowUserSettingsDialog: true,
  });

  return {
    status: 'granted',
    coords: {
      latitude: Number(location.coords.latitude),
      longitude: Number(location.coords.longitude),
      accuracy: Number.isFinite(Number(location.coords.accuracy)) ? Number(location.coords.accuracy) : null,
    },
  };
}
