import type { MessageKey } from './es.ts'

export const en: Record<MessageKey, string> = {
  'app.title': 'RutaLibre',
  'app.tagline': 'Metro and bus routes based on the live status of elevators and escalators.',

  'search.title': 'Where to?',
  'search.origin': 'From',
  'search.destination': 'To',
  'search.placeholder.origin': 'Street, place or station',
  'search.placeholder.destination': 'Where are you going?',
  'search.useLocation': 'Use my location',
  'search.myLocation': 'My location',
  'search.locating': 'Finding your location…',
  'search.locationDenied':
    "We don't have permission to use your location. Type where you're starting from.",
  'search.locationFailed': "We couldn't get your location. Type where you're starting from.",
  'search.swap': 'Swap origin and destination',
  'search.submit': 'Find accessible route',
  'search.searching': 'Searching…',
  'search.needBoth': 'Choose an origin and a destination from the list.',
  'search.suggestions': 'Suggestions for "{field}"',
  'search.noSuggestions': 'No results. Try another address or station.',
  'search.suggestionsUnavailable': 'Place search is unavailable right now.',
  'search.freeText.label': 'Or describe your trip',
  'search.freeText.placeholder': 'E.g. from Plaza de Armas to Hospital del Salvador',
  'search.freeText.submit': 'Interpret',
  'search.freeText.failed': "We couldn't understand the trip. Use the fields above.",
  'search.voice.start': 'Dictate',
  'search.voice.listening': 'Listening…',
  'search.voice.stop': 'Stop dictating',
  'search.voice.notAllowed':
    'To dictate, allow the microphone in your browser (icon next to the site address).',
  'search.voice.noSpeech':
    "We didn't hear anything. Tap the microphone and speak close to the phone.",
  'search.voice.noMicrophone': "We couldn't find a microphone on this device.",
  'search.voice.unavailable':
    "Dictation doesn't work in this browser. Try Chrome or Safari, or type your trip.",
  'search.freeText.interpreting': 'Understanding your trip…',

  'verdict.ok': 'Accessible now',
  'verdict.warning': 'Accessible, with notices',
  'verdict.blocked': 'Not accessible',
  'verdict.unknown': "We can't confirm it",

  'outcome.accessible': 'Accessible route found.',
  'outcome.rerouted': 'Route adjusted: we avoid stations with elevators out of service.',
  'outcome.uncertain': "We can't confirm any route is accessible right now. Check the notices.",
  'outcome.noAccessible':
    "We couldn't find an accessible route. Ask Metro staff for assistance at the station.",
  'outcome.noRoute': "We couldn't find public transport routes between those places.",
  'outcome.error': "We couldn't search for a route. Try again in a moment.",

  'route.minutes': '{minutes} min',
  'route.pace': 'at your pace',
  'route.option': 'Option {n}',
  'route.otherOptions': 'Other options',
  'route.source.bus-only': 'Bus only',
  'route.showOnMap': 'Show on map',

  'leg.walk': 'Walk ~{minutes} min at your pace',
  'leg.metro': '{line} towards {headsign}',
  'leg.metroNoDirection': '{line}',
  'leg.bus': 'Bus {line} towards {headsign}',
  'leg.busNoDirection': 'Bus {line}',
  'leg.rail': '{line}',
  'leg.stops': '{count} stops',
  'leg.express': '{color} route',
  'leg.express.roja': 'Red',
  'leg.express.verde': 'Green',

  'reason.status-unavailable': 'No elevator status data right now.',
  'reason.status-stale': 'Elevator data is {age} old: it may have changed.',
  'reason.stop-unmatched': 'We couldn\'t identify the station "{stop}".',
  'reason.mode-not-covered': 'We have no accessibility data for {line}.',
  'reason.no-known-elevator': 'We have no elevator on record at {station}.',
  'reason.elevator-out.yours': 'Elevator out of service at {station}, on your platform.',
  'reason.elevator-out.other':
    "Elevator on the opposite platform out of service at {station}. It probably doesn't affect you.",
  'reason.elevator-out.uncertain':
    "Elevator out of service at {station}. We don't know if it's your platform's.",
  'reason.elevator-status-missing': 'No information about an elevator at {station}.',
  'reason.escalator-out': 'Escalator out of service at {station}. The elevator works.',
  'reason.unknownStation': 'a station',

  'status.ok': 'Elevator status updated {age}.',
  'status.stale': "Elevator data hasn't updated for {age}. We can't confirm routes.",
  'status.degraded': "We couldn't refresh elevator status. Showing data from {age}.",
  'status.unavailable': "No elevator status data. We can't confirm routes.",
  'status.loading': 'Loading elevator status…',
  'status.ago': '{age} ago',

  'age.seconds': '{n} s',
  'age.minutes': '{n} min',
  'age.hours': '{n} h',
  'age.days': '{n} days',

  'map.label': 'Map of Santiago with the Metro network and elevator status',
  'map.unavailable': 'The map is unavailable. Route search still works.',
  'map.legend.ok': 'Elevators working',
  'map.legend.warning': 'Only an escalator out of service',
  'map.legend.blocked': 'Elevator out of service',
  'map.legend.unknown': 'No information',
  'map.attribution': 'Metro lines © OpenStreetMap contributors',

  'lang.switch': 'Español',
  'footer.credits': 'Elevator data: ariellopez.cl and seguimos.cl.',
}
