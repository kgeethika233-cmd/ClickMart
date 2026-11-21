export type SampleArea = {
  name: string
  pincode: string
  lat: number
  lng: number
}

export type SampleCity = {
  city: string
  areas: SampleArea[]
}

export const MOCK_LOCATIONS: SampleCity[] = [
  {
    city: 'Bengaluru',
    areas: [
      { name: 'Indiranagar', pincode: '560038', lat: 12.9784, lng: 77.6408 },
      { name: 'Koramangala', pincode: '560034', lat: 12.9352, lng: 77.6245 },
      { name: 'Malleshwaram', pincode: '560003', lat: 13.0035, lng: 77.5643 },
      { name: 'Whitefield', pincode: '560066', lat: 12.9698, lng: 77.75 },
      { name: 'Jayanagar', pincode: '560041', lat: 12.925, lng: 77.5838 },
      { name: 'Nelamangala', pincode: '562123', lat: 13.0997, lng: 77.3936 },
    ],
  },
  {
    city: 'Mumbai',
    areas: [
      { name: 'Bandra West', pincode: '400050', lat: 19.0607, lng: 72.8362 },
      { name: 'Andheri East', pincode: '400069', lat: 19.1136, lng: 72.8697 },
      { name: 'Dadar', pincode: '400014', lat: 19.0178, lng: 72.8478 },
      { name: 'Powai', pincode: '400076', lat: 19.1176, lng: 72.906 },
      { name: 'Colaba', pincode: '400005', lat: 18.9067, lng: 72.8147 },
      { name: 'Vasai', pincode: '401202', lat: 19.3919, lng: 72.8397 },
    ],
  },
]

export function getAreasForCity(city: string) {
  return MOCK_LOCATIONS.find(entry => entry.city === city)?.areas ?? []
}
