// Spanish (Chile): the default language. Every user-facing string lives here or in en.ts; a test
// checks both catalogues have the same keys. Placeholders are {name}.

export const es = {
  'app.title': 'RutaLibre',
  'app.tagline': 'Rutas accesibles en Metro y micro, según el estado real de ascensores',

  'search.origin': 'Desde',
  'search.destination': 'Hasta',
  'search.placeholder.origin': 'Calle, lugar o estación',
  'search.placeholder.destination': '¿A dónde vas?',
  'search.useLocation': 'Usar mi ubicación',
  'search.myLocation': 'Mi ubicación',
  'search.locating': 'Buscando tu ubicación…',
  'search.locationDenied': 'No tenemos permiso para usar tu ubicación. Escribe desde dónde sales.',
  'search.locationFailed': 'No pudimos obtener tu ubicación. Escribe desde dónde sales.',
  'search.swap': 'Intercambiar origen y destino',
  'search.submit': 'Buscar ruta accesible',
  'search.searching': 'Buscando…',
  'search.needBoth': 'Elige un origen y un destino de la lista.',
  'search.suggestions': 'Sugerencias para «{field}»',
  'search.noSuggestions': 'Sin resultados. Prueba con otra dirección o estación.',
  'search.suggestionsUnavailable': 'La búsqueda de lugares no está disponible ahora.',
  'search.freeText.label': 'O describe tu viaje',
  'search.freeText.placeholder': 'Ej: de Plaza de Armas al Hospital del Salvador',
  'search.freeText.submit': 'Interpretar',
  'search.freeText.failed': 'No pudimos entender el viaje. Usa los campos de arriba.',
  'search.voice.start': 'Dictar por voz',
  'search.voice.listening': 'Escuchando…',

  'verdict.ok': 'Accesible ahora',
  'verdict.warning': 'Accesible, con avisos',
  'verdict.blocked': 'No accesible',
  'verdict.unknown': 'No podemos confirmarlo',

  'outcome.accessible': 'Ruta accesible encontrada.',
  'outcome.rerouted': 'Ruta ajustada: evitamos estaciones con ascensores fuera de servicio.',
  'outcome.uncertain':
    'No podemos confirmar que alguna ruta sea accesible ahora. Revisa los avisos.',
  'outcome.noAccessible':
    'No encontramos una ruta accesible. Pide asistencia al personal de Metro en la estación.',
  'outcome.noRoute': 'No encontramos rutas en transporte público entre esos lugares.',
  'outcome.error': 'No pudimos buscar la ruta. Inténtalo de nuevo en un momento.',

  'route.duration': '{minutes} min a tu ritmo',
  'route.option': 'Opción {n}',
  'route.otherOptions': 'Otras opciones',
  'route.source.bus-only': 'Solo micro',
  'route.showOnMap': 'Ver en el mapa',

  'leg.walk': 'Caminar ~{minutes} min a tu ritmo',
  'leg.metro': '{line} dirección {headsign}',
  'leg.metroNoDirection': '{line}',
  'leg.bus': 'Micro {line} hacia {headsign}',
  'leg.busNoDirection': 'Micro {line}',
  'leg.rail': '{line}',
  'leg.fromTo': 'De {from} a {to}',
  'leg.stops': '{count} paradas',
  'leg.express': 'Ruta {color}',
  'leg.express.roja': 'Roja',
  'leg.express.verde': 'Verde',

  'reason.status-unavailable': 'No hay datos del estado de ascensores en este momento.',
  'reason.status-stale':
    'Los datos de ascensores tienen {age} de antigüedad: pueden haber cambiado.',
  'reason.stop-unmatched': 'No pudimos identificar la estación «{stop}».',
  'reason.mode-not-covered': 'No tenemos datos de accesibilidad para {line}.',
  'reason.no-known-elevator': 'No tenemos registro de ascensores en {station}.',
  'reason.elevator-out.yours': 'Ascensor fuera de servicio en {station}, en tu andén.',
  'reason.elevator-out.other':
    'Ascensor del andén contrario fuera de servicio en {station}. Probablemente no te afecta.',
  'reason.elevator-out.uncertain':
    'Ascensor fuera de servicio en {station}. No sabemos si es el de tu andén.',
  'reason.elevator-status-missing': 'Sin información de un ascensor en {station}.',
  'reason.escalator-out': 'Escalera mecánica fuera de servicio en {station}. El ascensor funciona.',
  'reason.unknownStation': 'una estación',

  'status.ok': 'Estado de ascensores actualizado {age}.',
  'status.stale':
    'Los datos de ascensores no se actualizan desde hace {age}. No podemos confirmar rutas.',
  'status.degraded': 'No pudimos actualizar el estado de ascensores. Mostramos datos de {age}.',
  'status.unavailable': 'No hay datos del estado de ascensores. No podemos confirmar rutas.',
  'status.loading': 'Cargando estado de ascensores…',
  'status.ago': 'hace {age}',

  'age.seconds': '{n} s',
  'age.minutes': '{n} min',
  'age.hours': '{n} h',
  'age.days': '{n} días',

  'map.label': 'Mapa de Santiago con la red de Metro y el estado de ascensores',
  'map.unavailable': 'El mapa no está disponible. La búsqueda de rutas sigue funcionando.',
  'map.legend.ok': 'Ascensores operativos',
  'map.legend.warning': 'Solo escalera fuera de servicio',
  'map.legend.blocked': 'Ascensor fuera de servicio',
  'map.legend.unknown': 'Sin información',
  'map.attribution': 'Líneas de Metro © colaboradores de OpenStreetMap',

  'lang.switch': 'English',
  'footer.credits': 'Datos de ascensores: ariellopez.cl y seguimos.cl.',
} as const

export type MessageKey = keyof typeof es
