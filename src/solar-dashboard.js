import { HABridge } from './ha-bridge.js';
import { SolarEngine, cloudTransmission } from './solar-engine.js';
import { WeatherFX } from './weather-fx.js';
import { ChartManager } from './charts.js';
import { STYLES } from './styles.js';

// ============ LOCALIZATION ============
// I12: Translation map keyed by hass.language. Falls back to 'en'.
const L = {
  en: {
    solar: 'Solar', live: 'Live', battery: 'Battery', powerFlow: 'Power Flow',
    solarPanels: 'Solar Panels', analytics: 'Analytics', controls: 'Controls',
    cellsC1C8: 'Cells C1\u2013C8', cellsC9C16: 'Cells C9\u2013C16',
    voltage: 'Voltage', current: 'Current', power: 'Power', remaining: 'Remaining',
    energy: 'Energy', todayIn: 'Today In', todayOut: 'Today Out',
    tte: 'Time to Empty', ttf: 'Time to Full',
    cycles: 'Cycles', capacity: 'Capacity', nominal: 'Nominal', config: 'Config',
    minCell: 'Min Cell', maxCell: 'Max Cell', runtime: 'Runtime', throughput: 'Throughput',
    mosfet: 'MOSFET', bmsModel: 'BMS Model', firmware: 'Firmware', chemistry: 'Chemistry',
    batteryNode: 'Battery', home: 'Home', solarNode: 'Solar',
    actual: 'actual', estimated: 'estimated', generatedToday: 'generated today', expected: 'expected',
    rated: 'Rated', installed: 'Installed', age: 'Age', model: 'Model',
    type: 'Type', year1Loss: 'Year 1 Loss', annualLoss: 'Annual Loss', nextYear: 'Next Year',
    weather: 'WEATHER', condition: 'Condition', temp: 'Temp', cloud: 'Cloud', humidity: 'Humidity',
    tabLive: 'Live', tabYesterday: 'Yesterday', tab7Days: '7 Days', tab30Days: '30 Days',
    chartPower: 'Power', chartBatterySOC: 'Battery SOC', chartSolar: 'Solar',
    legendActual: 'Actual', legendEstimated: 'Estimated',
    temperature: 'Temperature',
    charging: 'Charging', discharging: 'Discharging', idle: 'Idle', balancing: 'Balancing',
    ctrlCharging: 'Charging', ctrlDischarging: 'Discharging', ctrlBalancer: 'Balancer',
    descCharging: 'Enable or disable battery charging',
    descDischarging: 'Enable or disable battery discharging',
    balDisabled: 'Disabled', balOff: 'Balancer off',
    balActive: 'Actively transferring via supercap',
    balEnabledIdle: 'Enabled \u00B7 not currently balancing',
    sevenDAvg: '7d avg', west: 'W est',
    mVBalancing: 'mV \u2014 Balancing', mV: 'mV',
  },
  de: {
    solar: 'Solar', live: 'Live', battery: 'Batterie', powerFlow: 'Leistungsfluss',
    solarPanels: 'Solarmodule', analytics: 'Analytik', controls: 'Steuerung',
    cellsC1C8: 'Zellen C1\u2013C8', cellsC9C16: 'Zellen C9\u2013C16',
    voltage: 'Spannung', current: 'Strom', power: 'Leistung', remaining: 'Verbleibend',
    energy: 'Energie', todayIn: 'Heute rein', todayOut: 'Heute raus',
    tte: 'Zeit bis leer', ttf: 'Zeit bis voll',
    cycles: 'Zyklen', capacity: 'Kapazit\u00E4t', nominal: 'Nennspannung', config: 'Konfig',
    minCell: 'Min Zelle', maxCell: 'Max Zelle', runtime: 'Laufzeit', throughput: 'Durchsatz',
    mosfet: 'MOSFET', bmsModel: 'BMS Modell', firmware: 'Firmware', chemistry: 'Chemie',
    batteryNode: 'Batterie', home: 'Haus', solarNode: 'Solar',
    actual: 'aktuell', estimated: 'gesch\u00E4tzt', generatedToday: 'heute erzeugt', expected: 'erwartet',
    rated: 'Nennleistung', installed: 'Installiert', age: 'Alter', model: 'Modell',
    type: 'Typ', year1Loss: 'Jahr 1 Verlust', annualLoss: 'J\u00E4hrl. Verlust', nextYear: 'N\u00E4chstes Jahr',
    weather: 'WETTER', condition: 'Bedingung', temp: 'Temp', cloud: 'Bew\u00F6lkung', humidity: 'Feuchtigkeit',
    tabLive: 'Live', tabYesterday: 'Gestern', tab7Days: '7 Tage', tab30Days: '30 Tage',
    chartPower: 'Leistung', chartBatterySOC: 'Batterie SOC', chartSolar: 'Solar',
    legendActual: 'Aktuell', legendEstimated: 'Gesch\u00E4tzt',
    temperature: 'Temperatur',
    charging: 'Laden', discharging: 'Entladen', idle: 'Leerlauf', balancing: 'Ausgleich',
    ctrlCharging: 'Laden', ctrlDischarging: 'Entladen', ctrlBalancer: 'Ausgleicher',
    descCharging: 'Batterieladen aktivieren oder deaktivieren',
    descDischarging: 'Batterieentladen aktivieren oder deaktivieren',
    balDisabled: 'Deaktiviert', balOff: 'Ausgleicher aus',
    balActive: 'Aktiv \u00FCbertragen via Supercap',
    balEnabledIdle: 'Aktiviert \u00B7 derzeit kein Ausgleich',
    sevenDAvg: '7d \u00D8', west: 'W est',
    mVBalancing: 'mV \u2014 Ausgleich', mV: 'mV',
  },
  fr: {
    solar: 'Solaire', live: 'Direct', battery: 'Batterie', powerFlow: 'Flux d\'\u00E9nergie',
    solarPanels: 'Panneaux solaires', analytics: 'Analytique', controls: 'Contr\u00F4les',
    cellsC1C8: 'Cellules C1\u2013C8', cellsC9C16: 'Cellules C9\u2013C16',
    voltage: 'Tension', current: 'Courant', power: 'Puissance', remaining: 'Restant',
    energy: '\u00C9nergie', todayIn: 'Aujourd\'hui entr\u00E9e', todayOut: 'Aujourd\'hui sortie',
    tte: 'Temps avant vide', ttf: 'Temps avant plein',
    cycles: 'Cycles', capacity: 'Capacit\u00E9', nominal: 'Nominale', config: 'Config',
    minCell: 'Cell min', maxCell: 'Cell max', runtime: 'Dur\u00E9e', throughput: 'D\u00E9bit',
    mosfet: 'MOSFET', bmsModel: 'Mod\u00E8le BMS', firmware: 'Firmware', chemistry: 'Chimie',
    batteryNode: 'Batterie', home: 'Maison', solarNode: 'Solaire',
    actual: 'actuel', estimated: 'estim\u00E9', generatedToday: 'produit aujourd\'hui', expected: 'pr\u00E9vu',
    rated: 'Nominale', installed: 'Install\u00E9', age: '\u00C2ge', model: 'Mod\u00E8le',
    type: 'Type', year1Loss: 'Perte an 1', annualLoss: 'Perte annuelle', nextYear: 'Ann\u00E9e proch.',
    weather: 'M\u00C9T\u00C9O', condition: 'Condition', temp: 'Temp', cloud: 'Nuages', humidity: 'Humidit\u00E9',
    tabLive: 'Direct', tabYesterday: 'Hier', tab7Days: '7 jours', tab30Days: '30 jours',
    chartPower: 'Puissance', chartBatterySOC: 'Batterie SOC', chartSolar: 'Solaire',
    legendActual: 'Actuel', legendEstimated: 'Estim\u00E9',
    temperature: 'Temp\u00E9rature',
    charging: 'Charge', discharging: 'D\u00E9charge', idle: 'Inactif', balancing: '\u00C9quilibrage',
    ctrlCharging: 'Charge', ctrlDischarging: 'D\u00E9charge', ctrlBalancer: '\u00C9quilibreur',
    descCharging: 'Activer ou d\u00E9sactiver la charge de la batterie',
    descDischarging: 'Activer ou d\u00E9sactiver la d\u00E9charge de la batterie',
    balDisabled: 'D\u00E9sactiv\u00E9', balOff: '\u00C9quilibreur \u00E9teint',
    balActive: 'Transfert actif via supercondensateur',
    balEnabledIdle: 'Activ\u00E9 \u00B7 pas d\'\u00E9quilibrage actuel',
    sevenDAvg: '7j moy', west: 'O est',
    mVBalancing: 'mV \u2014 \u00C9quilibrage', mV: 'mV',
  },
  es: {
    solar: 'Solar', live: 'En vivo', battery: 'Bater\u00EDa', powerFlow: 'Flujo de energ\u00EDa',
    solarPanels: 'Paneles solares', analytics: 'An\u00E1lisis', controls: 'Controles',
    cellsC1C8: 'Celdas C1\u2013C8', cellsC9C16: 'Celdas C9\u2013C16',
    voltage: 'Voltaje', current: 'Corriente', power: 'Potencia', remaining: 'Restante',
    energy: 'Energ\u00EDa', todayIn: 'Hoy entrada', todayOut: 'Hoy salida',
    tte: 'Tiempo hasta vac\u00EDo', ttf: 'Tiempo hasta lleno',
    cycles: 'Ciclos', capacity: 'Capacidad', nominal: 'Nominal', config: 'Config',
    minCell: 'Celda m\u00EDn', maxCell: 'Celda m\u00E1x', runtime: 'Duraci\u00F3n', throughput: 'Rendimiento',
    mosfet: 'MOSFET', bmsModel: 'Modelo BMS', firmware: 'Firmware', chemistry: 'Qu\u00EDmica',
    batteryNode: 'Bater\u00EDa', home: 'Hogar', solarNode: 'Solar',
    actual: 'actual', estimated: 'estimado', generatedToday: 'generado hoy', expected: 'esperado',
    rated: 'Nominal', installed: 'Instalado', age: 'Edad', model: 'Modelo',
    type: 'Tipo', year1Loss: 'P\u00E9rdida a\u00F1o 1', annualLoss: 'P\u00E9rdida anual', nextYear: 'Pr\u00F3x. a\u00F1o',
    weather: 'CLIMA', condition: 'Condici\u00F3n', temp: 'Temp', cloud: 'Nubes', humidity: 'Humedad',
    tabLive: 'En vivo', tabYesterday: 'Ayer', tab7Days: '7 d\u00EDas', tab30Days: '30 d\u00EDas',
    chartPower: 'Potencia', chartBatterySOC: 'Bater\u00EDa SOC', chartSolar: 'Solar',
    legendActual: 'Actual', legendEstimated: 'Estimado',
    temperature: 'Temperatura',
    charging: 'Carga', discharging: 'Descarga', idle: 'Inactivo', balancing: 'Equilibrio',
    ctrlCharging: 'Carga', ctrlDischarging: 'Descarga', ctrlBalancer: 'Equilibrador',
    descCharging: 'Activar o desactivar carga de bater\u00EDa',
    descDischarging: 'Activar o desactivar descarga de bater\u00EDa',
    balDisabled: 'Desactivado', balOff: 'Equilibrador apagado',
    balActive: 'Transferencia activa v\u00EDa supercapacitor',
    balEnabledIdle: 'Activado \u00B7 sin equilibrio actual',
    sevenDAvg: '7d prom', west: 'O est',
    mVBalancing: 'mV \u2014 Equilibrio', mV: 'mV',
  },
  it: {
    solar: 'Solare', live: 'Live', battery: 'Batteria', powerFlow: 'Flusso energia',
    solarPanels: 'Pannelli solari', analytics: 'Analisi', controls: 'Controlli',
    cellsC1C8: 'Celle C1\u2013C8', cellsC9C16: 'Celle C9\u2013C16',
    voltage: 'Tensione', current: 'Corrente', power: 'Potenza', remaining: 'Rimanente',
    energy: 'Energia', todayIn: 'Oggi entrata', todayOut: 'Oggi uscita',
    tte: 'Tempo a vuoto', ttf: 'Tempo a pieno',
    cycles: 'Cicli', capacity: 'Capacit\u00E0', nominal: 'Nominale', config: 'Config',
    minCell: 'Cella min', maxCell: 'Cella max', runtime: 'Durata', throughput: 'Throughput',
    mosfet: 'MOSFET', bmsModel: 'Modello BMS', firmware: 'Firmware', chemistry: 'Chimica',
    batteryNode: 'Batteria', home: 'Casa', solarNode: 'Solare',
    actual: 'attuale', estimated: 'stimato', generatedToday: 'generato oggi', expected: 'previsto',
    rated: 'Nominale', installed: 'Installato', age: 'Et\u00E0', model: 'Modello',
    type: 'Tipo', year1Loss: 'Perdita anno 1', annualLoss: 'Perdita annuale', nextYear: 'Pross. anno',
    weather: 'METEO', condition: 'Condizione', temp: 'Temp', cloud: 'Nuvole', humidity: 'Umidit\u00E0',
    tabLive: 'Live', tabYesterday: 'Ieri', tab7Days: '7 giorni', tab30Days: '30 giorni',
    chartPower: 'Potenza', chartBatterySOC: 'Batteria SOC', chartSolar: 'Solare',
    legendActual: 'Attuale', legendEstimated: 'Stimato',
    temperature: 'Temperatura',
    charging: 'Carica', discharging: 'Scarica', idle: 'Inattivo', balancing: 'Bilanciamento',
    ctrlCharging: 'Carica', ctrlDischarging: 'Scarica', ctrlBalancer: 'Bilanciatore',
    descCharging: 'Abilita o disabilita carica batteria',
    descDischarging: 'Abilita o disabilita scarica batteria',
    balDisabled: 'Disabilitato', balOff: 'Bilanciatore spento',
    balActive: 'Trasferimento attivo tramite supercap',
    balEnabledIdle: 'Abilitato \u00B7 nessun bilanciamento attuale',
    sevenDAvg: '7g media', west: 'O est',
    mVBalancing: 'mV \u2014 Bilanciamento', mV: 'mV',
  },
  nl: {
    solar: 'Zonne', live: 'Live', battery: 'Batterij', powerFlow: 'Energieverloop',
    solarPanels: 'Zonnepanelen', analytics: 'Analyse', controls: 'Bediening',
    cellsC1C8: 'Cellen C1\u2013C8', cellsC9C16: 'Cellen C9\u2013C16',
    voltage: 'Spanning', current: 'Stroom', power: 'Vermogen', remaining: 'Resterend',
    energy: 'Energie', todayIn: 'Vandaag in', todayOut: 'Vandaag uit',
    tte: 'Tijd tot leeg', ttf: 'Tijd tot vol',
    cycles: 'Cycli', capacity: 'Capaciteit', nominal: 'Nominaal', config: 'Config',
    minCell: 'Cel min', maxCell: 'Cel max', runtime: 'Looptijd', throughput: 'Doorvoer',
    mosfet: 'MOSFET', bmsModel: 'BMS Model', firmware: 'Firmware', chemistry: 'Chemie',
    batteryNode: 'Batterij', home: 'Huis', solarNode: 'Zonne',
    actual: 'actueel', estimated: 'geschat', generatedToday: 'vandaag opgewekt', expected: 'verwacht',
    rated: 'Nominaal', installed: 'Ge\u00EFnstalleerd', age: 'Leeftijd', model: 'Model',
    type: 'Type', year1Loss: 'Verlies jaar 1', annualLoss: 'Jaarlijks verlies', nextYear: 'Volgend jaar',
    weather: 'WEER', condition: 'Weer', temp: 'Temp', cloud: 'Bewolking', humidity: 'Luchtvochtigheid',
    tabLive: 'Live', tabYesterday: 'Gisteren', tab7Days: '7 dagen', tab30Days: '30 dagen',
    chartPower: 'Vermogen', chartBatterySOC: 'Batterij SOC', chartSolar: 'Zonne',
    legendActual: 'Actueel', legendEstimated: 'Geschat',
    temperature: 'Temperatuur',
    charging: 'Laden', discharging: 'Ontladen', idle: 'Inactief', balancing: 'Balancering',
    ctrlCharging: 'Laden', ctrlDischarging: 'Ontladen', ctrlBalancer: 'Balancer',
    descCharging: 'Batterijlading in- of uitschakelen',
    descDischarging: 'Batterijontlading in- of uitschakelen',
    balDisabled: 'Uitgeschakeld', balOff: 'Balancer uit',
    balActive: 'Actief overdragen via supercondensator',
    balEnabledIdle: 'Ingeschakeld \u00B7 momenteel geen balancering',
    sevenDAvg: '7d gem', west: 'W est',
    mVBalancing: 'mV \u2014 Balancering', mV: 'mV',
  },
  pt: {
    solar: 'Solar', live: 'Ao vivo', battery: 'Bateria', powerFlow: 'Fluxo de energia',
    solarPanels: 'Pain\u00E9is solares', analytics: 'An\u00E1lise', controls: 'Controles',
    cellsC1C8: 'C\u00E9lulas C1\u2013C8', cellsC9C16: 'C\u00E9lulas C9\u2013C16',
    voltage: 'Tens\u00E3o', current: 'Corrente', power: 'Pot\u00EAncia', remaining: 'Restante',
    energy: 'Energia', todayIn: 'Hoje entrada', todayOut: 'Hoje sa\u00EDda',
    tte: 'Tempo at\u00E9 vazio', ttf: 'Tempo at\u00E9 cheio',
    cycles: 'Ciclos', capacity: 'Capacidade', nominal: 'Nominal', config: 'Config',
    minCell: 'C\u00E9l min', maxCell: 'C\u00E9l m\u00E1x', runtime: 'Dura\u00E7\u00E3o', throughput: 'Rendimento',
    mosfet: 'MOSFET', bmsModel: 'Modelo BMS', firmware: 'Firmware', chemistry: 'Qu\u00EDmica',
    batteryNode: 'Bateria', home: 'Casa', solarNode: 'Solar',
    actual: 'atual', estimated: 'estimado', generatedToday: 'gerado hoje', expected: 'esperado',
    rated: 'Nominal', installed: 'Instalado', age: 'Idade', model: 'Modelo',
    type: 'Tipo', year1Loss: 'Perda ano 1', annualLoss: 'Perda anual', nextYear: 'Pr\u00F3x. ano',
    weather: 'CLIMA', condition: 'Condi\u00E7\u00E3o', temp: 'Temp', cloud: 'Nuvens', humidity: 'Umidade',
    tabLive: 'Ao vivo', tabYesterday: 'Ontem', tab7Days: '7 dias', tab30Days: '30 dias',
    chartPower: 'Pot\u00EAncia', chartBatterySOC: 'Bateria SOC', chartSolar: 'Solar',
    legendActual: 'Atual', legendEstimated: 'Estimado',
    temperature: 'Temperatura',
    charging: 'Carga', discharging: 'Descarga', idle: 'Inativo', balancing: 'Balanceamento',
    ctrlCharging: 'Carga', ctrlDischarging: 'Descarga', ctrlBalancer: 'Balanceador',
    descCharging: 'Ativar ou desativar carga da bateria',
    descDischarging: 'Ativar ou desativar descarga da bateria',
    balDisabled: 'Desativado', balOff: 'Balanceador desligado',
    balActive: 'Transfer\u00EAncia ativa via supercapacitor',
    balEnabledIdle: 'Ativado \u00B7 sem balanceamento atual',
    sevenDAvg: '7d m\u00E9d', west: 'O est',
    mVBalancing: 'mV \u2014 Balanceamento', mV: 'mV',
  },
  'pt-BR': {
    solar: 'Solar', live: 'Ao vivo', battery: 'Bateria', powerFlow: 'Fluxo de energia',
    solarPanels: 'Pain\u00E9is solares', analytics: 'An\u00E1lise', controls: 'Controles',
    cellsC1C8: 'C\u00E9lulas C1\u2013C8', cellsC9C16: 'C\u00E9lulas C9\u2013C16',
    voltage: 'Tens\u00E3o', current: 'Corrente', power: 'Pot\u00EAncia', remaining: 'Restante',
    energy: 'Energia', todayIn: 'Hoje entrada', todayOut: 'Hoje sa\u00EDda',
    tte: 'Tempo at\u00E9 vazio', ttf: 'Tempo at\u00E9 cheio',
    cycles: 'Ciclos', capacity: 'Capacidade', nominal: 'Nominal', config: 'Config',
    minCell: 'C\u00E9l min', maxCell: 'C\u00E9l m\u00E1x', runtime: 'Dura\u00E7\u00E3o', throughput: 'Rendimento',
    mosfet: 'MOSFET', bmsModel: 'Modelo BMS', firmware: 'Firmware', chemistry: 'Qu\u00EDmica',
    batteryNode: 'Bateria', home: 'Casa', solarNode: 'Solar',
    actual: 'atual', estimated: 'estimado', generatedToday: 'gerado hoje', expected: 'esperado',
    rated: 'Nominal', installed: 'Instalado', age: 'Idade', model: 'Modelo',
    type: 'Tipo', year1Loss: 'Perda ano 1', annualLoss: 'Perda anual', nextYear: 'Pr\u00F3x. ano',
    weather: 'CLIMA', condition: 'Condi\u00E7\u00E3o', temp: 'Temp', cloud: 'Nuvens', humidity: 'Umidade',
    tabLive: 'Ao vivo', tabYesterday: 'Ontem', tab7Days: '7 dias', tab30Days: '30 dias',
    chartPower: 'Pot\u00EAncia', chartBatterySOC: 'Bateria SOC', chartSolar: 'Solar',
    legendActual: 'Atual', legendEstimated: 'Estimado',
    temperature: 'Temperatura',
    charging: 'Carga', discharging: 'Descarga', idle: 'Inativo', balancing: 'Balanceamento',
    ctrlCharging: 'Carga', ctrlDischarging: 'Descarga', ctrlBalancer: 'Balanceador',
    descCharging: 'Ativar ou desativar carga da bateria',
    descDischarging: 'Ativar ou desativar descarga da bateria',
    balDisabled: 'Desativado', balOff: 'Balanceador desligado',
    balActive: 'Transfer\u00EAncia ativa via supercapacitor',
    balEnabledIdle: 'Ativado \u00B7 sem balanceamento atual',
    sevenDAvg: '7d m\u00E9d', west: 'O est',
    mVBalancing: 'mV \u2014 Balanceamento', mV: 'mV',
  },
  sv: {
    solar: 'Sol', live: 'Live', battery: 'Batteri', powerFlow: 'Energifl\u00F6de',
    solarPanels: 'Solpaneler', analytics: 'Analys', controls: 'Kontroller',
    cellsC1C8: 'Celler C1\u2013C8', cellsC9C16: 'Celler C9\u2013C16',
    voltage: 'Sp\u00E4nning', current: 'Str\u00F6m', power: 'Effekt', remaining: '\u00C5terst\u00E5ende',
    energy: 'Energi', todayIn: 'Idag in', todayOut: 'Idag ut',
    tte: 'Tid till tomt', ttf: 'Tid till fullt',
    cycles: 'Cykler', capacity: 'Kapacitet', nominal: 'Nominell', config: 'Konfig',
    minCell: 'Cell min', maxCell: 'Cell max', runtime: 'Drifttid', throughput: 'Genomstr\u00F6mning',
    mosfet: 'MOSFET', bmsModel: 'BMS Modell', firmware: 'Firmware', chemistry: 'Kemi',
    batteryNode: 'Batteri', home: 'Hem', solarNode: 'Sol',
    actual: 'aktuell', estimated: 'uppskattad', generatedToday: 'genererad idag', expected: 'f\u00F6rv\u00E4ntad',
    rated: 'Nominell', installed: 'Installerad', age: '\u00C5lder', model: 'Modell',
    type: 'Typ', year1Loss: 'F\u00F6rlust \u00E5r 1', annualLoss: '\u00C5rlig f\u00F6rlust', nextYear: 'N\u00E4sta \u00E5r',
    weather: 'V\u00C4DER', condition: 'F\u00F6rh\u00E5llande', temp: 'Temp', cloud: 'Moln', humidity: 'Luftfuktighet',
    tabLive: 'Live', tabYesterday: 'Ig\u00E5r', tab7Days: '7 dagar', tab30Days: '30 dagar',
    chartPower: 'Effekt', chartBatterySOC: 'Batteri SOC', chartSolar: 'Sol',
    legendActual: 'Aktuell', legendEstimated: 'Uppskattad',
    temperature: 'Temperatur',
    charging: 'Laddning', discharging: 'Urladdning', idle: 'Inaktiv', balancing: 'Balansering',
    ctrlCharging: 'Laddning', ctrlDischarging: 'Urladdning', ctrlBalancer: 'Balanserare',
    descCharging: 'Aktivera eller inaktivera batteriladdning',
    descDischarging: 'Aktivera eller inaktivera batteriurladdning',
    balDisabled: 'Inaktiverad', balOff: 'Balanserare av',
    balActive: 'Aktiv \u00F6verf\u00F6ring via superkondensator',
    balEnabledIdle: 'Aktiverad \u00B7 ingen balansering just nu',
    sevenDAvg: '7d snitt', west: 'V est',
    mVBalancing: 'mV \u2014 Balansering', mV: 'mV',
  },
  no: {
    solar: 'Sol', live: 'Live', battery: 'Batteri', powerFlow: 'Energiflyt',
    solarPanels: 'Solpaneler', analytics: 'Analyse', controls: 'Kontroller',
    cellsC1C8: 'Celler C1\u2013C8', cellsC9C16: 'Celler C9\u2013C16',
    voltage: 'Spenning', current: 'Str\u00F8m', power: 'Effekt', remaining: 'Gjenst\u00E5ende',
    energy: 'Energi', todayIn: 'I dag inn', todayOut: 'I dag ut',
    tte: 'Tid til tomt', ttf: 'Tid til fullt',
    cycles: 'Sykluser', capacity: 'Kapasitet', nominal: 'Nominell', config: 'Konfig',
    minCell: 'Celle min', maxCell: 'Celle maks', runtime: 'Driftstid', throughput: 'Gjennomstr\u00F8mning',
    mosfet: 'MOSFET', bmsModel: 'BMS Modell', firmware: 'Firmware', chemistry: 'Kjemi',
    batteryNode: 'Batteri', home: 'Hjem', solarNode: 'Sol',
    actual: 'faktisk', estimated: 'estimert', generatedToday: 'generert i dag', expected: 'forventet',
    rated: 'Nominell', installed: 'Installert', age: 'Alder', model: 'Modell',
    type: 'Type', year1Loss: 'Tap \u00E5r 1', annualLoss: '\u00C5rlig tap', nextYear: 'Neste \u00E5r',
    weather: 'V\u00C6R', condition: 'Forhold', temp: 'Temp', cloud: 'Skyer', humidity: 'Luftfuktighet',
    tabLive: 'Live', tabYesterday: 'I g\u00E5r', tab7Days: '7 dager', tab30Days: '30 dager',
    chartPower: 'Effekt', chartBatterySOC: 'Batteri SOC', chartSolar: 'Sol',
    legendActual: 'Faktisk', legendEstimated: 'Estimert',
    temperature: 'Temperatur',
    charging: 'Lading', discharging: 'Utlading', idle: 'Inaktiv', balancing: 'Balansering',
    ctrlCharging: 'Lading', ctrlDischarging: 'Utlading', ctrlBalancer: 'Balanserer',
    descCharging: 'Aktiver eller deaktiver batterilading',
    descDischarging: 'Aktiver eller deaktiver batteriutlading',
    balDisabled: 'Deaktivert', balOff: 'Balanserer av',
    balActive: 'Aktiv overf\u00F8ring via superkondensator',
    balEnabledIdle: 'Aktivert \u00B7 ingen balansering n\u00E5',
    sevenDAvg: '7d snitt', west: 'V est',
    mVBalancing: 'mV \u2014 Balansering', mV: 'mV',
  },
  da: {
    solar: 'Sol', live: 'Live', battery: 'Batteri', powerFlow: 'Energiflow',
    solarPanels: 'Solpaneler', analytics: 'Analyse', controls: 'Kontroller',
    cellsC1C8: 'Celler C1\u2013C8', cellsC9C16: 'Celler C9\u2013C16',
    voltage: 'Sp\u00E6nding', current: 'Str\u00F8m', power: 'Effekt', remaining: 'Resterende',
    energy: 'Energi', todayIn: 'I dag ind', todayOut: 'I dag ud',
    tte: 'Tid til tom', ttf: 'Tid til fuld',
    cycles: 'Cyklusser', capacity: 'Kapacitet', nominal: 'Nominel', config: 'Konfig',
    minCell: 'Celle min', maxCell: 'Celle maks', runtime: 'Driftstid', throughput: 'Gennemstr\u00F8mning',
    mosfet: 'MOSFET', bmsModel: 'BMS Model', firmware: 'Firmware', chemistry: 'Kemi',
    batteryNode: 'Batteri', home: 'Hjem', solarNode: 'Sol',
    actual: 'faktisk', estimated: 'estimeret', generatedToday: 'genereret i dag', expected: 'forventet',
    rated: 'Nominel', installed: 'Installeret', age: 'Alder', model: 'Model',
    type: 'Type', year1Loss: 'Tab \u00E5r 1', annualLoss: '\u00C5rligt tab', nextYear: 'N\u00E6ste \u00E5r',
    weather: 'VEJR', condition: 'Forhold', temp: 'Temp', cloud: 'Skyer', humidity: 'Luftfugtighed',
    tabLive: 'Live', tabYesterday: 'I g\u00E5r', tab7Days: '7 dage', tab30Days: '30 dage',
    chartPower: 'Effekt', chartBatterySOC: 'Batteri SOC', chartSolar: 'Sol',
    legendActual: 'Faktisk', legendEstimated: 'Estimeret',
    temperature: 'Temperatur',
    charging: 'Opladning', discharging: 'Afladning', idle: 'Inaktiv', balancing: 'Balancering',
    ctrlCharging: 'Opladning', ctrlDischarging: 'Afladning', ctrlBalancer: 'Balancer',
    descCharging: 'Aktiver eller deaktiver batteriopladning',
    descDischarging: 'Aktiver eller deaktiver batteriafladning',
    balDisabled: 'Deaktiveret', balOff: 'Balancer slukket',
    balActive: 'Aktiv overf\u00F8rsel via superkondensator',
    balEnabledIdle: 'Aktiveret \u00B7 ingen balancering lige nu',
    sevenDAvg: '7d snit', west: 'V est',
    mVBalancing: 'mV \u2014 Balancering', mV: 'mV',
  },
  fi: {
    solar: 'Aurinko', live: 'Live', battery: 'Akku', powerFlow: 'Tehonkulku',
    solarPanels: 'Aurinkopaneelit', analytics: 'Analytiikka', controls: 'Ohjaukset',
    cellsC1C8: 'Kennot C1\u2013C8', cellsC9C16: 'Kennot C9\u2013C16',
    voltage: 'J\u00E4nnite', current: 'Virta', power: 'Teho', remaining: 'J\u00E4ljell\u00E4',
    energy: 'Energia', todayIn: 'T\u00E4n\u00E4\u00E4n sis\u00E4\u00E4n', todayOut: 'T\u00E4n\u00E4\u00E4n ulos',
    tte: 'Aika tyhj\u00E4\u00E4n', ttf: 'Aika t\u00E4yteen',
    cycles: 'Jaksot', capacity: 'Kapasiteetti', nominal: 'Nimellinen', config: 'Konfig',
    minCell: 'Kenno min', maxCell: 'Kenno maks', runtime: 'K\u00E4ytt\u00F6aika', throughput: 'L\u00E4pivirtaus',
    mosfet: 'MOSFET', bmsModel: 'BMS Malli', firmware: 'Firmware', chemistry: 'Kemia',
    batteryNode: 'Akku', home: 'Koti', solarNode: 'Aurinko',
    actual: 'todellinen', estimated: 'arvioitu', generatedToday: 'tuotettu t\u00E4n\u00E4\u00E4n', expected: 'odotettu',
    rated: 'Nimellinen', installed: 'Asennettu', age: 'Ik\u00E4', model: 'Malli',
    type: 'Tyyppi', year1Loss: 'H\u00E4vi\u00F6 vuosi 1', annualLoss: 'Vuotuinen h\u00E4vi\u00F6', nextYear: 'Ensi vuosi',
    weather: 'S\u00C4\u00C4', condition: 'S\u00E4\u00E4', temp: 'L\u00E4mp\u00F6', cloud: 'Pilvet', humidity: 'Kosteus',
    tabLive: 'Live', tabYesterday: 'Eilen', tab7Days: '7 p\u00E4iv\u00E4\u00E4', tab30Days: '30 p\u00E4iv\u00E4\u00E4',
    chartPower: 'Teho', chartBatterySOC: 'Akku SOC', chartSolar: 'Aurinko',
    legendActual: 'Todellinen', legendEstimated: 'Arvioitu',
    temperature: 'L\u00E4mp\u00F6tila',
    charging: 'Lataus', discharging: 'Purku', idle: 'Lepotila', balancing: 'Tasaus',
    ctrlCharging: 'Lataus', ctrlDischarging: 'Purku', ctrlBalancer: 'Tasaaja',
    descCharging: 'Ota akun lataus k\u00E4ytt\u00F6\u00F6n tai poista se k\u00E4yt\u00F6st\u00E4',
    descDischarging: 'Ota akun purku k\u00E4ytt\u00F6\u00F6n tai poista se k\u00E4yt\u00F6st\u00E4',
    balDisabled: 'Poistettu k\u00E4yt\u00F6st\u00E4', balOff: 'Tasaaja pois p\u00E4\u00E4lt\u00E4',
    balActive: 'Aktiivinen siirto superkondensaattorin kautta',
    balEnabledIdle: 'K\u00E4yt\u00F6ss\u00E4 \u00B7 ei tasausta t\u00E4ll\u00E4 hetkell\u00E4',
    sevenDAvg: '7pv keski', west: 'L est',
    mVBalancing: 'mV \u2014 Tasaus', mV: 'mV',
  },
  pl: {
    solar: 'Solar', live: 'Na \u017Cywo', battery: 'Bateria', powerFlow: 'Przep\u0142yw energii',
    solarPanels: 'Panele s\u0142oneczne', analytics: 'Analityka', controls: 'Sterowanie',
    cellsC1C8: 'Cele C1\u2013C8', cellsC9C16: 'Cele C9\u2013C16',
    voltage: 'Napi\u0119cie', current: 'Pr\u0105d', power: 'Moc', remaining: 'Pozosta\u0142o',
    energy: 'Energia', todayIn: 'Dzi\u015B wej\u015Bcie', todayOut: 'Dzi\u015B wyj\u015Bcie',
    tte: 'Czas do roz\u0142adowania', ttf: 'Czas do na\u0142adowania',
    cycles: 'Cykle', capacity: 'Pojemno\u015B\u0107', nominal: 'Nominalne', config: 'Konfig',
    minCell: 'Cel min', maxCell: 'Cel maks', runtime: 'Czas pracy', throughput: 'Przepustowo\u015B\u0107',
    mosfet: 'MOSFET', bmsModel: 'Model BMS', firmware: 'Firmware', chemistry: 'Chemia',
    batteryNode: 'Bateria', home: 'Dom', solarNode: 'Solar',
    actual: 'rzeczywisty', estimated: 'szacowany', generatedToday: 'wytworzono dzi\u015B', expected: 'oczekiwany',
    rated: 'Nominalna', installed: 'Zainstalowano', age: 'Wiek', model: 'Model',
    type: 'Typ', year1Loss: 'Ubytek rok 1', annualLoss: 'Ubytek roczny', nextYear: 'Nast\u0119pny rok',
    weather: 'POGODA', condition: 'Warunki', temp: 'Temp', cloud: 'Chmury', humidity: 'Wilgotno\u015B\u0107',
    tabLive: 'Na \u017Cywo', tabYesterday: 'Wczoraj', tab7Days: '7 dni', tab30Days: '30 dni',
    chartPower: 'Moc', chartBatterySOC: 'Bateria SOC', chartSolar: 'Solar',
    legendActual: 'Rzeczywisty', legendEstimated: 'Szacowany',
    temperature: 'Temperatura',
    charging: '\u0141adowanie', discharging: 'Roz\u0142adowanie', idle: 'Bezczynny', balancing: 'Balansowanie',
    ctrlCharging: '\u0141adowanie', ctrlDischarging: 'Roz\u0142adowanie', ctrlBalancer: 'Balanser',
    descCharging: 'W\u0142\u0105cz lub wy\u0142\u0105cz \u0142adowanie baterii',
    descDischarging: 'W\u0142\u0105cz lub wy\u0142\u0105cz roz\u0142adowanie baterii',
    balDisabled: 'Wy\u0142\u0105czony', balOff: 'Balanser wy\u0142\u0105czony',
    balActive: 'Aktywny transfer przez superkondensator',
    balEnabledIdle: 'W\u0142\u0105czony \u00B7 brak balansowania',
    sevenDAvg: '7d \u015Br', west: 'Z est',
    mVBalancing: 'mV \u2014 Balansowanie', mV: 'mV',
  },
  ru: {
    solar: '\u0421\u043E\u043B\u043D\u0435\u0447\u043D\u0430\u044F', live: '\u041B\u0430\u0439\u0432', battery: '\u0410\u043A\u043A\u0443\u043C\u0443\u043B\u044F\u0442\u043E\u0440', powerFlow: '\u041F\u043E\u0442\u043E\u043A \u044D\u043D\u0435\u0440\u0433\u0438\u0438',
    solarPanels: '\u0421\u043E\u043B\u043D\u0435\u0447\u043D\u044B\u0435 \u043F\u0430\u043D\u0435\u043B\u0438', analytics: '\u0410\u043D\u0430\u043B\u0438\u0442\u0438\u043A\u0430', controls: '\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435',
    cellsC1C8: '\u042F\u0447\u0435\u0439\u043A\u0438 C1\u2013C8', cellsC9C16: '\u042F\u0447\u0435\u0439\u043A\u0438 C9\u2013C16',
    voltage: '\u041D\u0430\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435', current: '\u0422\u043E\u043A', power: '\u041C\u043E\u0449\u043D\u043E\u0441\u0442\u044C', remaining: '\u041E\u0441\u0442\u0430\u043B\u043E\u0441\u044C',
    energy: '\u042D\u043D\u0435\u0440\u0433\u0438\u044F', todayIn: '\u0421\u0435\u0433\u043E\u0434\u043D\u044F \u0432\u0445\u043E\u0434', todayOut: '\u0421\u0435\u0433\u043E\u0434\u043D\u044F \u0432\u044B\u0445\u043E\u0434',
    tte: '\u0412\u0440\u0435\u043C\u044F \u0434\u043E \u0440\u0430\u0437\u0440\u044F\u0434\u0430', ttf: '\u0412\u0440\u0435\u043C\u044F \u0434\u043E \u0437\u0430\u0440\u044F\u0434\u0430',
    cycles: '\u0426\u0438\u043A\u043B\u044B', capacity: '\u0401\u043C\u043A\u043E\u0441\u0442\u044C', nominal: '\u041D\u043E\u043C\u0438\u043D\u0430\u043B', config: '\u041A\u043E\u043D\u0444\u0438\u0433',
    minCell: '\u042F\u0447\u0435\u0439\u043A\u0430 \u043C\u0438\u043D', maxCell: '\u042F\u0447\u0435\u0439\u043A\u0430 \u043C\u0430\u043A\u0441', runtime: '\u0412\u0440\u0435\u043C\u044F \u0440\u0430\u0431\u043E\u0442\u044B', throughput: '\u041F\u0440\u043E\u043F\u0443\u0441\u043A\u043D\u0430\u044F \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C',
    mosfet: 'MOSFET', bmsModel: '\u041C\u043E\u0434\u0435\u043B\u044C BMS', firmware: '\u041F\u0440\u043E\u0448\u0438\u0432\u043A\u0430', chemistry: '\u0425\u0438\u043C\u0438\u044F',
    batteryNode: '\u0410\u043A\u043A\u0443\u043C\u0443\u043B\u044F\u0442\u043E\u0440', home: '\u0414\u043E\u043C', solarNode: '\u0421\u043E\u043B\u043D\u0435\u0447\u043D\u0430\u044F',
    actual: '\u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439', estimated: '\u043E\u0446\u0435\u043D\u043E\u0447\u043D\u044B\u0439', generatedToday: '\u0432\u044B\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E \u0441\u0435\u0433\u043E\u0434\u043D\u044F', expected: '\u043E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F',
    rated: '\u041D\u043E\u043C\u0438\u043D\u0430\u043B\u044C\u043D\u0430\u044F', installed: '\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E', age: '\u0412\u043E\u0437\u0440\u0430\u0441\u0442', model: '\u041C\u043E\u0434\u0435\u043B\u044C',
    type: '\u0422\u0438\u043F', year1Loss: '\u041F\u043E\u0442\u0435\u0440\u044F \u0433\u043E\u0434 1', annualLoss: '\u0413\u043E\u0434\u043E\u0432\u0430\u044F \u043F\u043E\u0442\u0435\u0440\u044F', nextYear: '\u0421\u043B\u0435\u0434. \u0433\u043E\u0434',
    weather: '\u041F\u041E\u0413\u041E\u0414\u0410', condition: '\u0423\u0441\u043B\u043E\u0432\u0438\u044F', temp: '\u0422\u0435\u043C\u043F', cloud: '\u041E\u0431\u043B\u0430\u043A\u0430', humidity: '\u0412\u043B\u0430\u0436\u043D\u043E\u0441\u0442\u044C',
    tabLive: '\u041B\u0430\u0439\u0432', tabYesterday: '\u0412\u0447\u0435\u0440\u0430', tab7Days: '7 \u0434\u043D\u0435\u0439', tab30Days: '30 \u0434\u043D\u0435\u0439',
    chartPower: '\u041C\u043E\u0449\u043D\u043E\u0441\u0442\u044C', chartBatterySOC: '\u0410\u043A\u043A\u0443\u043C\u0443\u043B\u044F\u0442\u043E\u0440 SOC', chartSolar: '\u0421\u043E\u043B\u043D\u0435\u0447\u043D\u0430\u044F',
    legendActual: '\u0424\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439', legendEstimated: '\u041E\u0446\u0435\u043D\u043E\u0447\u043D\u044B\u0439',
    temperature: '\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430',
    charging: '\u0417\u0430\u0440\u044F\u0434\u043A\u0430', discharging: '\u0420\u0430\u0437\u0440\u044F\u0434\u043A\u0430', idle: '\u041F\u0440\u043E\u0441\u0442\u043E\u0439', balancing: '\u0411\u0430\u043B\u0430\u043D\u0441\u0438\u0440\u043E\u0432\u043A\u0430',
    ctrlCharging: '\u0417\u0430\u0440\u044F\u0434\u043A\u0430', ctrlDischarging: '\u0420\u0430\u0437\u0440\u044F\u0434\u043A\u0430', ctrlBalancer: '\u0411\u0430\u043B\u0430\u043D\u0441\u0438\u0440',
    descCharging: '\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0438\u043B\u0438 \u043E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0437\u0430\u0440\u044F\u0434\u043A\u0443 \u0430\u043A\u043A\u0443\u043C\u0443\u043B\u044F\u0442\u043E\u0440\u0430',
    descDischarging: '\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0438\u043B\u0438 \u043E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0440\u0430\u0437\u0440\u044F\u0434\u043A\u0443 \u0430\u043A\u043A\u0443\u043C\u0443\u043B\u044F\u0442\u043E\u0440\u0430',
    balDisabled: '\u041E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u043E', balOff: '\u0411\u0430\u043B\u0430\u043D\u0441\u0438\u0440 \u0432\u044B\u043A\u043B',
    balActive: '\u0410\u043A\u0442\u0438\u0432\u043D\u0430\u044F \u043F\u0435\u0440\u0435\u0434\u0430\u0447\u0430 \u0447\u0435\u0440\u0435\u0437 \u0441\u0443\u043F\u0435\u0440\u043A\u043E\u043D\u0434\u0435\u043D\u0441\u0430\u0442\u043E\u0440',
    balEnabledIdle: '\u0412\u043A\u043B\u044E\u0447\u0435\u043D \u00B7 \u0431\u0430\u043B\u0430\u043D\u0441\u0438\u0440\u043E\u0432\u043A\u0430 \u043D\u0435 \u0430\u043A\u0442\u0438\u0432\u043D\u0430',
    sevenDAvg: '7\u0434 \u0441\u0440', west: '\u0417 est',
    mVBalancing: '\u043C\u0412 \u2014 \u0411\u0430\u043B\u0430\u043D\u0441\u0438\u0440\u043E\u0432\u043A\u0430', mV: '\u043C\u0412',
  },
  'zh-Hans': {
    solar: '\u592A\u9633\u80FD', live: '\u5B9E\u65F6', battery: '\u7535\u6C60', powerFlow: '\u80FD\u91CF\u6D41\u5411',
    solarPanels: '\u592A\u9633\u80FD\u7535\u6C60\u677F', analytics: '\u5206\u6790', controls: '\u63A7\u5236',
    cellsC1C8: '\u7535\u6C60 C1\u2013C8', cellsC9C16: '\u7535\u6C60 C9\u2013C16',
    voltage: '\u7535\u538B', current: '\u7535\u6D41', power: '\u529F\u7387', remaining: '\u5269\u4F59',
    energy: '\u80FD\u91CF', todayIn: '\u4ECA\u65E5\u5145\u5165', todayOut: '\u4ECA\u65E5\u653E\u51FA',
    tte: '\u7A7A\u7535\u65F6\u95F4', ttf: '\u6EE1\u7535\u65F6\u95F4',
    cycles: '\u5FAA\u73AF', capacity: '\u5BB9\u91CF', nominal: '\u6807\u79F0', config: '\u914D\u7F6E',
    minCell: '\u6700\u4F4E\u7535\u6C60', maxCell: '\u6700\u9AD8\u7535\u6C60', runtime: '\u8FD0\u884C\u65F6\u95F4', throughput: '\u541E\u5410\u91CF',
    mosfet: 'MOSFET', bmsModel: 'BMS \u578B\u53F7', firmware: '\u56FA\u4EF6', chemistry: '\u5316\u5B66',
    batteryNode: '\u7535\u6C60', home: '\u5BB6\u5EAD', solarNode: '\u592A\u9633\u80FD',
    actual: '\u5B9E\u9645', estimated: '\u4F30\u8BA1', generatedToday: '\u4ECA\u65E5\u53D1\u7535', expected: '\u9884\u8BA1',
    rated: '\u989D\u5B9A', installed: '\u5DF2\u5B89\u88C5', age: '\u4F7F\u7528\u65F6\u95F4', model: '\u578B\u53F7',
    type: '\u7C7B\u578B', year1Loss: '\u7B2C1\u5E74\u635F\u8017', annualLoss: '\u5E74\u635F\u8017', nextYear: '\u660E\u5E74',
    weather: '\u5929\u6C14', condition: '\u5929\u6C14\u72B6\u51B5', temp: '\u6E29\u5EA6', cloud: '\u4E91\u91CF', humidity: '\u6E7F\u5EA6',
    tabLive: '\u5B9E\u65F6', tabYesterday: '\u6628\u5929', tab7Days: '7\u5929', tab30Days: '30\u5929',
    chartPower: '\u529F\u7387', chartBatterySOC: '\u7535\u6C60 SOC', chartSolar: '\u592A\u9633\u80FD',
    legendActual: '\u5B9E\u9645', legendEstimated: '\u4F30\u8BA1',
    temperature: '\u6E29\u5EA6',
    charging: '\u5145\u7535\u4E2D', discharging: '\u653E\u7535\u4E2D', idle: '\u5F85\u673A', balancing: '\u5747\u8861\u4E2D',
    ctrlCharging: '\u5145\u7535', ctrlDischarging: '\u653E\u7535', ctrlBalancer: '\u5747\u8861\u5668',
    descCharging: '\u542F\u7528\u6216\u7981\u7528\u7535\u6C60\u5145\u7535',
    descDischarging: '\u542F\u7528\u6216\u7981\u7528\u7535\u6C60\u653E\u7535',
    balDisabled: '\u5DF2\u7981\u7528', balOff: '\u5747\u8861\u5668\u5173\u95ED',
    balActive: '\u901A\u8FC7\u8D85\u7EA7\u7535\u5BB9\u5668\u6D3B\u8DC3\u4F20\u8F93',
    balEnabledIdle: '\u5DF2\u542F\u7528 \u00B7 \u5F53\u524D\u672A\u5747\u8861',
    sevenDAvg: '7\u5929\u5747', west: '\u897F est',
    mVBalancing: 'mV \u2014 \u5747\u8861\u4E2D', mV: 'mV',
  },
  ja: {
    solar: '\u30BD\u30FC\u30E9\u30FC', live: '\u30EA\u30A2\u30EB\u30BF\u30A4\u30E0', battery: '\u30D0\u30C3\u30C6\u30EA\u30FC', powerFlow: '\u96FB\u529B\u6D41\u308C',
    solarPanels: '\u30BD\u30FC\u30E9\u30FC\u30D1\u30CD\u30EB', analytics: '\u5206\u6790', controls: '\u30B3\u30F3\u30C8\u30ED\u30FC\u30EB',
    cellsC1C8: '\u30BB\u30EB C1\u2013C8', cellsC9C16: '\u30BB\u30EB C9\u2013C16',
    voltage: '\u96FB\u5727', current: '\u96FB\u6D41', power: '\u96FB\u529B', remaining: '\u6B8B\u91CF',
    energy: '\u30A8\u30CD\u30EB\u30AE\u30FC', todayIn: '\u4ECA\u65E5\u5145\u96FB', todayOut: '\u4ECA\u65E5\u653E\u96FB',
    tte: '\u7A7A\u307E\u3067', ttf: '\u6E80\u305F\u3067',
    cycles: '\u30B5\u30A4\u30AF\u30EB', capacity: '\u5BB9\u91CF', nominal: '\u79F0\u540D', config: '\u8A2D\u5B9A',
    minCell: '\u6700\u4F4E\u30BB\u30EB', maxCell: '\u6700\u9AD8\u30BB\u30EB', runtime: '\u7A3C\u50CD\u6642\u9593', throughput: '\u30B9\u30EB\u30FC\u30D7\u30C3\u30C8',
    mosfet: 'MOSFET', bmsModel: 'BMS \u30E2\u30C7\u30EB', firmware: '\u30D5\u30A1\u30FC\u30E0\u30A6\u30A7\u30A2', chemistry: '\u5316\u5B66',
    batteryNode: '\u30D0\u30C3\u30C6\u30EA\u30FC', home: '\u30DB\u30FC\u30E0', solarNode: '\u30BD\u30FC\u30E9\u30FC',
    actual: '\u5B9F\u969B', estimated: '\u63A8\u5B9A', generatedToday: '\u4ECA\u65E5\u767A\u96FB', expected: '\u4E88\u60F3',
    rated: '\u5B9A\u683C', installed: '\u8A2D\u7F6E\u6E08', age: '\u7D4C\u904E', model: '\u30E2\u30C7\u30EB',
    type: '\u30BF\u30A4\u30D7', year1Loss: '1\u5E74\u76EE\u640D\u8017', annualLoss: '\u5E74\u9593\u640D\u8017', nextYear: '\u7FCC\u5E74',
    weather: '\u5929\u6C17', condition: '\u72B6\u614B', temp: '\u6C17\u6E29', cloud: '\u66C7', humidity: '\u6E7F\u5EA6',
    tabLive: '\u30EA\u30A2\u30EB\u30BF\u30A4\u30E0', tabYesterday: '\u6628\u65E5', tab7Days: '7\u65E5\u9593', tab30Days: '30\u65E5\u9593',
    chartPower: '\u96FB\u529B', chartBatterySOC: '\u30D0\u30C3\u30C6\u30EA\u30FC SOC', chartSolar: '\u30BD\u30FC\u30E9\u30FC',
    legendActual: '\u5B9F\u969B', legendEstimated: '\u63A8\u5B9A',
    temperature: '\u6E29\u5EA6',
    charging: '\u5145\u96FB\u4E2D', discharging: '\u653E\u96FB\u4E2D', idle: '\u30A2\u30A4\u30C9\u30EB', balancing: '\u30D0\u30E9\u30F3\u30B9\u4E2D',
    ctrlCharging: '\u5145\u96FB', ctrlDischarging: '\u653E\u96FB', ctrlBalancer: '\u30D0\u30E9\u30F3\u30B5',
    descCharging: '\u30D0\u30C3\u30C6\u30EA\u30FC\u5145\u96FB\u3092\u6709\u52B9\u307E\u305F\u306F\u7121\u52B9\u306B\u3057\u307E\u3059',
    descDischarging: '\u30D0\u30C3\u30C6\u30EA\u30FC\u653E\u96FB\u3092\u6709\u52B9\u307E\u305F\u306F\u7121\u52B9\u306B\u3057\u307E\u3059',
    balDisabled: '\u7121\u52B9', balOff: '\u30D0\u30E9\u30F3\u30B5\u30AA\u30D5',
    balActive: '\u30B9\u30FC\u30D1\u30FC\u30AD\u30E3\u30D1\u30B7\u30BF\u3092\u901A\u3058\u3066\u6D3B\u767A\u306B\u8EE2\u9001',
    balEnabledIdle: '\u6709\u52B9 \u00B7 \u73FE\u5728\u30D0\u30E9\u30F3\u30B9\u3055\u308C\u3066\u3044\u307E\u305B\u3093',
    sevenDAvg: '7\u65E5\u5E73\u5747', west: '\u897F est',
    mVBalancing: 'mV \u2014 \u30D0\u30E9\u30F3\u30B9\u4E2D', mV: 'mV',
  },
  ko: {
    solar: '\uC194\uB77C', live: '\uC2E4\uC2DC\uAC04', battery: '\uBC30\uD130\uB9AC', powerFlow: '\uC804\uB825 \uD750\uB984',
    solarPanels: '\uC194\uB77C \uD328\uB110', analytics: '\uBD84\uC11D', controls: '\uC81C\uC5B4',
    cellsC1C8: '\uC140 C1\u2013C8', cellsC9C16: '\uC140 C9\u2013C16',
    voltage: '\uC804\uC555', current: '\uC804\uB958', power: '\uC804\uB825', remaining: '\uB0A8\uC74C',
    energy: '\uC5D0\uB108\uC9C0', todayIn: '\uC624\uB298 \uCC44\uC804', todayOut: '\uC624\uB298 \uBC29\uC804',
    tte: '\uBC29\uC804 \uAE4C\uC9C0', ttf: '\uB9CC\uC804 \uAE4C\uC9C0',
    cycles: '\uC0AC\uC774\uD074', capacity: '\uC6A9\uB7C9', nominal: '\uBA85\uBAA9', config: '\uAD6C\uC131',
    minCell: '\uCD5C\uC18C \uC140', maxCell: '\uCD5C\uB300 \uC140', runtime: '\uC791\uB3D9 \uC2DC\uAC04', throughput: '\uC2A4\uB8E8\uD48B',
    mosfet: 'MOSFET', bmsModel: 'BMS \uBAA8\uB378', firmware: '\uD38C\uC6E8\uC5B4', chemistry: '\uD654\uD559',
    batteryNode: '\uBC30\uD130\uB9AC', home: '\uC9D1', solarNode: '\uC194\uB77C',
    actual: '\uC2E4\uC81C', estimated: '\uCD94\uC815', generatedToday: '\uC624\uB298 \uBC1C\uC804', expected: '\uC608\uC0C1',
    rated: '\uC815\uACA9', installed: '\uC124\uCE58 \uC644\uB8CC', age: '\uC0AC\uC6A9 \uAE30\uAC04', model: '\uBAA8\uB378',
    type: '\uC720\uD615', year1Loss: '1\uB144\uCC28 \uC190\uC2E4', annualLoss: '\uC5F0\uAC04 \uC190\uC2E4', nextYear: '\uB0B4\uB144',
    weather: '\uB0A0\uC528', condition: '\uC0C1\uD0DC', temp: '\uAE30\uC628', cloud: '\uAD6C\uB984', humidity: '\uC2B5\uB3C4',
    tabLive: '\uC2E4\uC2DC\uAC04', tabYesterday: '\uC5B4\uC81C', tab7Days: '7\uC77C', tab30Days: '30\uC77C',
    chartPower: '\uC804\uB825', chartBatterySOC: '\uBC30\uD130\uB9AC SOC', chartSolar: '\uC194\uB77C',
    legendActual: '\uC2E4\uC81C', legendEstimated: '\uCD94\uC815',
    temperature: '\uC628\uB3C4',
    charging: '\uCC44\uC804 \uC911', discharging: '\uBC29\uC804 \uC911', idle: '\uB300\uAE30', balancing: '\uADE0\uD615 \uC911',
    ctrlCharging: '\uCC44\uC804', ctrlDischarging: '\uBC29\uC804', ctrlBalancer: '\uADE0\uD615\uAE30',
    descCharging: '\uBC30\uD130\uB9AC \uCC44\uC804 \uD65C\uC131\uD654 \uB610\uB294 \uBE44\uD65C\uC131\uD654',
    descDischarging: '\uBC30\uD130\uB9AC \uBC29\uC804 \uD65C\uC131\uD654 \uB610\uB294 \uBE44\uD65C\uC131\uD654',
    balDisabled: '\uBE44\uD65C\uC131\uD654', balOff: '\uADE0\uD615\uAE30 \uB044\uAE30',
    balActive: '\uC288\uD37C\uCEF4\uC2DC\uD130\uB97C \uD1B5\uD574 \uD65C\uBC1C\uD55C \uC804\uC1A1',
    balEnabledIdle: '\uD65C\uC131\uD654 \u00B7 \uD604\uC7AC \uADE0\uD615 \uC548 \uD568',
    sevenDAvg: '7\uC77C \uD3C9\uADE0', west: '\uC11C est',
    mVBalancing: 'mV \u2014 \uADE0\uD615 \uC911', mV: 'mV',
  },
  tr: {
    solar: 'G\u00FCne\u015F', live: 'Canl\u0131', battery: 'Batarya', powerFlow: 'G\u00FC\u00E7 ak\u0131\u015F\u0131',
    solarPanels: 'G\u00FCne\u015F panelleri', analytics: 'Analiz', controls: 'Kontroller',
    cellsC1C8: 'H\u00FCcreler C1\u2013C8', cellsC9C16: 'H\u00FCcreler C9\u2013C16',
    voltage: 'Gerilim', current: 'Ak\u0131m', power: 'G\u00FC\u00E7', remaining: 'Kalan',
    energy: 'Enerji', todayIn: 'Bug\u00FCn giri\u015F', todayOut: 'Bug\u00FCn \u00E7\u0131k\u0131\u015F',
    tte: 'Bo\u015Falma s\u00FCresi', ttf: 'Dolma s\u00FCresi',
    cycles: 'D\u00F6ng\u00FCler', capacity: 'Kapasite', nominal: 'Nominal', config: 'Yap\u0131land\u0131rma',
    minCell: 'H\u00FCcre min', maxCell: 'H\u00FCcre maks', runtime: '\u00C7al\u0131\u015Fma s\u00FCresi', throughput: 'Verim',
    mosfet: 'MOSFET', bmsModel: 'BMS Modeli', firmware: 'Firmware', chemistry: 'Kimya',
    batteryNode: 'Batarya', home: 'Ev', solarNode: 'G\u00FCne\u015F',
    actual: 'ger\u00E7ek', estimated: 'tahmini', generatedToday: 'bug\u00FCn \u00FCretilen', expected: 'beklenen',
    rated: 'Nominal', installed: 'Kurulu', age: 'Ya\u015F', model: 'Model',
    type: 'Tip', year1Loss: '1. y\u0131l kayb\u0131', annualLoss: 'Y\u0131ll\u0131k kay\u0131p', nextYear: 'Gelecek y\u0131l',
    weather: 'HAVA', condition: 'Durum', temp: 'S\u0131cakl\u0131k', cloud: 'Bulut', humidity: 'Nem',
    tabLive: 'Canl\u0131', tabYesterday: 'D\u00FCn', tab7Days: '7 g\u00FCn', tab30Days: '30 g\u00FCn',
    chartPower: 'G\u00FC\u00E7', chartBatterySOC: 'Batarya SOC', chartSolar: 'G\u00FCne\u015F',
    legendActual: 'Ger\u00E7ek', legendEstimated: 'Tahmini',
    temperature: 'S\u0131cakl\u0131k',
    charging: '\u015Earj', discharging: 'De\u015Farj', idle: 'Bo\u015Fta', balancing: 'Dengeleme',
    ctrlCharging: '\u015Earj', ctrlDischarging: 'De\u015Farj', ctrlBalancer: 'Dengeleyici',
    descCharging: 'Batarya \u015Farj\u0131n\u0131 etkinle\u015Ftir veya devre d\u0131\u015F\u0131 b\u0131rak',
    descDischarging: 'Batarya de\u015Farj\u0131n\u0131 etkinle\u015Ftir veya devre d\u0131\u015F\u0131 b\u0131rak',
    balDisabled: 'Devre d\u0131\u015F\u0131', balOff: 'Dengeleyici kapal\u0131',
    balActive: 'S\u00FCper kapasit\u00F6r \u00FCzerinden aktif aktar\u0131m',
    balEnabledIdle: 'Etkin \u00B7 \u015Fu anda dengeleme yok',
    sevenDAvg: '7g ort', west: 'B est',
    mVBalancing: 'mV \u2014 Dengeleme', mV: 'mV',
  },
  cs: {
    solar: 'Sol\u00E1rn\u00ED', live: '\u017Div\u011B', battery: 'Baterie', powerFlow: 'Tok energie',
    solarPanels: 'Sol\u00E1rn\u00ED panely', analytics: 'Anal\u00FDza', controls: 'Ovl\u00E1d\u00E1n\u00ED',
    cellsC1C8: 'Bu\u0148ky C1\u2013C8', cellsC9C16: 'Bu\u0148ky C9\u2013C16',
    voltage: 'Nap\u011Bt\u00ED', current: 'Proud', power: 'V\u00FDkon', remaining: 'Zb\u00FDv\u00E1',
    energy: 'Energie', todayIn: 'Dnes vstup', todayOut: 'Dnes v\u00FDstup',
    tte: '\u010Cas do vybit\u00ED', ttf: '\u010Cas do nabit\u00ED',
    cycles: 'Cykly', capacity: 'Kapacita', nominal: 'Nomin\u00E1ln\u00ED', config: 'Konfig',
    minCell: 'Bu\u0148ka min', maxCell: 'Bu\u0148ka max', runtime: 'Doba b\u011Bhu', throughput: 'Propustnost',
    mosfet: 'MOSFET', bmsModel: 'Model BMS', firmware: 'Firmware', chemistry: 'Chemie',
    batteryNode: 'Baterie', home: 'D\u016Fm', solarNode: 'Sol\u00E1rn\u00ED',
    actual: 'skute\u010Dn\u00FD', estimated: 'odhadovan\u00FD', generatedToday: 'vyrobeno dnes', expected: 'o\u010dek\u00E1van\u00FD',
    rated: 'Nomin\u00E1ln\u00ED', installed: 'Instalov\u00E1no', age: 'St\u00E1\u0159\u00ED', model: 'Model',
    type: 'Typ', year1Loss: 'Ztr\u00E1ta rok 1', annualLoss: 'Ro\u010Dn\u00ED ztr\u00E1ta', nextYear: 'P\u0159\u00ED\u0161t\u00ED rok',
    weather: 'PO\u010CAS\u00CD', condition: 'Podm\u00EDnky', temp: 'Teplota', cloud: 'Obla\u010Dnost', humidity: 'Vlhkost',
    tabLive: '\u017Div\u011B', tabYesterday: 'V\u010Dera', tab7Days: '7 dn\u00ED', tab30Days: '30 dn\u00ED',
    chartPower: 'V\u00FDkon', chartBatterySOC: 'Baterie SOC', chartSolar: 'Sol\u00E1rn\u00ED',
    legendActual: 'Skute\u010Dn\u00FD', legendEstimated: 'Odhadovan\u00FD',
    temperature: 'Teplota',
    charging: 'Nab\u00EDjen\u00ED', discharging: 'Vyb\u00EDjen\u00ED', idle: 'Ne\u010Dinn\u00FD', balancing: 'Vyva\u017Eov\u00E1n\u00ED',
    ctrlCharging: 'Nab\u00EDjen\u00ED', ctrlDischarging: 'Vyb\u00EDjen\u00ED', ctrlBalancer: 'Balan\u010Der',
    descCharging: 'Povolit nebo zak\u00E1zat nab\u00EDjen\u00ED baterie',
    descDischarging: 'Povolit nebo zak\u00E1zat vyb\u00EDjen\u00ED baterie',
    balDisabled: 'Zak\u00E1z\u00E1no', balOff: 'Balan\u010Der vypnut',
    balActive: 'Aktivn\u00ED p\u0159enos p\u0159es superkondenz\u00E1tor',
    balEnabledIdle: 'Povoleno \u00B7 aktu\u00E1ln\u011B nevyva\u017Euje',
    sevenDAvg: '7d pr\u016Fm', west: 'Z est',
    mVBalancing: 'mV \u2014 Vyva\u017Eov\u00E1n\u00ED', mV: 'mV',
  },
  uk: {
    solar: '\u0421\u043E\u043D\u044F\u0447\u043D\u0430', live: '\u041D\u0430\u0436\u0438\u0432\u043E', battery: '\u0410\u043A\u0443\u043C\u0443\u043B\u044F\u0442\u043E\u0440', powerFlow: '\u041F\u043E\u0442\u0456\u043A \u0435\u043D\u0435\u0440\u0433\u0456\u0457',
    solarPanels: '\u0421\u043E\u043D\u044F\u0447\u043D\u0456 \u043F\u0430\u043D\u0435\u043B\u0456', analytics: '\u0410\u043D\u0430\u043B\u0456\u0442\u0438\u043A\u0430', controls: '\u041A\u0435\u0440\u0443\u0432\u0430\u043D\u043D\u044F',
    cellsC1C8: '\u041A\u043E\u043C\u0456\u0440\u043A\u0438 C1\u2013C8', cellsC9C16: '\u041A\u043E\u043C\u0456\u0440\u043A\u0438 C9\u2013C16',
    voltage: '\u041D\u0430\u043F\u0440\u0443\u0433\u0430', current: '\u0421\u0442\u0440\u0443\u043C', power: '\u041F\u043E\u0442\u0443\u0436\u043D\u0456\u0441\u0442\u044C', remaining: '\u0417\u0430\u043B\u0438\u0448\u043E\u043A',
    energy: '\u0415\u043D\u0435\u0440\u0433\u0456\u044F', todayIn: '\u0421\u044C\u043E\u0433\u043E\u0434\u043D\u0456 \u0432\u0445\u0456\u0434', todayOut: '\u0421\u044C\u043E\u0433\u043E\u0434\u043D\u0456 \u0432\u0438\u0445\u0456\u0434',
    tte: '\u0427\u0430\u0441 \u0434\u043E \u0440\u043E\u0437\u0440\u044F\u0434\u0443', ttf: '\u0427\u0430\u0441 \u0434\u043E \u0437\u0430\u0440\u044F\u0434\u0443',
    cycles: '\u0426\u0438\u043A\u043B\u0438', capacity: '\u0404\u043C\u043D\u0456\u0441\u0442\u044C', nominal: '\u041D\u043E\u043C\u0456\u043D\u0430\u043B', config: '\u041A\u043E\u043D\u0444\u0456\u0433',
    minCell: '\u041A\u043E\u043C\u0456\u0440\u043A\u0430 \u043C\u0456\u043D', maxCell: '\u041A\u043E\u043C\u0456\u0440\u043A\u0430 \u043C\u0430\u043A\u0441', runtime: '\u0427\u0430\u0441 \u0440\u043E\u0431\u043E\u0442\u0438', throughput: '\u041F\u0440\u043E\u043F\u0443\u0441\u043A\u043D\u0430 \u0437\u0434\u0430\u0442\u043D\u0456\u0441\u0442\u044C',
    mosfet: 'MOSFET', bmsModel: '\u041C\u043E\u0434\u0435\u043B\u044C BMS', firmware: '\u041F\u0440\u043E\u0448\u0438\u0432\u043A\u0430', chemistry: '\u0425\u0456\u043C\u0456\u044F',
    batteryNode: '\u0410\u043A\u0443\u043C\u0443\u043B\u044F\u0442\u043E\u0440', home: '\u0414\u0456\u043C', solarNode: '\u0421\u043E\u043D\u044F\u0447\u043D\u0430',
    actual: '\u0444\u0430\u043A\u0442\u0438\u0447\u043D\u0438\u0439', estimated: '\u043E\u0446\u0456\u043D\u043E\u0447\u043D\u0438\u0439', generatedToday: '\u0432\u0438\u0440\u043E\u0431\u043B\u0435\u043D\u043E \u0441\u044C\u043E\u0433\u043E\u0434\u043D\u0456', expected: '\u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F',
    rated: '\u041D\u043E\u043C\u0456\u043D\u0430\u043B\u044C\u043D\u0430', installed: '\u0412\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E', age: '\u0412\u0456\u043A', model: '\u041C\u043E\u0434\u0435\u043B\u044C',
    type: '\u0422\u0438\u043F', year1Loss: '\u0412\u0442\u0440\u0430\u0442\u0430 \u0440\u0456\u043A 1', annualLoss: '\u0420\u0456\u0447\u043D\u0430 \u0432\u0442\u0440\u0430\u0442\u0430', nextYear: '\u041D\u0430\u0441\u0442. \u0440\u0456\u043A',
    weather: '\u041F\u041E\u0413\u041E\u0414\u0410', condition: '\u0423\u043C\u043E\u0432\u0438', temp: '\u0422\u0435\u043C\u043F', cloud: '\u0425\u043C\u0430\u0440\u043D\u0456\u0441\u0442\u044C', humidity: '\u0412\u043E\u043B\u043E\u0433\u0456\u0441\u0442\u044C',
    tabLive: '\u041D\u0430\u0436\u0438\u0432\u043E', tabYesterday: '\u0412\u0447\u043E\u0440\u0430', tab7Days: '7 \u0434\u043D\u0456\u0432', tab30Days: '30 \u0434\u043D\u0456\u0432',
    chartPower: '\u041F\u043E\u0442\u0443\u0436\u043D\u0456\u0441\u0442\u044C', chartBatterySOC: '\u0410\u043A\u0443\u043C\u0443\u043B\u044F\u0442\u043E\u0440 SOC', chartSolar: '\u0421\u043E\u043D\u044F\u0447\u043D\u0430',
    legendActual: '\u0424\u0430\u043A\u0442\u0438\u0447\u043D\u0438\u0439', legendEstimated: '\u041E\u0446\u0456\u043D\u043E\u0447\u043D\u0438\u0439',
    temperature: '\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430',
    charging: '\u0417\u0430\u0440\u044F\u0434\u043A\u0430', discharging: '\u0420\u043E\u0437\u0440\u044F\u0434\u043A\u0430', idle: '\u041F\u0440\u043E\u0441\u0442\u0456\u0439', balancing: '\u0411\u0430\u043B\u0430\u043D\u0441\u0443\u0432\u0430\u043D\u043D\u044F',
    ctrlCharging: '\u0417\u0430\u0440\u044F\u0434\u043A\u0430', ctrlDischarging: '\u0420\u043E\u0437\u0440\u044F\u0434\u043A\u0430', ctrlBalancer: '\u0411\u0430\u043B\u0430\u043D\u0441\u0443\u0432\u0430\u043B\u044C\u043D\u0438\u043A',
    descCharging: '\u0423\u0432\u0456\u043C\u043A\u043D\u0443\u0442\u0438 \u0430\u0431\u043E \u0432\u0438\u043C\u043A\u043D\u0443\u0442\u0438 \u0437\u0430\u0440\u044F\u0434\u043A\u0443 \u0430\u043A\u0443\u043C\u0443\u043B\u044F\u0442\u043E\u0440\u0430',
    descDischarging: '\u0423\u0432\u0456\u043C\u043A\u043D\u0443\u0442\u0438 \u0430\u0431\u043E \u0432\u0438\u043C\u043A\u043D\u0443\u0442\u0438 \u0440\u043E\u0437\u0440\u044F\u0434\u043A\u0443 \u0430\u043A\u0443\u043C\u0443\u043B\u044F\u0442\u043E\u0440\u0430',
    balDisabled: '\u0412\u0438\u043C\u043A\u043D\u0435\u043D\u043E', balOff: '\u0411\u0430\u043B\u0430\u043D\u0441\u0443\u0432\u0430\u043B\u044C\u043D\u0438\u043A \u0432\u0438\u043C\u043A.',
    balActive: '\u0410\u043A\u0442\u0438\u0432\u043D\u0430 \u043F\u0435\u0440\u0435\u0434\u0430\u0447\u0430 \u0447\u0435\u0440\u0435\u0437 \u0441\u0443\u043F\u0435\u0440\u043A\u043E\u043D\u0434\u0435\u043D\u0441\u0430\u0442\u043E\u0440',
    balEnabledIdle: '\u0423\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u043E \u00B7 \u043D\u0435 \u0431\u0430\u043B\u0430\u043D\u0441\u0443\u0454\u0442\u044C\u0441\u044F',
    sevenDAvg: '7\u0434 \u0441\u0435\u0440', west: '\u0417 est',
    mVBalancing: '\u043C\u0412 \u2014 \u0411\u0430\u043B\u0430\u043D\u0441\u0443\u0432\u0430\u043D\u043D\u044F', mV: '\u043C\u0412',
  },
};
function t(lang, key) {
  if (L[lang]) return L[lang][key] || L.en[key] || key;
  const base = lang.split('-')[0];
  if (L[base]) return L[base][key] || L.en[key] || key;
  return L.en[key] || key;
}

// ============ CONSTANTS ============

const MOON_PHASE_BRIGHTNESS = {
  'new_moon': 0.0, 'waxing_crescent': 0.15, 'first_quarter': 0.4,
  'waxing_gibbous': 0.7, 'full_moon': 1.0, 'waning_gibbous': 0.7,
  'last_quarter': 0.4, 'waning_crescent': 0.15,
};

const CONDITION_CLOUD_MAP = {
  'sunny': 5, 'clear-night': 5,
  'partlycloudy': 30, 'cloudy': 65,
  'rainy': 85, 'pouring': 95,
  'snowy': 80, 'fog': 70,
  'hail': 90, 'lightning': 90, 'lightning-rainy': 90,
  'windy': 15, 'windy-variant': 15,
  'exceptional': 50, 'snowy-rainy': 75,
};

const COND_LABELS = {
  'clear-night': 'Clear Night', 'cloudy': 'Cloudy', 'exceptional': 'Exceptional',
  'fog': 'Fog', 'hail': 'Hail', 'lightning': 'Lightning',
  'lightning-rainy': 'Thunderstorm', 'partlycloudy': 'Partly Cloudy',
  'pouring': 'Pouring', 'rainy': 'Rainy', 'snowy': 'Snowy',
  'snowy-rainy': 'Sleet', 'sunny': 'Sunny', 'windy': 'Windy',
  'windy-variant': 'Windy',
};

const CONDITION_PALETTE_MAP = {
  'sunny': 'sunny', 'clear-night': 'night',
  'partlycloudy': 'partlycloudy', 'cloudy': 'cloudy',
  'rainy': 'rainy', 'pouring': 'pouring',
  'snowy': 'snowy', 'hail': 'snowy',
  'fog': 'fog',
  'lightning': 'storm', 'lightning-rainy': 'storm',
  'windy': 'windy', 'windy-variant': 'windy',
  'exceptional': 'cloudy', 'snowy-rainy': 'snowy',
};

function cellBounds(chemistry) {
  if (chemistry === 'NMC')  return { vmin: 3.00, vmax: 4.20 };
  if (chemistry === 'LTO')  return { vmin: 1.80, vmax: 2.75 };
  return { vmin: 2.50, vmax: 3.65 }; // LiFePO₄ and unknown — intentional fallthrough
}

const WEATHER_PALETTES = {
  dark: {
    sunny:              ['rgba(255,180,50,0.40)', 'rgba(255,140,30,0.30)', 'rgba(255,200,80,0.20)'],
    night:              ['rgba(20,20,80,0.3)',    'rgba(40,30,100,0.2)',   'rgba(60,20,120,0.15)'],
    partlycloudy:       ['rgba(135,206,235,0.45)','rgba(100,160,220,0.30)','rgba(180,210,240,0.20)'],
    cloudy:             ['rgba(120,120,140,0.22)','rgba(100,100,120,0.16)','rgba(80,85,100,0.12)'],
    rainy:              ['rgba(40,60,120,0.25)',  'rgba(30,50,100,0.20)',  'rgba(20,40,80,0.14)'],
    snowy:              ['rgba(140,160,200,0.22)','rgba(120,140,180,0.16)','rgba(100,120,160,0.12)'],
    fog:                ['rgba(100,100,110,0.22)','rgba(80,80,90,0.16)',   'rgba(60,60,70,0.12)'],
    storm:              ['rgba(60,20,80,0.28)',   'rgba(40,10,60,0.22)',   'rgba(80,30,100,0.16)'],
    windy:              ['rgba(60,160,200,0.22)', 'rgba(40,140,180,0.16)', 'rgba(80,180,220,0.12)'],
    night_partlycloudy: ['rgba(30,40,90,0.25)',   'rgba(50,50,110,0.18)',  'rgba(40,60,100,0.12)'],
    night_cloudy:       ['rgba(25,25,50,0.25)',   'rgba(30,30,60,0.18)',   'rgba(20,25,55,0.12)'],
    pouring:            ['rgba(20,35,100,0.32)',  'rgba(15,28,85,0.26)',   'rgba(10,22,70,0.20)'],
    night_rainy:        ['rgba(15,25,70,0.3)',    'rgba(10,20,60,0.22)',   'rgba(20,30,80,0.15)'],
    night_pouring:      ['rgba(8,15,55,0.35)',    'rgba(5,12,45,0.28)',    'rgba(10,18,60,0.2)'],
    night_snowy:        ['rgba(30,40,80,0.25)',   'rgba(40,50,90,0.18)',   'rgba(50,60,100,0.12)'],
    night_fog:          ['rgba(30,30,40,0.25)',   'rgba(25,25,35,0.18)',   'rgba(20,20,30,0.12)'],
    night_storm:        ['rgba(30,5,50,0.3)',     'rgba(20,5,40,0.22)',    'rgba(40,10,60,0.15)'],
    night_windy:        ['rgba(10,60,90,0.2)',    'rgba(8,50,80,0.15)',    'rgba(15,70,100,0.1)'],
  },
  light: {
    sunny:              ['rgba(255,200,80,0.35)', 'rgba(255,170,50,0.25)', 'rgba(255,220,100,0.18)'],
    night:              ['rgba(40,40,100,0.15)',  'rgba(60,50,120,0.1)',   'rgba(80,40,140,0.08)'],
    partlycloudy:       ['rgba(135,206,235,0.45)','rgba(100,160,220,0.30)','rgba(180,210,240,0.20)'],
    cloudy:             ['rgba(150,155,170,0.28)','rgba(130,135,150,0.20)','rgba(110,115,130,0.15)'],
    rainy:              ['rgba(60,80,140,0.25)',  'rgba(50,70,120,0.20)',  'rgba(40,60,100,0.14)'],
    snowy:              ['rgba(180,200,230,0.28)','rgba(160,180,210,0.20)','rgba(140,160,190,0.15)'],
    fog:                ['rgba(140,140,150,0.28)','rgba(120,120,130,0.20)','rgba(100,100,110,0.15)'],
    storm:              ['rgba(80,40,100,0.28)',  'rgba(60,30,80,0.20)',   'rgba(100,50,120,0.15)'],
    windy:              ['rgba(80,180,220,0.22)', 'rgba(60,160,200,0.16)', 'rgba(100,200,230,0.12)'],
    night_partlycloudy: ['rgba(60,70,120,0.15)',  'rgba(70,80,130,0.1)',   'rgba(50,60,110,0.08)'],
    night_cloudy:       ['rgba(50,50,80,0.15)',   'rgba(40,45,75,0.1)',    'rgba(35,40,70,0.08)'],
    pouring:            ['rgba(40,55,120,0.28)',  'rgba(30,45,100,0.22)',  'rgba(50,65,130,0.16)'],
    night_rainy:        ['rgba(30,45,100,0.18)',  'rgba(25,40,90,0.13)',   'rgba(35,50,110,0.1)'],
    night_pouring:      ['rgba(15,22,65,0.25)',   'rgba(12,18,55,0.2)',    'rgba(18,26,72,0.15)'],
    night_snowy:        ['rgba(60,70,110,0.15)',  'rgba(70,80,120,0.1)',   'rgba(80,90,130,0.08)'],
    night_fog:          ['rgba(50,50,65,0.15)',   'rgba(40,40,55,0.1)',    'rgba(35,35,50,0.08)'],
    night_storm:        ['rgba(50,20,70,0.18)',   'rgba(40,15,60,0.13)',   'rgba(60,25,80,0.1)'],
    night_windy:        ['rgba(30,90,130,0.12)',  'rgba(25,80,120,0.08)',  'rgba(35,100,140,0.06)'],
  },
};

// ============ FLOW PARTICLE SYSTEM ============
class FlowParticles {
  constructor(root, wrapId, particlesId, lineId, arcId, color) {
    this.wrap = root.getElementById(wrapId);
    this.container = root.getElementById(particlesId);
    this.line = root.getElementById(lineId);
    this.arcCanvas = root.getElementById(arcId);
    this.arcCtx = this.arcCanvas?.getContext('2d');
    this.color = color;
    this.active = false;
    this.activeDots = 0;
    this.speed = 0.003;
    this.activeFrac = 2;
    this.rafId = null;
    this._tick = this._animate.bind(this);
    this.dots = [];
    this.arcs = [];
    const dotsEl = this.container?.querySelectorAll('.flow-dot');
    if (dotsEl) {
      dotsEl.forEach((d) => {
        this.dots.push({ el: d, p: Math.random() });
      });
    }
  }

  start(powerW) {
    this.active = true;
    this.powerW = powerW;
    const MAX_W = 5000;
    const frac = Math.min(powerW, MAX_W) / MAX_W;
    // Continuous speed: 0.002 → 0.010
    this.speed = 0.002 + frac * 0.008;
    // Continuous dot count as float 2.0 → 5.0
    this.activeFrac = 2 + frac * 18;
    if (this.arcs.length === 0) {
      this.arcs = Array.from({ length: 4 }, () => ({
        p: Math.random(),
        len: 0.05 + Math.random() * 0.05,
        opacity: Math.random() * 0.4 + 0.2,
      }));
    }
    if (this.line) {
      if (!this._lineSet) {
        this.line.style.background = this.color + '33';
        this.line.style.boxShadow = `0 0 6px 1px ${this.color}22`;
        this.line.style.setProperty('--flow-color', this.color);
        this._lineSet = true;
      }
      const sweepS = (2.5 - frac * 1.7).toFixed(2);
      this.line.style.setProperty('--sweep-speed', sweepS + 's');
      const glowAlpha = Math.round(40 + frac * 80).toString(16).padStart(2, '0');
      this.line.style.boxShadow = `0 0 ${4 + frac * 10}px ${1 + frac * 3}px ${this.color}${glowAlpha}`;
    }
    if (!this.rafId) this.rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this.active = false;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.line) {
      this.line.style.background = '';
      this.line.style.boxShadow = '';
      this._lineSet = false;
    }
    this.dots.forEach(d => d.el.style.opacity = '0');
    if (this.arcCtx && this.arcCanvas) {
      this.arcCtx.clearRect(0, 0, this.arcCanvas.width, this.arcCanvas.height);
    }
    this.arcs = [];
  }

  _animate() {
    if (!this.active) return;
    const fullDots = Math.floor(this.activeFrac);
    const partialAlpha = this.activeFrac - fullDots;
    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i];
      const maxOpacity = i < fullDots ? 1.0 : i === fullDots ? partialAlpha : 0;
      if (maxOpacity < 0.01) {
        const cur = parseFloat(d.el.style.opacity) || 0;
        if (cur > 0.01) {
          d.p += this.speed;
          if (d.p >= 1) d.p -= 1;
          d.el.style.left = (d.p * 100) + '%';
          d.el.style.opacity = (cur * 0.92).toFixed(3);
        } else {
          d.el.style.opacity = '0';
        }
        continue;
      }
      d.p += this.speed;
      if (d.p >= 1) d.p -= 1;
      let edgeFade = 1;
      if (d.p < 0.08) edgeFade = d.p / 0.08;
      else if (d.p > 0.92) edgeFade = (1 - d.p) / 0.08;
      d.el.style.left = (d.p * 100) + '%';
      d.el.style.opacity = (maxOpacity * edgeFade).toFixed(3);
      d.el.style.background = this.color;
      d.el.style.boxShadow = `0 0 6px 2px ${this.color}, 0 0 12px 4px ${this.color}55`;
    }
    this._drawArcs();
    this.rafId = requestAnimationFrame(this._tick);
  }

  _drawArcs() {
    const ctx = this.arcCtx;
    const cv = this.arcCanvas;
    if (!ctx || !cv || this.arcs.length === 0) return;
    const wW = cv.offsetWidth || 100;
    const wH = 20;
    if (cv.width !== wW || cv.height !== wH) {
      cv.width = wW;
      cv.height = wH;
    }
    const W = cv.width;
    const H = cv.height;
    const cy = H / 2;
    const p = Math.min(this.activeFrac / 20, 1); // 0→1 power fraction
    const activeArcs = Math.max(1, Math.round(p * this.arcs.length));
    const roughness = 1 + p * 4;        // 1px → 5px
    const glowBlur = 4 + p * 14;        // 4 → 18
    const lineWidth = 0.5 + p * 1.5;    // 0.5px → 2px
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < this.arcs.length; i++) {
      const arc = this.arcs[i];
      arc.p += this.speed * 0.9;
      if (arc.p > 1 + arc.len) arc.p = -arc.len;
      if (i >= activeArcs) continue;
      arc.opacity += (Math.random() - 0.5) * 0.15;
      arc.opacity = Math.max(0.1, Math.min(0.6 + p * 0.3, arc.opacity));
      const x1 = (arc.p - arc.len / 2) * W;
      const x2 = (arc.p + arc.len / 2) * W;
      if (x2 < 0 || x1 > W) continue;
      const segments = 5 + Math.round(p * 4); // 5→9 segments
      const step = (x2 - x1) / segments;
      ctx.save();
      ctx.globalAlpha = arc.opacity;
      ctx.shadowBlur = glowBlur;
      ctx.shadowColor = this.color;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(Math.max(0, x1), cy);
      for (let j = 1; j <= segments; j++) {
        const x = Math.min(W, Math.max(0, x1 + j * step));
        const y = j === segments ? cy : cy + (Math.random() - 0.5) * roughness * 2;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ============ MAIN COMPONENT ============
class SolarDashboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._bridge = new HABridge();
    this._engine = null;
    this._weatherFx = null;
    this._charts = null;
    this._initialized = false;
    this._intervals = [];
    this._animations = [];         // P7: centralized animation list
    this._animRafId = null;        // P7: single rAF ID for all animations
    this._clockFormatter = null;
    this._flowPS1 = null;
    this._flowPS2 = null;
    this._battArcInterval = null;
    this._boltTimeouts = [];
    this._resizeTimeout = null;
    this._els = {};
    this._battArcActive = false;
    this._battArcColor = null;
    this._battArcPowerW = 0;
    this._cardsRevealed = false;
    this._weatherEntityId = null;
    this._moonPhaseEntityId = null;
    this._issPos = null;
    this._lastMoonBrightness = 0.5;
    this._weatherCloudFactor = 1.0;
    this._weatherAmbientC = null;
    this._solarEngineReady = false;
    this._todayIn = 0;
    this._todayOut = 0;
    this._lastForecastHour = -1;
    this._cachedForecastKWh = 0;
    this._revealFallbackTimeout = null;
    this._wasDay = false;
    this._resizeHandler = null;
    this._activeChartRange = 'Live';
    this._lastLiveChartFetch = 0;
    this._chartFetchDebounce = {}; // P22: debounce guard for tab clicks / visibility resume
    this._cycleRatePerDay = null;
    this._pendingChanges = new Set();
    this._updateRafId = null;
    this._chartsLoaded = false;
    this._meshCur    = [null, null, null];
    this._meshTarget = null;
    this._meshRafId  = null;
    // 24/7 reliability: WebSocket disconnection detection
    this._connCheckInterval = null;
    this._lastHassUpdate = 0;
    this._connLost = false;
  }

  set hass(hass) {
    this._lastHassUpdate = Date.now();
    if (this._connLost) this._hideConnLostBanner();
    const langChanged = this._bridge._hass?.language !== hass.language;
    this._bridge.update(hass);
    this._applyTheme();
    if (langChanged) {
      this._render();
      this._refreshAllUI();
      return;
    }
    if (!this._initialized) {
      this._init();
      this._initialized = true;
    }
    // Retry chart loading once entity discovery is complete
    const E = this._bridge.E;
    if (E && E.POWER && E.SOC && !this._chartsLoaded) {
      this._chartsLoaded = true;
      this._loadChartRange(this._activeChartRange || 'Live').catch(() => {});
    }
    const changed = this._bridge.getChangedEntities();
    if (changed.length > 0) {
      changed.forEach(id => this._pendingChanges.add(id));
    }
    if (!this._updateRafId) {
      this._updateRafId = requestAnimationFrame(() => {
        this._updateRafId = null;
        try {
          const pending = [...this._pendingChanges];
          this._pendingChanges.clear();
          if (pending.length === 0) return;
          this._updateUI(pending);
          if (this._activeChartRange === 'Live' && this._chartsLoaded) {
            const E = this._bridge.E;
            const liveEntities = new Set([E.POWER, E.CHG_POWER, E.DISCHG_POWER, E.SOC].filter(Boolean));
            const relevant = pending.some(id => liveEntities.has(id));
            if (relevant && Date.now() - this._lastLiveChartFetch > 60000) {
              this._lastLiveChartFetch = Date.now();
              this._loadChartRange('Live').catch(() => {});
            }
          }
        } catch (err) {
          console.error('[Solar] Update pipeline error:', err);
        }
      });
    }
  }

  set panel(panel) { this._panel = panel; }
  set narrow(narrow) { this._narrow = narrow; }

  // ============ RE-RENDER (language change) ============
  _render() {
    const root = this.shadowRoot;
    if (!root) return;
    const lang = this._bridge._hass?.language || 'en';
    root.innerHTML = `<style>${STYLES}</style>${this._getHTML(lang)}`;
    this._cacheElements();
  }

  _cacheElements() {
    const root = this.shadowRoot;
    this._els = {
      battRing:      root.getElementById('battRing'),
      battSOC:       root.getElementById('battSOC'),
      battStatus:    root.getElementById('battStatus'),
      battStatusDot: root.getElementById('battStatusDot'),
      battVolt:      root.getElementById('battVolt'),
      battCurr:      root.getElementById('battCurr'),
      battPow:       root.getElementById('battPow'),
      battAh:        root.getElementById('battAh'),
      battEnergy:    root.getElementById('battEnergy'),
      battTTELabel:  root.getElementById('battTTELabel'),
      battTTE:       root.getElementById('battTTE'),
      solActual:     root.getElementById('solActual'),
      sysCycles:     root.getElementById('sysCycles'),
      sysRuntime:    root.getElementById('sysRuntime'),
      sysThroughput: root.getElementById('sysThroughput'),
      sysMinCell:    root.getElementById('sysMinCell'),
      sysMaxCell:    root.getElementById('sysMaxCell'),
      sysFirmware:   root.getElementById('sysFirmware'),
      sysBmsModel:   root.getElementById('sysBmsModel'),
      battMosfetTemp:root.getElementById('battMosfetTemp'),
      sysConfig:     root.getElementById('sysConfig'),
      sysNominal:    root.getElementById('sysNominal'),
      sysCapacity:   root.getElementById('sysCapacity'),
      sysChemistry:  root.getElementById('sysChemistry'),
      wxSource:      root.getElementById('wxSource'),
      dashRoot:      root.querySelector('.dashboard-root'),
    };
  }

  // ============ INIT ============
  _init() {
    const root = this.shadowRoot;
    try {
      const lang = this._bridge._hass?.language || 'en';
      root.innerHTML = `<style>${STYLES}</style>${this._getHTML(lang)}`;

      // Cache frequently-queried element refs
      this._cacheElements();

      // Apply theme and enable JS-dependent animations
      this._applyTheme();
      const dashRoot = root.querySelector('.dashboard-root');
      if (dashRoot) dashRoot.classList.add('js-ready');
      this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this._themeHandler = () => this._applyTheme();
      this._mediaQuery.addEventListener('change', this._themeHandler);

      // Init solar engine
      const lat = this._bridge.latitude;
      const lon = this._bridge.longitude;
      const alt = this._bridge.elevation;
      if (lat != null && lon != null) {
        this._engine = new SolarEngine(lat, lon, alt, this._bridge.installDate);
        this._solarEngineReady = true;
      }

      // Init weather FX
      const weatherCanvas = root.getElementById('weatherParticles');
      if (weatherCanvas) {
        this._weatherFx = new WeatherFX(weatherCanvas);
        this._weatherFx.resize(window.innerWidth, window.innerHeight);
      }

      // Init charts
      this._charts = new ChartManager(this._bridge);
      this._charts.setThemeRoot(root.querySelector('.dashboard-root'));
      ['chartPower', 'chartSOC', 'chartSolar'].forEach(id => {
        this._charts.attachCrosshair(root.getElementById(id));
      });

      // Init flow particles
      this._flowPS1 = new FlowParticles(root, 'flowWrap1', 'flowParticles1', 'flowLine1', 'flowArc1', '#00F0FF');
      this._flowPS2 = new FlowParticles(root, 'flowWrap2', 'flowParticles2', 'flowLine2', 'flowArc2', '#FF453A');

      // Wire chart tab handlers
      const tabs = root.querySelectorAll('.chart-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const range = tab.dataset.range;
          tabs.forEach(t => t.classList.toggle('active', t.dataset.range === range));
          this._loadChartRange(range).catch(() => {});
        });
      });

      // Wire toggle handlers
      const chgToggle = root.getElementById('chgToggle');
      if (chgToggle) {
        chgToggle.addEventListener('change', () => {
          this._bridge._hass?.callService('switch', chgToggle.checked ? 'turn_on' : 'turn_off',
            { entity_id: this._bridge.E.CHG_SWITCH })?.catch(() => {});
        });
      }
      const dischgToggle = root.getElementById('dischgToggle');
      if (dischgToggle) {
        dischgToggle.addEventListener('change', () => {
          this._bridge._hass?.callService('switch', dischgToggle.checked ? 'turn_on' : 'turn_off',
            { entity_id: this._bridge.E.DISCHG_SWITCH })?.catch(() => {});
        });
      }

      // Start clock
      this._startClock();
      this._intervals.push(setInterval(() => this._startClock(), 1000));

      // Start calcTodayInOut
      this._calcTodayInOut().catch(() => {});
      this._intervals.push(setInterval(() => this._calcTodayInOut().catch(() => {}), 300000));

      // Start solar estimate update
      this._updateSolarEstimate();
      this._intervals.push(setInterval(() => this._updateSolarEstimate(), 300000));
      this._intervals.push(setInterval(() => this._updateWeather(), 300000));
      this._intervals.push(setInterval(() => this._updateSunMoonPosition(), 10000));
      this._intervals.push(setInterval(() => this._fetchISSPosition().catch(() => {}), 10000));
      this._fetchISSPosition().catch(() => {});

      // Start solar degradation UI (hourly)
      this._updateSolarUI();
      this._intervals.push(setInterval(() => this._updateSolarUI(), 3600000));

      // Cycle rate (7-day rolling) — fetch once on load, refresh hourly
      this._updateCycleRate().catch(() => {});
      this._intervals.push(setInterval(() => this._updateCycleRate().catch(() => {}), 3600000));


      // Resize handler
      this._resizeHandler = () => {
        if (this._resizeTimeout) clearTimeout(this._resizeTimeout);
        this._resizeTimeout = setTimeout(() => {
          if (this._weatherFx) this._weatherFx.resize(window.innerWidth, window.innerHeight);
        }, 300);
      };
      window.addEventListener('resize', this._resizeHandler);

      // Visibility handler — pause all animations when panel is hidden
      this._visibilityHandler = () => {
        if (document.hidden) {
          this._intervals.forEach(id => clearInterval(id));
          this._intervals = [];
          if (this._flowPS1) this._flowPS1.stop();
          if (this._flowPS2) this._flowPS2.stop();
          this._stopBattArcs();
          this._cancelAllAnimations();
          if (this._weatherFx) this._weatherFx.stop();
          if (this._meshRafId) { cancelAnimationFrame(this._meshRafId); this._meshRafId = null; }
          if (this._connCheckInterval) { clearInterval(this._connCheckInterval); this._connCheckInterval = null; }
        } else {
          // Restart all intervals
          this._intervals.push(setInterval(() => this._startClock(), 1000));
          this._intervals.push(setInterval(() => this._calcTodayInOut().catch(() => {}), 300000));
          this._intervals.push(setInterval(() => this._updateSolarEstimate(), 300000));
          this._intervals.push(setInterval(() => this._updateWeather(), 300000));
          this._intervals.push(setInterval(() => this._updateSunMoonPosition(), 10000));
          this._intervals.push(setInterval(() => this._fetchISSPosition().catch(() => {}), 10000));
          this._fetchISSPosition().catch(() => {});
          this._intervals.push(setInterval(() => this._updateSolarUI(), 3600000));
          this._intervals.push(setInterval(() => this._updateCycleRate().catch(() => {}), 3600000));
          // 24/7: restart connection health check
          this._connCheckInterval = setInterval(() => this._checkConnection(), 30000);
          this._startMeshLerp();
          this._startBattArcs();
          this._refreshAllUI();
        }
      };
      document.addEventListener('visibilitychange', this._visibilityHandler);

      // Start mesh gradient lerp loop
      this._startMeshLerp();

      // 24/7: WebSocket connection health check — every 30s
      this._connCheckInterval = setInterval(() => this._checkConnection(), 30000);

      // Initial full refresh + reveal
      this._refreshAllUI();

      // Staggered card reveal with fallback
      setTimeout(() => this._revealCards(), 200);
      this._revealFallbackTimeout = setTimeout(() => this._revealCards(), 2000); // fallback
    } catch (error) {
      console.error('[Solar] Init failed:', error);
      root.innerHTML = `<style>${STYLES}</style>
<div class="dashboard-root" data-theme="dark">
  <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;">
    <div style="background:var(--glass-bg,rgba(30,30,30,0.8));border:1px solid var(--red,rgba(255,59,48,0.3));border-radius:16px;padding:32px;max-width:500px;text-align:center;backdrop-filter:blur(12px);">
      <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
      <h2 style="color:var(--red,#ff3b30);margin:0 0 8px;">Solar Dashboard</h2>
      <p style="color:var(--text2,#9ca3af);margin:0 0 16px;font-size:14px;">Failed to initialize</p>
      <pre style="color:var(--text3,#6b7280);font-size:12px;text-align:left;background:rgba(0,0,0,0.3);padding:12px;border-radius:8px;overflow:auto;max-height:200px;white-space:pre-wrap;word-break:break-word;">${error.message}\n${error.stack || ''}</pre>
      <p style="color:var(--text3,#6b7280);font-size:11px;margin:16px 0 0;">Check browser console for details</p>
    </div>
  </div>
</div>`;
    }
  }

  disconnectedCallback() {
    this._intervals.forEach(id => clearInterval(id));
    this._intervals = [];
    if (this._flowPS1) this._flowPS1.stop();
    if (this._flowPS2) this._flowPS2.stop();
    if (this._weatherFx) this._weatherFx.destroy();
    if (this._charts) this._charts.detachAll();
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    if (this._visibilityHandler) document.removeEventListener('visibilitychange', this._visibilityHandler);
    if (this._mediaQuery && this._themeHandler) this._mediaQuery.removeEventListener('change', this._themeHandler);
    this._stopBattArcs();
    this._cancelAllAnimations();
    if (this._meshRafId) { cancelAnimationFrame(this._meshRafId); this._meshRafId = null; }
    if (this._updateRafId) { cancelAnimationFrame(this._updateRafId); this._updateRafId = null; }
    if (this._connCheckInterval) { clearInterval(this._connCheckInterval); this._connCheckInterval = null; }
    this._cardsRevealed = false;
  }

  // ============ THEME ============
  _applyTheme() {
    const root = this.shadowRoot.querySelector('.dashboard-root');
    if (!root) return;
    const hass = this._bridge._hass;
    const darkMode = hass?.themes?.darkMode ?? window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = darkMode ? 'dark' : 'light';
    if (this._charts) this._charts.updateTheme();
  }

  // ============ 24/7: CONNECTION HEALTH CHECK ============
  _checkConnection() {
    if (document.hidden) return; // skip when tab hidden — visibility handler manages this
    if (!this._lastHassUpdate) return; // no hass received yet
    const stale = Date.now() - this._lastHassUpdate;
    if (stale > 60000 && !this._connLost) {
      this._connLost = true;
      this._showConnLostBanner();
    } else if (stale <= 60000 && this._connLost) {
      this._connLost = false;
      this._hideConnLostBanner();
    }
  }

  _showConnLostBanner() {
    const root = this.shadowRoot;
    if (!root) return;
    let banner = root.getElementById('connLostBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'connLostBanner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:rgba(255,59,48,0.9);color:#fff;text-align:center;padding:8px 16px;font-size:13px;font-weight:600;backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;gap:8px;';
      banner.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#fff;animation:pulse 1.5s ease-in-out infinite;"></span> Connection to Home Assistant lost — showing last known data';
      root.appendChild(banner);
    }
    banner.style.display = 'flex';
  }

  _hideConnLostBanner() {
    const root = this.shadowRoot;
    if (!root) return;
    const banner = root.getElementById('connLostBanner');
    if (banner) banner.style.display = 'none';
  }

  // ============ HTML TEMPLATE ============
  _getHTML(lang) {
    return `
<div class="dashboard-root" data-theme="dark">
<canvas id="weatherParticles"></canvas>
<div class="container">
  <header class="header">
    <div style="display:flex;align-items:center;gap:12px">
      <h1 style="font-size:24px;font-weight:700">${t(lang, 'solar')}</h1>
      <div class="live-dot"></div>
      <span style="font-size:12px;font-weight:600;color:var(--green)">${t(lang, 'live')}</span>
    </div>
    <div id="clock" style="font-size:14px;font-weight:500;color:var(--text2)"></div>
  </header>
  <div class="top-row">
    <div class="card" id="batteryHero">
      <h2 class="section-title">${t(lang, 'battery')}</h2>
      <div style="display:flex;flex-direction:column;align-items:center;">
        <svg viewBox="0 0 200 200" width="200" height="200">
          <circle cx="100" cy="100" r="80" fill="none" stroke="var(--glass-border)" stroke-width="10"/>
          <circle id="battRing" class="batt-ring" cx="100" cy="100" r="80" fill="none" stroke="var(--green)" stroke-width="10" stroke-dasharray="0 502.65" stroke-linecap="round"/>
          <text id="battSOC" x="100" y="108" text-anchor="middle" dominant-baseline="middle" class="batt-soc" fill="var(--text)" style="filter:drop-shadow(0 0 8px var(--green-glow))">0%</text>
        </svg>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
          <div id="battStatusDot" style="width:8px;height:8px;border-radius:50%;background:var(--text2);animation:pulse 2s ease-in-out infinite;"></div>
          <span id="battStatus" style="font-size:13px;font-weight:600;">${t(lang, 'idle')}</span>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat-item"><div class="stat-val" id="battVolt">--</div><div class="stat-label">${t(lang, 'voltage')}</div></div>
        <div class="stat-item"><div class="stat-val" id="battCurr">--</div><div class="stat-label">${t(lang, 'current')}</div></div>
        <div class="stat-item"><div class="stat-val" id="battPow">--</div><div class="stat-label">${t(lang, 'power')}</div></div>
        <div class="stat-item"><div class="stat-val" id="battAh">--</div><div class="stat-label">${t(lang, 'remaining')}</div></div>
      </div>
      <div class="stat-grid">
        <div class="stat-item"><div class="stat-val" id="battEnergy">--</div><div class="stat-label">${t(lang, 'energy')}</div></div>
        <div class="stat-item"><div class="stat-val" id="battTodayIn">--</div><div class="stat-label">${t(lang, 'todayIn')}</div></div>
        <div class="stat-item"><div class="stat-val" id="battTodayOut">--</div><div class="stat-label">${t(lang, 'todayOut')}</div></div>
        <div class="stat-item"><div class="stat-val" id="battTTE">--</div><div class="stat-label" id="battTTELabel">${t(lang, 'tte')}</div></div>
      </div>
      <div class="stat-divider"></div>
      <div class="info-row">
        <div class="inf"><div class="inf-v" id="sysCycles">--</div><div class="inf-k">${t(lang, 'cycles')}</div></div>
        <div class="inf"><div class="inf-v" id="sysCapacity">215 Ah</div><div class="inf-k">${t(lang, 'capacity')}</div></div>
        <div class="inf"><div class="inf-v" id="sysNominal">51.2 V</div><div class="inf-k">${t(lang, 'nominal')}</div></div>
        <div class="inf"><div class="inf-v" id="sysConfig">16S</div><div class="inf-k">${t(lang, 'config')}</div></div>
      </div>
      <div class="info-row">
        <div class="inf"><div class="inf-v" id="sysMinCell">-- V</div><div class="inf-k">${t(lang, 'minCell')}</div></div>
        <div class="inf"><div class="inf-v" id="sysMaxCell">-- V</div><div class="inf-k">${t(lang, 'maxCell')}</div></div>
        <div class="inf"><div class="inf-v" id="sysRuntime">--</div><div class="inf-k">${t(lang, 'runtime')}</div></div>
        <div class="inf"><div class="inf-v" id="sysThroughput">--</div><div class="inf-k">${t(lang, 'throughput')}</div></div>
      </div>
      <div class="info-row">
        <div class="inf"><div class="inf-v" id="battMosfetTemp">--</div><div class="inf-k">${t(lang, 'mosfet')}</div></div>
        <div class="inf"><div class="inf-v" id="sysBmsModel">--</div><div class="inf-k">${t(lang, 'bmsModel')}</div></div>
        <div class="inf"><div class="inf-v" id="sysFirmware">--</div><div class="inf-k">${t(lang, 'firmware')}</div></div>
        <div class="inf"><div class="inf-v" id="sysChemistry">LiFePO\u2084</div><div class="inf-k">${t(lang, 'chemistry')}</div></div>
      </div>
    </div>
    <div class="right-col">
      <div class="card" id="powerFlow">
        <h2 class="section-title">${t(lang, 'powerFlow')}</h2>
        <div class="flow">
          <div class="flow-node">
            <div class="flow-icon" id="iconSolar">
              <svg viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="8"/>
                <line x1="24" y1="4" x2="24" y2="10"/>
                <line x1="24" y1="38" x2="24" y2="44"/>
                <line x1="4" y1="24" x2="10" y2="24"/>
                <line x1="38" y1="24" x2="44" y2="24"/>
                <line x1="9.37" y1="9.37" x2="13.6" y2="13.6"/>
                <line x1="34.4" y1="34.4" x2="38.63" y2="38.63"/>
                <line x1="38.63" y1="9.37" x2="34.4" y2="13.6"/>
                <line x1="13.6" y1="34.4" x2="9.37" y2="38.63"/>
              </svg>
            </div>
            <span class="flow-label">${t(lang, 'solarNode')}</span>
          </div>
          <div class="flow-line-wrap" id="flowWrap1">
            <div class="flow-line" id="flowLine1"></div>
            <canvas class="flow-arc-canvas" id="flowArc1"></canvas>
            <div class="flow-particles" id="flowParticles1"><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div></div>
            <span class="flow-watt" id="flowWatt1">0 W</span>
          </div>
          <div class="flow-node">
            <div class="flow-icon" id="iconBattery" style="position:relative;">
              <svg viewBox="0 0 48 48">
                <rect x="8" y="14" width="32" height="24" rx="3" ry="3"/>
                <rect x="19" y="10" width="10" height="4" rx="2" ry="2"/>
              </svg>
              <svg id="battArcs" viewBox="0 0 48 48" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></svg>
            </div>
            <span class="flow-label">${t(lang, 'batteryNode')}</span>
          </div>
          <div class="flow-line-wrap" id="flowWrap2">
            <div class="flow-line" id="flowLine2"></div>
            <canvas class="flow-arc-canvas" id="flowArc2"></canvas>
            <div class="flow-particles" id="flowParticles2"><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div><div class="flow-dot"></div></div>
            <span class="flow-watt" id="flowWatt2">0 W</span>
          </div>
          <div class="flow-node">
            <div class="flow-icon" id="iconHome">
              <svg viewBox="0 0 48 48">
                <polyline points="6,22 24,6 42,22"/>
                <rect x="14" y="22" width="20" height="20" rx="2" ry="2"/>
                <rect class="home-window" x="17" y="28" width="5" height="5" rx="0.5"/>
                <rect class="home-window" x="26" y="28" width="5" height="5" rx="0.5"/>
              </svg>
            </div>
            <span class="flow-label">${t(lang, 'home')}</span>
          </div>
        </div>
      </div>
      <div class="card" id="solarCard">
        <h2 class="section-title">${t(lang, 'solarPanels')}</h2>
        <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
          <span id="solActual" class="sol-output" style="color:var(--green)">-- W</span>
          <span style="font-size:13px;color:var(--text2)">${t(lang, 'actual')}</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:12px;margin-top:4px;flex-wrap:wrap">
          <span id="solOutput" style="font-size:20px;font-weight:700;color:var(--orange)">--- W</span>
          <span style="font-size:13px;color:var(--text2)">${t(lang, 'estimated')}</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:8px;margin-top:4px;flex-wrap:wrap">
          <span id="solTodayGen" style="font-size:15px;font-weight:600;color:var(--green)">--</span>
          <span style="font-size:12px;color:var(--text3)">${t(lang, 'generatedToday')}</span>
          <span style="font-size:12px;color:var(--text3)">&middot;</span>
          <span id="solForecast" style="font-size:15px;font-weight:600;color:var(--text2)">--</span>
          <span style="font-size:12px;color:var(--text3)">${t(lang, 'expected')}</span>
        </div>
        <div class="health-bar"><div class="health-fill" id="solDegFill"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;">
          <span id="solHealthPct" style="color:var(--green)">--%</span>
          <span id="solDegPct" style="color:var(--red)">--%</span>
        </div>
        <div class="stat-grid">
          <div class="stat-item"><div class="stat-val" id="solRated">--</div><div class="stat-label">${t(lang, 'rated')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solInstalled">--</div><div class="stat-label">${t(lang, 'installed')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solAge">--</div><div class="stat-label">${t(lang, 'age')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solModel">--</div><div class="stat-label">${t(lang, 'model')}</div></div>
        </div>
        <div class="stat-grid">
          <div class="stat-item"><div class="stat-val" id="solType">--</div><div class="stat-label">${t(lang, 'type')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solYr1">--</div><div class="stat-label">${t(lang, 'year1Loss')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solYrN">--</div><div class="stat-label">${t(lang, 'annualLoss')}</div></div>
          <div class="stat-item"><div class="stat-val" id="solNextYr">--</div><div class="stat-label">${t(lang, 'nextYear')}</div></div>
        </div>
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--glass-border)">
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:1px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center"><span>${t(lang, 'weather')}</span><span id="wxSource" style="font-size:9px;font-weight:500;letter-spacing:0.4px;opacity:0.45;text-transform:none"></span></div>
          <div class="stat-grid">
            <div class="stat-item"><div class="stat-val" id="wxCondition">--</div><div class="stat-label">${t(lang, 'condition')}</div></div>
            <div class="stat-item"><div class="stat-val" id="wxTemp">--</div><div class="stat-label">${t(lang, 'temp')}</div></div>
            <div class="stat-item"><div class="stat-val" id="wxCloud">--</div><div class="stat-label">${t(lang, 'cloud')}</div></div>
            <div class="stat-item"><div class="stat-val" id="wxHumid">--</div><div class="stat-label">${t(lang, 'humidity')}</div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="card" id="chartsCard" style="margin-bottom:16px">
    <h2 class="section-title">${t(lang, 'analytics')}</h2>
    <div class="chart-tabs" id="chartTabs">
      <button class="chart-tab active" data-range="Live">${t(lang, 'tabLive')}</button>
      <button class="chart-tab" data-range="1D">${t(lang, 'tabYesterday')}</button>
      <button class="chart-tab" data-range="7D">${t(lang, 'tab7Days')}</button>
      <button class="chart-tab" data-range="30D">${t(lang, 'tab30Days')}</button>
    </div>
    <div class="chart-grid">
      <div class="chart-wrap">
        <div class="chart-title">${t(lang, 'chartPower')}</div>
        <div class="chart-value"><span id="pwrVal">--</span></div>
        <canvas id="chartPower"></canvas>
      </div>
      <div class="chart-wrap">
        <div class="chart-title">${t(lang, 'chartBatterySOC')}</div>
        <div class="chart-value"><span id="socVal">--</span></div>
        <canvas id="chartSOC"></canvas>
      </div>
      <div class="chart-wrap">
        <div class="chart-title">${t(lang, 'chartSolar')}</div>
        <div class="chart-value"><span id="solVal">--</span></div>
        <canvas id="chartSolar"></canvas>
        <div style="display:flex;gap:12px;margin-top:6px;font-size:11px;">
          <span style="color:var(--green);font-weight:600;">&#9632; ${t(lang, 'legendActual')}</span>
          <span id="solarOverlayLabel" style="color:var(--orange);font-weight:600;">&#9632; ${t(lang, 'legendEstimated')}</span>
        </div>
      </div>
    </div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="cells-grid">
      <div id="pack1Card">
        <h2 class="section-title">${t(lang, 'cellsC1C8')}</h2>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:12px;color:var(--text2)">${t(lang, 'temperature')}</span>
          <span id="pack1Temp" style="font-size:14px;font-weight:600">-- \u00B0C</span>
        </div>
        <div id="pack1"></div>
      </div>
      <div id="pack2Card" style="border-left:1px solid var(--glass-border);padding-left:24px">
        <h2 class="section-title">${t(lang, 'cellsC9C16')}</h2>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:12px;color:var(--text2)">${t(lang, 'temperature')}</span>
          <span id="pack2Temp" style="font-size:14px;font-weight:600">-- \u00B0C</span>
        </div>
        <div id="pack2"></div>
      </div>
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--glass-border)">
      <div id="balIndicator" style="text-align:center;font-size:14px;font-weight:600;color:var(--orange);display:none">
        <span id="balSrc">C1</span> <span style="color:var(--red)">\u25B2</span> <span class="bal-arrow">\u2192</span> <span class="bal-arrow">\u2192</span> <span class="bal-arrow">\u2192</span> <span style="color:var(--text3)">\u21C4</span> <span class="bal-arrow">\u2192</span> <span class="bal-arrow">\u2192</span> <span class="bal-arrow">\u2192</span> <span id="balDst">C12</span> <span style="color:var(--green)">\u25BC</span>
      </div>
      <div id="balStatus" style="text-align:center;font-size:13px;font-weight:600;color:var(--text2)"></div>
    </div>
  </div>
  <div class="bottom-row">
    <div class="card" id="controlsCard">
      <h2 class="section-title">${t(lang, 'controls')}</h2>
      <div class="ctrl">
        <div><div class="ctrl-name">${t(lang, 'ctrlCharging')}</div><div class="ctrl-desc">${t(lang, 'descCharging')}</div></div>
        <label class="toggle"><input type="checkbox" id="chgToggle" checked><span class="slider"></span></label>
      </div>
      <div class="ctrl">
        <div><div class="ctrl-name">${t(lang, 'ctrlDischarging')}</div><div class="ctrl-desc">${t(lang, 'descDischarging')}</div></div>
        <label class="toggle"><input type="checkbox" id="dischgToggle" checked><span class="slider"></span></label>
      </div>
      <div class="ctrl">
        <div><div class="ctrl-name">${t(lang, 'ctrlBalancer')}</div><div class="ctrl-desc" id="balDesc">--</div></div>
        <div id="balSwitch" style="display:flex;align-items:center;gap:6px">
          <span id="balSwitchLabel" style="font-size:12px;font-weight:600;color:var(--text2)">--</span>
          <div id="balDot" style="width:8px;height:8px;border-radius:50%;background:var(--text3)"></div>
        </div>
      </div>
    </div>
  </div>
</div>
</div>`;
  }

  // ============ ANIMATION ENGINE ============
  // ============ P7: Centralized Animation Loop ============
  _animateValue(el, from, to, duration, formatter) {
    if (!el) return;
    if (from === to) {
      if (el.textContent === '--' || el.textContent === '') el.textContent = formatter(to);
      return;
    }
    if (Math.abs(to - from) < 0.01) { el.textContent = formatter(to); return; }

    // Cancel any existing animation for this element
    for (let i = this._animations.length - 1; i >= 0; i--) {
      if (this._animations[i].el === el) {
        this._animations[i].done = true;
        this._animations.splice(i, 1);
      }
    }

    this._animations.push({ el, from, to, duration, formatter, start: performance.now(), done: false });
    if (!this._animRafId) this._animRafId = requestAnimationFrame((t) => this._animationLoop(t));
  }

  _animationLoop(now) {
    this._animRafId = null;
    const len = this._animations.length;
    for (let i = len - 1; i >= 0; i--) {
      const a = this._animations[i];
      if (a.done) { this._animations.splice(i, 1); continue; }
      const t = Math.min((now - a.start) / a.duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      a.el.textContent = a.formatter(a.from + (a.to - a.from) * eased);
      if (t < 1) continue;
      // Animation complete — flash effect
      this._animations.splice(i, 1);
      a.el.classList.remove('val-flash');
      void a.el.offsetWidth;
      a.el.classList.add('val-flash');
      const _cleanFlash = () => a.el.classList.remove('val-flash');
      const _flashTimer = setTimeout(_cleanFlash, 1000);
      a.el._flashTimer = _flashTimer;
      a.el.addEventListener('animationend', () => { clearTimeout(a.el._flashTimer); _cleanFlash(); a.el._flashTimer = null; }, { once: true, passive: true });
    }
    if (this._animations.length > 0) {
      this._animRafId = requestAnimationFrame((t) => this._animationLoop(t));
    }
  }

  _cancelAllAnimations() {
    if (this._animRafId) { cancelAnimationFrame(this._animRafId); this._animRafId = null; }
    for (const a of this._animations) {
      a.done = true;
      if (a.el._flashTimer) { clearTimeout(a.el._flashTimer); a.el._flashTimer = null; }
    }
    this._animations = [];
  }

  // ============ UI UPDATE DISPATCHER ============
  _updateUI(changedEntities) {
    const root = this.shadowRoot;
    if (!root || !this._bridge._hass) return;
    const E = this._bridge.E;
    const lang = this._bridge._hass.language || 'en';
    const batteryEntities = [E.SOC, E.VOLTAGE, E.CURRENT, E.POWER, E.REMAINING,
      E.CYCLES, E.RUNTIME, E.THROUGHPUT, E.MIN_CELL_V, E.MAX_CELL_V,
      E.MIN_V_CELL, E.MAX_V_CELL, E.FIRMWARE, E.MANUFACTURER, E.STRINGS,
      E.MOSFET_TEMP, E.CHG_POWER, E.DISCHG_POWER];
    const hasBatteryChange = changedEntities.some(id => batteryEntities.includes(id));

    if (hasBatteryChange) {
      // Build a single snapshot so each entity's getVal (parseFloat) is called exactly once.
      const snap = {
        soc:        this._bridge.getVal(E.SOC),
        voltage:    this._bridge.getVal(E.VOLTAGE),
        current:    this._bridge.getVal(E.CURRENT),
        power:      this._bridge.getVal(E.POWER),
        remaining:  this._bridge.getVal(E.REMAINING),
        chgPower:   this._bridge.getVal(E.CHG_POWER),
        dischgPower:this._bridge.getVal(E.DISCHG_POWER),
        cycles:     this._bridge.getVal(E.CYCLES),
        throughput: this._bridge.getVal(E.THROUGHPUT),
        minCellV:   this._bridge.getVal(E.MIN_CELL_V),
        maxCellV:   this._bridge.getVal(E.MAX_CELL_V),
        mosfetTemp: this._bridge.getVal(E.MOSFET_TEMP),
        strings:    this._bridge.getVal(E.STRINGS),
      };
      this._updateBattery(snap);
      this._updatePowerFlow(snap);
      this._updateChartValues(snap);
    }

    const hasCellChange = changedEntities.some(id =>
      id.includes('cell_voltage_') || id === E.BALANCING);
    if (hasCellChange) this._updateCellBalance();

    const hasWeatherChange = changedEntities.some(id => id.startsWith('weather.'));
    if (hasWeatherChange) this._updateWeather();

    // Temperature updates
    for (const eid of changedEntities) {
      const val = this._bridge.getStrVal(eid);
      const unavail = val == null;

      if (eid === E.TEMP1) {
        const el = root.getElementById('pack1Temp');
        if (unavail) el.textContent = '--';
        else { const old = parseFloat(el.textContent) || 0; this._animateValue(el, old, parseFloat(val), 600, v => v.toFixed(1) + ' \u00B0C'); }
      }
      if (eid === E.TEMP2) {
        const el = root.getElementById('pack2Temp');
        if (unavail) el.textContent = '--';
        else { const old = parseFloat(el.textContent) || 0; this._animateValue(el, old, parseFloat(val), 600, v => v.toFixed(1) + ' \u00B0C'); }
      }
      if (eid === E.BAL_SWITCH || eid === E.BALANCING) {
        const switchOn = this._bridge.getStrVal(E.BAL_SWITCH) === 'on';
        const active = this._bridge.getStrVal(E.BALANCING) === 'on';
        const label = root.getElementById('balSwitchLabel');
        const dot = root.getElementById('balDot');
        const desc = root.getElementById('balDesc');
        if (!switchOn) {
          label.textContent = t(lang, 'balDisabled');
          label.style.color = 'var(--red)';
          dot.style.background = 'var(--red)';
          dot.style.boxShadow = '0 0 6px var(--red-glow)';
          desc.textContent = t(lang, 'balOff');
        } else if (active) {
          label.textContent = t(lang, 'balancing');
          label.style.color = 'var(--orange)';
          dot.style.background = 'var(--orange)';
          dot.style.boxShadow = '0 0 6px var(--orange-glow)';
          desc.textContent = t(lang, 'balActive');
        } else {
          label.textContent = t(lang, 'idle');
          label.style.color = 'var(--green)';
          dot.style.background = 'var(--green)';
          dot.style.boxShadow = '0 0 6px var(--green-glow)';
          desc.textContent = t(lang, 'balEnabledIdle');
        }
      }
      if (eid === E.CHG_SWITCH) root.getElementById('chgToggle').checked = val === 'on';
      if (eid === E.DISCHG_SWITCH) root.getElementById('dischgToggle').checked = val === 'on';
    }
  }

  // ============ BATTERY UPDATE ============
  _updateBattery(snap) {
    const root = this.shadowRoot;
    const E = this._bridge.E;
    const soc = snap.soc;
    const voltage = snap.voltage;
    const current = snap.current;
    const power = snap.power;
    const remaining = snap.remaining;
    const battSpec = this._bridge.battSpec;

    const r = 80, circ = 2 * Math.PI * r;
    const ring = this._els.battRing;
    if (soc != null) {
      const socEl = this._els.battSOC;
      const oldSoc = parseFloat(socEl.textContent) || 0;
      this._animateValue(socEl, oldSoc, soc, 600, v => Math.round(v) + '%');
      ring.style.strokeDasharray = `${circ * soc / 100} ${circ}`;
      ring.style.stroke = soc < 20 ? 'var(--red)' : soc < 40 ? 'var(--orange)' : 'var(--green)';
    } else {
      this._els.battSOC.textContent = '--%';
      ring.style.strokeDasharray = `0 ${circ}`;
      ring.style.stroke = 'var(--secondary-text)';
    }

    const cur = current || 0;
    // I15: Derive idle threshold from battery capacity (0.5% of fullAh)
    const idleThreshold = 0.005 * (this._bridge.battSpec?.fullAh || 100);
    const lang = this._bridge._hass?.language || 'en';
    const status = cur > idleThreshold ? t(lang, 'charging') : cur < -idleThreshold ? t(lang, 'discharging') : t(lang, 'idle');
    const statusColor = status === t(lang, 'charging') ? 'var(--green)' : status === t(lang, 'discharging') ? 'var(--red)' : 'var(--text2)';
    this._els.battStatus.textContent = status;
    this._els.battStatus.style.color = statusColor;
    this._els.battStatusDot.style.background = statusColor;

    if (voltage != null) {
      const el = this._els.battVolt;
      this._animateValue(el, parseFloat(el.textContent) || 0, voltage, 600, v => v.toFixed(2) + ' V');
    } else this._els.battVolt.textContent = '--';

    if (current != null) {
      const el = this._els.battCurr;
      this._animateValue(el, parseFloat(el.textContent) || 0, Math.abs(current), 600, v => v.toFixed(2) + ' A');
    } else this._els.battCurr.textContent = '--';

    const chgPower = snap.chgPower;
    const dischgPower = snap.dischgPower;
    const battPower = chgPower > 0 ? chgPower : dischgPower > 0 ? dischgPower : power != null ? Math.abs(power) : null;
    if (battPower != null) {
      const el = this._els.battPow;
      this._animateValue(el, parseFloat(el.textContent) || 0, battPower, 600, v => Math.round(v) + ' W');
    } else this._els.battPow.textContent = '--';

    if (remaining != null) {
      const el = this._els.battAh;
      this._animateValue(el, parseFloat(el.textContent) || 0, remaining, 600, v => v.toFixed(2) + ' Ah');
    } else this._els.battAh.textContent = '--';

    // Energy
    const energyEl = this._els.battEnergy;
    if (remaining > 0 && voltage > 0) {
      this._animateValue(energyEl, parseFloat(energyEl.textContent) || 0, remaining * voltage / 1000, 600, v => v.toFixed(2) + ' kWh');
    } else energyEl.textContent = '--';

    // Time to empty/full
    let tte = '--';
    const tteLabel = this._els.battTTELabel;
    const fmtDHM = (hours) => {
      let totalMin = Math.round(hours * 60);
      const d = Math.floor(totalMin / 1440);
      totalMin %= 1440;
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return (d > 0 ? d + ':' : '') + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    };
    if (cur < -idleThreshold && remaining > 0) {
      tte = fmtDHM(remaining / Math.abs(cur));
      if (tteLabel) tteLabel.textContent = t(lang, 'tte');
    } else if (cur > idleThreshold) {
      if (soc != null && soc < 100 && remaining > 0) {
        const toFill = battSpec.fullAh - remaining;
        if (toFill > 0) tte = fmtDHM(toFill / cur);
        else tte = '\u221E (' + t(lang, 'charging') + ')';
      } else {
        tte = '\u221E (' + t(lang, 'charging') + ')';
      }
      if (tteLabel) tteLabel.textContent = t(lang, 'ttf');
    } else {
      tte = '\u221E (' + t(lang, 'idle') + ')';
      if (tteLabel) tteLabel.textContent = t(lang, 'tte');
    }
    this._els.battTTE.textContent = tte;

    // Update actual solar (charging power = solar input)
    const solarActual = chgPower > 0 ? chgPower : (cur > 0 ? Math.abs(power || 0) : 0);
    const solActualEl = this._els.solActual;
    this._animateValue(solActualEl, parseFloat(solActualEl.textContent) || 0, solarActual, 600, v => Math.round(v) + ' W');

    // System info updates
    const cycles = snap.cycles;
    if (cycles != null) {
      const el = this._els.sysCycles;
      const old = parseFloat(el.textContent) || 0;
      this._animateValue(el, old, cycles, 600, v => {
        const rate = this._cycleRatePerDay;
        return Math.round(v) + (rate != null ? ` (${rate}/d)` : '');
      });
    }

    const runtime = this._bridge.getStrVal(E.RUNTIME);
    this._els.sysRuntime.textContent = runtime ?? '--';

    const throughput = snap.throughput;
    if (throughput != null) {
      const el = this._els.sysThroughput;
      const nomV = this._bridge.battSpec?.nomV || 52;
      const throughputKwh = throughput * nomV / 1000;
      const old = parseFloat(el.textContent) || 0;
      this._animateValue(el, old, throughputKwh, 600, v => Math.round(v) + ' kWh (' + Math.round(throughput) + ' Ah)');
    }

    const minCellV = snap.minCellV;
    if (minCellV != null) {
      const el = this._els.sysMinCell;
      const old = parseFloat(el.textContent) || 0;
      const cellNum = parseInt(this._bridge.getStrVal(E.MIN_V_CELL)) || '?';
      this._animateValue(el, old, minCellV, 600, v => v.toFixed(3) + ' V (C' + cellNum + ')');
    } else this._els.sysMinCell.textContent = '-- V';

    const maxCellV = snap.maxCellV;
    if (maxCellV != null) {
      const el = this._els.sysMaxCell;
      const old = parseFloat(el.textContent) || 0;
      const cellNum = parseInt(this._bridge.getStrVal(E.MAX_V_CELL)) || '?';
      this._animateValue(el, old, maxCellV, 600, v => v.toFixed(3) + ' V (C' + cellNum + ')');
    } else this._els.sysMaxCell.textContent = '-- V';

    const firmware = this._bridge.getStrVal(E.FIRMWARE);
    if (this._els.sysFirmware) this._els.sysFirmware.textContent = firmware ? firmware.replace(/[^\x20-\x7E]/g, '').replace(/_+/g, ' ').trim() : '--';

    const manufacturer = this._bridge.getStrVal(E.MANUFACTURER);
    if (manufacturer) {
      const c = manufacturer.replace(/[^\x20-\x7E]/g, '').trim();
      const m = c.match(/JK\S*/);
      if (this._els.sysBmsModel) this._els.sysBmsModel.textContent = m ? m[0] : c;
    } else if (this._els.sysBmsModel) this._els.sysBmsModel.textContent = '--';

    const mosfetTemp = snap.mosfetTemp;
    if (mosfetTemp != null) {
      const el = this._els.battMosfetTemp;
      const old = parseFloat(el.textContent) || 0;
      this._animateValue(el, old, mosfetTemp, 600, v => v.toFixed(1) + ' \u00B0C');
    } else if (this._els.battMosfetTemp) this._els.battMosfetTemp.textContent = '--';

    // Dynamic battery specs
    const strings = snap.strings;
    if (strings > 0) {
      this._bridge.battSpec.strings = strings;
      this._bridge.battSpec.nomV = strings * this._bridge.battSpec.voltsPerCell;
      if (this._els.sysConfig) this._els.sysConfig.textContent = strings + 'S';
      const nomEl = this._els.sysNominal;
      const oldNom = parseFloat(nomEl.textContent) || 0;
      this._animateValue(nomEl, oldNom, this._bridge.battSpec.nomV, 600, v => v.toFixed(1) + ' V');
    }

    if (remaining > 0 && soc > 10) {
      this._bridge.battSpec.fullAh = Math.round(remaining / (soc / 100));
      const capEl = this._els.sysCapacity;
      const oldCap = parseFloat(capEl.textContent) || 0;
      this._animateValue(capEl, oldCap, this._bridge.battSpec.fullAh, 600, v => Math.round(v) + ' Ah');
    }

    // Update chemistry display
    const chemEl = this._els.sysChemistry;
    if (chemEl) chemEl.textContent = this._bridge.battSpec.chemistry;
  }

  // ============ POWER FLOW ============
  _powerToAnimSpeed(watts) {
    const t = Math.min(Math.abs(watts), 1500) / 1500;
    return (2.5 - t * 2.1).toFixed(2) + 's';
  }

  _setIconGlow(id, cls, watts) {
    // P4: Lazy-cache dynamic icon refs (iconSolar, iconGrid, iconHome)
    const el = this._els[id] || (this._els[id] = this.shadowRoot.getElementById(id));
    if (!el) return;
    const newClass = 'flow-icon ' + cls;
    if (el.className !== newClass) el.className = newClass;
    if (watts != null) el.style.setProperty('--anim-speed', this._powerToAnimSpeed(watts));
  }

  _updatePowerFlow(snap) {
    const root = this.shadowRoot;
    const current = snap.current || 0;
    const dischgPower = snap.dischgPower;
    const chgPower = snap.chgPower;
    const netPower = Math.abs(snap.power || 0);
    const power = dischgPower > 0 ? dischgPower : chgPower > 0 ? chgPower : netPower;
    const solarW = chgPower > 0 ? chgPower : (current > 0 ? power : 0);
    const batteryW = dischgPower > 0 ? dischgPower : power;
    // I15: Derive idle threshold from battery capacity (0.5% of fullAh)
    const idleThreshold = 0.005 * (this._bridge.battSpec?.fullAh || 100);
    const charging = current > idleThreshold;
    const discharging = current < -idleThreshold;

    this._setIconGlow('iconSolar', solarW > 10 ? 'icon-sun-active' : 'glow-dim', solarW);

    if (!this._els.flowWrap1) {
      this._els.flowWrap1 = root.getElementById('flowWrap1');
      this._els.flowWatt1 = root.getElementById('flowWatt1');
      this._els.flowWrap2 = root.getElementById('flowWrap2');
      this._els.flowWatt2 = root.getElementById('flowWatt2');
    }
    const wrap1 = this._els.flowWrap1;
    const watt1 = this._els.flowWatt1;
    if (charging) {
      wrap1.classList.remove('flow-idle');
      this._animateValue(watt1, parseFloat(watt1.textContent) || 0, Math.round(solarW), 600, v => Math.round(v) + ' W');
      watt1.style.color = '#00F0FF';
      if (this._flowPS1) this._flowPS1.start(solarW);
    } else {
      wrap1.classList.add('flow-idle');
      this._animateValue(watt1, parseFloat(watt1.textContent) || 0, 0, 600, v => Math.round(v) + ' W');
      watt1.style.color = 'var(--text2)';
      if (this._flowPS1) this._flowPS1.stop();
    }

    this._setIconGlow('iconBattery', charging ? 'icon-batt-charge' : discharging ? 'icon-batt-discharge' : 'glow-dim', Math.abs(batteryW));
    this._battArcPowerW = Math.abs(batteryW);
    if (charging || discharging) {
      const arcColor = charging ? '#00F0FF' : '#FF453A';
      this._startBattArcs(arcColor);
    } else {
      this._stopBattArcs();
    }

    const wrap2 = this._els.flowWrap2;
    const watt2 = this._els.flowWatt2;
    if (discharging) {
      wrap2.classList.remove('flow-idle');
      this._animateValue(watt2, parseFloat(watt2.textContent) || 0, Math.round(Math.abs(batteryW)), 600, v => Math.round(v) + ' W');
      watt2.style.color = 'var(--red)';
      if (this._flowPS2) this._flowPS2.start(Math.abs(batteryW));
    } else {
      wrap2.classList.add('flow-idle');
      this._animateValue(watt2, parseFloat(watt2.textContent) || 0, 0, 600, v => Math.round(v) + ' W');
      watt2.style.color = 'var(--text2)';
      if (this._flowPS2) this._flowPS2.stop();
    }

    this._setIconGlow('iconHome', discharging ? 'icon-home-active' : charging ? 'icon-home-idle' : 'glow-dim', Math.abs(batteryW));
  }

  // ============ CHART VALUE DISPLAYS ============
  _updateChartValues(snap) {
    const root = this.shadowRoot;

    // Live view: show real-time values from HA
    if (this._activeChartRange === 'Live') {
      const dischgPower = snap.dischgPower;
      const chgPower    = snap.chgPower;
      const power       = snap.power;
      const soc         = snap.soc;
      if (!this._els.pwrVal) {
        this._els.pwrVal = root.getElementById('pwrVal');
        this._els.socVal = root.getElementById('socVal');
        this._els.solVal = root.getElementById('solVal');
      }
      const pwrEl = this._els.pwrVal;
      const socEl = this._els.socVal;
      const solEl = this._els.solVal;
      // Power shows discharging power only
      if (pwrEl) {
        const dischargeVal = dischgPower > 0 ? dischgPower : (power != null && power < -0.5 ? Math.abs(power) : null);
        if (dischargeVal != null && dischargeVal > 0.5) pwrEl.textContent = Math.round(dischargeVal) + ' W';
        else pwrEl.textContent = '--';
      }
      if (socEl && soc != null) socEl.textContent = Math.round(soc) + '%';
      // Solar shows charging power only
      if (solEl) {
        const chargeVal = chgPower > 0 ? chgPower : (power != null && power > 0.5 ? power : null);
        if (chargeVal != null && chargeVal > 0.5) solEl.textContent = Math.round(chargeVal) + ' W';
        else solEl.textContent = '--';
      }
      return;
    }

    // Historical views: show averages from stored chart data
    if (!this._charts) return;
    const powerData = this._charts.getChartData('chartPower');
    const socData = this._charts.getChartData('chartSOC');
    const solarData = this._charts.getChartData('chartSolar');

    const pwrEl = this._els.pwrVal || (this._els.pwrVal = root.getElementById('pwrVal'));
    const socEl = this._els.socVal || (this._els.socVal = root.getElementById('socVal'));
    const solEl = this._els.solVal || (this._els.solVal = root.getElementById('solVal'));
    if (pwrEl && powerData?.length) {
      const avg = powerData.reduce((s, v) => s + (v || 0), 0) / powerData.length;
      pwrEl.textContent = Math.round(Math.abs(avg)) + ' W';
    }
    if (socEl && socData?.length) {
      const avg = socData.reduce((s, v) => s + (v || 0), 0) / socData.length;
      socEl.textContent = Math.round(avg) + '%';
    }
    if (solEl && solarData?.length) {
      const avg = solarData.reduce((s, v) => s + (v || 0), 0) / solarData.length;
      solEl.textContent = Math.round(avg) + ' W';
    }
  }

  // ============ BATTERY ARCS ============
  _genBolt(x1, y1, x2, y2, detail) {
    const pts = [{ x: x1, y: y1 }];
    const segments = detail || 4 + Math.floor(Math.random() * 3);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      pts.push({
        x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 14,
        y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 10,
      });
    }
    pts.push({ x: x2, y: y2 });
    return 'M' + pts.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' L');
  }

  _genBranch() {
    const cx = 24, cy = 24;
    const angle = Math.random() * Math.PI * 2;
    const r1 = 8 + Math.random() * 10;
    const r2 = r1 + 4 + Math.random() * 8;
    return this._genBolt(
      cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1,
      cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2,
      2 + Math.floor(Math.random() * 2)
    );
  }

  _drawAnimeBolt(svg, d, color, coreWidth, glowWidth) {
    const ns = 'http://www.w3.org/2000/svg';
    const glow = document.createElementNS(ns, 'path');
    glow.setAttribute('d', d);
    glow.setAttribute('fill', 'none');
    glow.setAttribute('stroke', color);
    glow.setAttribute('stroke-width', String(glowWidth));
    glow.setAttribute('stroke-linecap', 'round');
    glow.setAttribute('stroke-linejoin', 'round');
    glow.setAttribute('opacity', '0.5');
    glow.style.filter = 'blur(2px)';
    svg.appendChild(glow);

    const core = document.createElementNS(ns, 'path');
    core.setAttribute('d', d);
    core.setAttribute('fill', 'none');
    core.setAttribute('stroke', '#fff');
    core.setAttribute('stroke-width', String(coreWidth));
    core.setAttribute('stroke-linecap', 'round');
    core.setAttribute('stroke-linejoin', 'round');
    core.setAttribute('opacity', '0.95');
    svg.appendChild(core);

    const len = core.getTotalLength();
    core.style.strokeDasharray = len;
    core.style.strokeDashoffset = len;
    glow.style.strokeDasharray = len;
    glow.style.strokeDashoffset = len;
    core.style.transition = 'stroke-dashoffset 0.08s linear';
    glow.style.transition = 'stroke-dashoffset 0.08s linear';
    requestAnimationFrame(() => { core.style.strokeDashoffset = '0'; glow.style.strokeDashoffset = '0'; });
  }

  _flashAnimeBolts(color) {
    const svg = this.shadowRoot.getElementById('battArcs');
    if (!svg) return;
    svg.innerHTML = '';
    const cx = 24, cy = 24;
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * 8;
      const d = this._genBolt(cx, cy, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      this._drawAnimeBolt(svg, d, color, 1.4, 3.5);
      if (Math.random() > 0.5) {
        this._drawAnimeBolt(svg, this._genBranch(), color, 0.8, 2);
      }
    }
    this._boltTimeouts.push(setTimeout(() => {
      svg.style.opacity = '0.4';
      svg.style.transition = 'opacity 0.12s ease-out';
    }, 80));
    this._boltTimeouts.push(setTimeout(() => {
      svg.innerHTML = '';
      svg.style.opacity = '1';
      svg.style.transition = '';
    }, 200));
  }

  _startBattArcs(color) {
    if (this._battArcActive && this._battArcColor === color) return;
    if (this._battArcActive) this._stopBattArcs();
    this._battArcActive = true;
    this._battArcColor = color;
    const scheduleNext = () => {
      if (!this._battArcActive) return;
      const t = Math.min(this._battArcPowerW, 1500) / 1500;
      const delay = 300 + (1 - t) * 1700 + Math.random() * 500;
      this._battArcInterval = setTimeout(() => {
        if (!this._battArcActive) return;
        this._flashAnimeBolts(this._battArcColor);
        scheduleNext();
      }, delay);
    };
    this._flashAnimeBolts(color);
    scheduleNext();
  }

  _stopBattArcs() {
    if (!this._battArcActive) return;
    this._battArcActive = false;
    clearTimeout(this._battArcInterval);
    this._boltTimeouts.forEach(id => clearTimeout(id));
    this._boltTimeouts = [];
    const svg = this.shadowRoot.getElementById('battArcs');
    if (svg) svg.innerHTML = '';
  }

  // ============ WEATHER UPDATE ============
  _discoverWeatherEntity() {
    if (!this._bridge._hass) return null;
    // NI15: Reuse cached entity if still available — avoids scanning all hass.states every 5 min
    if (this._weatherEntityId && this._bridge._hass.states[this._weatherEntityId]) {
      return this._weatherEntityId;
    }
    const states = this._bridge._hass.states;
    const now = Date.now();
    const STALE_MS = 30 * 60 * 1000; // 30 minutes

    const candidates = Object.entries(states)
      .filter(([id, s]) => id.startsWith('weather.') && !['unavailable', 'unknown'].includes(s.state));
    if (!candidates.length) return null;

    // Identify source and check staleness
    const scored = candidates.map(([id, s]) => {
      const att = (s.attributes?.attribution || '').toLowerCase();
      let source = 'other';
      if (att.includes('google')) source = 'google';
      else if (att.includes('pirate')) source = 'pirateweather';
      else if (att.includes('met.no')) source = 'metno';

      const lastUpdated = new Date(s.last_updated || s.last_changed).getTime();
      const isStale = (now - lastUpdated) > STALE_MS;

      return { id, source, isStale, lastUpdated };
    });

    // Priority order: google > pirateweather > metno > other
    const priority = ['google', 'pirateweather', 'metno'];
    for (const p of priority) {
      const match = scored.find(s => s.source === p && !s.isStale);
      if (match) return match.id;
    }

    // Fallback: any non-stale entity, or stale if nothing fresh
    const fresh = scored.find(s => !s.isStale);
    return fresh ? fresh.id : scored[0].id;
  }

  _discoverMoonPhaseEntity() {
    if (!this._bridge._hass) return null;
    const knownStates = new Set(Object.keys(MOON_PHASE_BRIGHTNESS));
    const match = Object.entries(this._bridge._hass.states)
      .find(([id, s]) => id.startsWith('sensor.') && knownStates.has(s.state));
    return match ? match[0] : null;
  }

  _updateWeather() {
    this._weatherEntityId = this._discoverWeatherEntity();
    if (!this._weatherEntityId) return;

    const state = this._bridge.getState(this._weatherEntityId);
    if (!state) return;
    const attrs = state.attributes || {};
    const root = this.shadowRoot;

    // Cloud coverage
    let cloudPct;
    if (attrs.cloud_coverage != null) {
      cloudPct = parseFloat(attrs.cloud_coverage);
    } else {
      const condition = state.state || '';
      cloudPct = CONDITION_CLOUD_MAP[condition] ?? 50;
    }
    this._weatherCloudFactor = cloudTransmission(cloudPct);

    // Apply weather backdrop
    const windSpeed = parseFloat(attrs.wind_speed) || 0;
    const cloudCoverage = attrs.cloud_coverage ?? null;
    const windBearing = attrs.wind_bearing ?? 180;
    this._applyWeatherBackdrop(state.state, windSpeed, cloudCoverage, windBearing);

    // Temperature for solar engine
    if (attrs.temperature != null) {
      this._weatherAmbientC = parseFloat(attrs.temperature);
    }

    // Update weather source indicator — dynamic, works with any integration
    const sourceEl = this._els.wxSource;
    if (sourceEl) {
      const att = attrs.attribution || '';
      const friendly = attrs.friendly_name || '';
      const src = (
        att.replace(/^(data from|powered by|weather forecast from|forecast from)\s+/i, '')
           .replace(/,.*$/, '')
           .trim()
        || friendly
        || this._weatherEntityId.replace('weather.', '').replace(/_/g, ' ')
      ).slice(0, 30);
      sourceEl.textContent = 'via ' + src;
    }

    // Update weather display
    const condition = state.state || '--';
    const condEl = root.getElementById('wxCondition');
    if (condEl) condEl.textContent = COND_LABELS[condition] || condition.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const tempEl = root.getElementById('wxTemp');
    if (tempEl) {
      if (attrs.temperature != null) {
        this._animateValue(tempEl, parseFloat(tempEl.textContent) || 0, parseFloat(attrs.temperature), 600, v => v.toFixed(1) + '\u00B0C');
      } else tempEl.textContent = '--';
    }

    const cloudEl = root.getElementById('wxCloud');
    if (cloudEl) {
      if (cloudPct != null) {
        this._animateValue(cloudEl, parseFloat(cloudEl.textContent) || 0, cloudPct, 600, v => Math.round(v) + '%');
      } else cloudEl.textContent = '--';
    }

    const humidEl = root.getElementById('wxHumid');
    if (humidEl) {
      if (attrs.humidity != null) {
        this._animateValue(humidEl, parseFloat(humidEl.textContent) || 0, parseFloat(attrs.humidity), 600, v => Math.round(v) + '%');
      } else humidEl.textContent = '--';
    }

    // Update solar estimate on weather change
    this._updateSolarEstimate();
  }

  _applyWeatherBackdrop(condition, windSpeed = 0, cloudCoverage = null, windBearing = 180) {
    const rootEl = this._els.dashRoot;
    if (!rootEl) return;
    if (condition !== undefined) {
      this._lastWeatherCondition = condition;
      this._lastWindSpeed        = windSpeed;
      this._lastCloudCoverage    = cloudCoverage;
      this._lastWindBearing      = windBearing;
    } else {
      condition     = this._lastWeatherCondition;
      windSpeed     = this._lastWindSpeed    ?? 0;
      cloudCoverage = this._lastCloudCoverage ?? null;
      windBearing   = this._lastWindBearing  ?? 180;
    }
    if (!condition) return;
    const theme = rootEl.dataset.theme || 'dark';
    const palettes = WEATHER_PALETTES[theme] || WEATHER_PALETTES.dark;

    let isNight = false;
    let sunElevation = -90, sunAzimuth = 180;
    if (this._engine && this._bridge.latitude != null) {
      const sp = this._engine.getPosition(new Date());
      sunElevation = sp.elevation;
      sunAzimuth   = sp.azimuth;
      isNight = sunElevation < 0;
      this._lastSunNight = isNight;
    }

    let key = CONDITION_PALETTE_MAP[condition] || null;
    if (isNight && key !== 'night') key = (key && key !== 'sunny') ? `night_${key}` : 'night';

    const colors = palettes[key];
    if (!colors) return;

    const newTargets = colors.map(c => this._parseRgba(c));
    if (!this._meshCur[0]) this._meshCur = newTargets.map(t => ({ ...t }));
    this._meshTarget = newTargets;
    // NB2: Restart mesh lerp if it was stopped after previous convergence
    if (!this._meshRafId) this._startMeshLerp();

    // Moon phase brightness (0=new, 1=full) — auto-discovered entity
    if (!this._moonPhaseEntityId) this._moonPhaseEntityId = this._discoverMoonPhaseEntity();
    const moonState = this._moonPhaseEntityId ? this._bridge.getState(this._moonPhaseEntityId) : null;
    const _mb = moonState ? MOON_PHASE_BRIGHTNESS[moonState.state] : undefined;
    if (_mb !== undefined) this._lastMoonBrightness = _mb;
    const moonBrightness = this._lastMoonBrightness;

    // Moon position from Meeus algorithm
    let moonElevation = -90, moonAzimuth = 180;
    if (this._engine && this._bridge.latitude != null) {
      const mp = this._engine.getMoonPosition(new Date());
      moonElevation = mp.elevation;
      moonAzimuth   = mp.azimuth;
    }

    // Update weather FX particles — pass original HA condition, not the palette key,
    // because WeatherFX.start() does its own condition-to-particle mapping
    // B23: Skip if parameters haven't changed (prevents redundant fade loops)
    if (this._weatherFx) {
      const fxKey = `${condition}|${isNight}|${windSpeed.toFixed(0)}|${moonBrightness.toFixed(2)}`;
      if (fxKey !== this._fxKey) {
        this._weatherFx.start(condition, isNight, theme, windSpeed, moonBrightness, moonElevation, moonAzimuth, sunElevation, sunAzimuth, cloudCoverage, windBearing);
        this._fxKey = fxKey;
      }
    }
  }

  // ============ SOLAR UPDATE ============
  _getPanelConfig() {
    return {
      count: this._bridge.panelCount,
      ratedWatts: this._bridge.panelRatedWatts,
      efficiency: this._bridge.panelEfficiency,
      tilt: this._bridge.panelTilt,
      azimuth: this._bridge.panelAzimuth,
      areaEach: this._bridge.panelAreaEach,
      model: this._bridge.panelModel,
      type: this._bridge.panelType,
    };
  }

  _parseRgba(str) {
    const m = str && str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 } : null;
  }

  _startMeshLerp() {
    if (this._meshRafId) return;
    const step = () => {
      if (!this._meshTarget) {
        this._meshRafId = null;
        return;
      }
      const root = this._els.dashRoot;
      if (root && this._meshCur[0]) {
        const L = 0.004;
        let converged = true;
        for (let i = 0; i < 3; i++) {
          const c = this._meshCur[i], t = this._meshTarget[i];
          if (!c || !t) { converged = false; continue; }
          c.r += (t.r - c.r) * L; c.g += (t.g - c.g) * L;
          c.b += (t.b - c.b) * L; c.a += (t.a - c.a) * L;
          if (Math.abs(c.r - t.r) > 0.5 || Math.abs(c.g - t.g) > 0.5 ||
              Math.abs(c.b - t.b) > 0.5 || Math.abs(c.a - t.a) > 0.001) {
            converged = false;
          }
        }
        root.style.setProperty('--mesh-1', `rgba(${Math.round(this._meshCur[0].r)},${Math.round(this._meshCur[0].g)},${Math.round(this._meshCur[0].b)},${this._meshCur[0].a.toFixed(3)})`);
        root.style.setProperty('--mesh-2', `rgba(${Math.round(this._meshCur[1].r)},${Math.round(this._meshCur[1].g)},${Math.round(this._meshCur[1].b)},${this._meshCur[1].a.toFixed(3)})`);
        root.style.setProperty('--mesh-3', `rgba(${Math.round(this._meshCur[2].r)},${Math.round(this._meshCur[2].g)},${Math.round(this._meshCur[2].b)},${this._meshCur[2].a.toFixed(3)})`);
        if (converged) {
          // Snap to exact target and stop the loop — no CPU waste after convergence (NB2)
          for (let i = 0; i < 3; i++) {
            this._meshCur[i] = { ...this._meshTarget[i] };
          }
          this._meshRafId = null;
          return;
        }
      }
      this._meshRafId = requestAnimationFrame(step);
    };
    this._meshRafId = requestAnimationFrame(step);
  }

  _updateSunMoonPosition() {
    if (!this._weatherFx || !this._engine || !this._bridge._hass || this._bridge.latitude == null) return;
    const now = new Date();
    const sp = this._engine.getPosition(now);
    const mp = this._engine.getMoonPosition(now);
    const isNight = sp.elevation < 0;
    if (isNight !== this._lastSunNight) {
      this._lastSunNight = isNight;
      this._applyWeatherBackdrop();
      return;
    }
    const moonState = this._moonPhaseEntityId ? this._bridge._hass.states[this._moonPhaseEntityId] : null;
    const moonBrightness = moonState ? (MOON_PHASE_BRIGHTNESS[moonState.state] ?? 0.5) : 0.5;
    this._weatherFx.updateSunMoon(sp.elevation, sp.azimuth, mp.elevation, mp.azimuth, moonBrightness);
    const planets = this._engine.getPlanetPositions ? this._engine.getPlanetPositions(now) : [];
    const gc = this._engine.getGalacticCenterPos ? this._engine.getGalacticCenterPos(now) : { elevation: -90, azimuth: 180 };
    this._weatherFx.updateNightSky(planets, gc.azimuth, gc.elevation, this._issPos);
  }

  async _fetchISSPosition() {
    if (this._bridge.latitude == null) return;
    try {
      const ctl = new AbortController();
      const tid = setTimeout(() => ctl.abort(), 8000);
      const resp = await fetch('https://api.wheretheiss.at/v1/satellites/25544', { signal: ctl.signal });
      clearTimeout(tid);
      if (!resp.ok) return;
      const data = await resp.json();
      const { latitude: iLat, longitude: iLon, altitude: iAlt, visibility } = data;
      // Only show when ISS is in sunlight and observer is in darkness
      if (visibility !== 'visible') { this._issPos = null; return; }
      // ECEF → ENU elevation/azimuth
      const toR = d => d * Math.PI / 180;
      const toD = r => r * 180 / Math.PI;
      const R = 6371;
      const latO = toR(this._bridge.latitude);
      const lonO = toR(this._bridge.longitude);
      const latI = toR(iLat);
      const lonI = toR(iLon);
      const rI = R + iAlt;
      const xO = R * Math.cos(latO) * Math.cos(lonO);
      const yO = R * Math.cos(latO) * Math.sin(lonO);
      const zO = R * Math.sin(latO);
      const xI = rI * Math.cos(latI) * Math.cos(lonI);
      const yI = rI * Math.cos(latI) * Math.sin(lonI);
      const zI = rI * Math.sin(latI);
      const dx = xI - xO, dy = yI - yO, dz = zI - zO;
      const E = -Math.sin(lonO) * dx + Math.cos(lonO) * dy;
      const N = -Math.sin(latO)*Math.cos(lonO)*dx - Math.sin(latO)*Math.sin(lonO)*dy + Math.cos(latO)*dz;
      const U = Math.cos(latO)*Math.cos(lonO)*dx + Math.cos(latO)*Math.sin(lonO)*dy + Math.sin(latO)*dz;
      const elev = toD(Math.atan2(U, Math.sqrt(E*E + N*N)));
      const az   = (toD(Math.atan2(E, N)) + 360) % 360;
      this._issPos = elev > 5 ? { elevation: elev, azimuth: az } : null;
    } catch (_) {
      this._issPos = null;
    }
  }

  _updateSolarEstimate() {
    if (!this._solarEngineReady || !this._engine) return;
    const root = this.shadowRoot;
    const now = new Date();
    const sunPos = this._engine.getPosition(now);
    const isDay = sunPos.elevation > 0;

    // Night: skip expensive solar math, animate to 0
    if (!isDay) {
      this._wasDay = false;
      this._cachedForecastKWh = 0;
      this._lastForecastHour = -1;
      const solOutput = root.getElementById('solOutput');
      if (solOutput) {
        this._animateValue(solOutput, parseFloat(solOutput.textContent) || 0, 0, 600, v => Math.round(v) + ' W');
      }
      const solForecast = root.getElementById('solForecast');
      if (solForecast) {
        this._animateValue(solForecast, parseFloat(solForecast.textContent) || 0, 0, 600, v => v.toFixed(1) + ' kWh');
      }
      return;
    }

    // Day: full solar math pipeline
    if (!this._wasDay) this._lastForecastHour = -1; // reset on sunrise
    this._wasDay = true;
    const panelConfig = this._getPanelConfig();
    this._engine.getDegradationInfo(now, panelConfig);
    const result = this._engine.calcSolarOutput(now, panelConfig, (1 - this._weatherCloudFactor) * 100, this._weatherAmbientC);

    const solOutput = root.getElementById('solOutput');
    if (solOutput) {
      this._animateValue(solOutput, parseFloat(solOutput.textContent) || 0, result.watts, 600, v => Math.round(v) + ' W');
    }

    const currentHour = now.getHours();
    if (currentHour !== this._lastForecastHour) {
      this._lastForecastHour = currentHour;
      this._cachedForecastKWh = this._engine.calcDailyForecast(now, panelConfig, (1 - this._weatherCloudFactor) * 100, this._weatherAmbientC);
    }
    const solForecast = root.getElementById('solForecast');
    if (solForecast) {
      this._animateValue(solForecast, parseFloat(solForecast.textContent) || 0, this._cachedForecastKWh, 600, v => v.toFixed(1) + ' kWh');
    }
  }

  _updateSolarUI() {
    if (!this._engine) return;
    const root = this.shadowRoot;
    const now = new Date();
    const panelConfig = this._getPanelConfig();
    const s = this._engine.getDegradationInfo(now, panelConfig);

    const healthEl = root.getElementById('solHealthPct');
    if (healthEl) this._animateValue(healthEl, parseFloat(healthEl.textContent) || 0, s.healthPct, 600, v => v.toFixed(1) + '%');

    const fillEl = root.getElementById('solDegFill');
    if (fillEl) fillEl.style.width = s.healthPct + '%';

    const degEl = root.getElementById('solDegPct');
    if (degEl) this._animateValue(degEl, parseFloat(degEl.textContent.replace('\u2212', '')) || 0, s.degradationPct, 600, v => '\u2212' + v.toFixed(1) + '%');

    root.getElementById('solInstalled').textContent = s.installStr;
    root.getElementById('solAge').textContent = s.ageStr;
    root.getElementById('solModel').textContent = s.model;
    root.getElementById('solType').textContent = s.type;
    root.getElementById('solRated').textContent = s.totalRatedW + ' W';
    root.getElementById('solYr1').textContent = '\u2212' + (s.yr1Loss * 100).toFixed(0) + '% LID';
    root.getElementById('solYrN').textContent = '\u2212' + (s.annualLoss * 100).toFixed(1) + '%/yr';

    const nextYrEl = root.getElementById('solNextYr');
    if (nextYrEl) this._animateValue(nextYrEl, parseFloat(nextYrEl.textContent) || 0, s.nextYrW, 600, v => Math.round(v) + ' W');
  }

  // ============ CELL BALANCE ============
  _updateCellBalance() {
    const root = this.shadowRoot;
    const E = this._bridge.E;
    const lang = this._bridge._hass?.language || 'en';
    const voltages = [];
    for (let i = 1; i <= 16; i++) {
      const v = this._bridge.getVal(E['CELL' + i]);
      voltages.push((v != null && v > 0) ? v : null);
    }
    const validVoltages = voltages.filter(v => v != null);
    if (validVoltages.length === 0) return;

    // P15: Skip if voltages haven't changed (cell voltages drift slowly, most updates are identical)
    const key = voltages.join(',');
    if (key === this._lastCellVoltagesKey) return;
    this._lastCellVoltagesKey = key;

    const globalMaxI = voltages.indexOf(Math.max(...validVoltages));
    const globalMinI = voltages.indexOf(Math.min(...validVoltages));
    const pack1 = voltages.slice(0, 8).filter(v => v != null);
    const pack2 = voltages.slice(8).filter(v => v != null);
    if (pack1.length > 0) this._renderPack('pack1', pack1, 1, globalMaxI, globalMinI);
    if (pack2.length > 0) this._renderPack('pack2', pack2, 9, globalMaxI, globalMinI);
    this._applyBal(voltages);
  }

  _renderPack(containerId, voltages, startIdx, globalMaxI, globalMinI) {
    const el = this.shadowRoot.getElementById(containerId);
    if (!el) return;
    const allV = typeof voltages === 'object' ? Object.values(voltages) : voltages;
    const existing = el.querySelectorAll('.cell-row-item');
    if (existing.length !== allV.length) {
      el.innerHTML = '';
      allV.forEach(() => {
        const row = document.createElement('div');
        row.className = 'cell-row-item';
        row.innerHTML = '<span class="cell-id"></span><div class="cell-bar-bg"><div class="cell-bar"></div></div><span class="cell-val"></span>';
        el.appendChild(row);
      });
    }
    const rows = el.querySelectorAll('.cell-row-item');
    const { vmin, vmax } = cellBounds(this._bridge.battSpec.chemistry);
    allV.forEach((v, gi) => {
      const globalI = startIdx - 1 + gi;
      const pct = Math.max(2, Math.min(100, ((v - vmin) / (vmax - vmin || 0.001)) * 100));
      const row = rows[gi];
      const isHigh = globalI === globalMaxI;
      const isLow = globalI === globalMinI;
      const wantClass = isHigh ? 'cell-row-item cell-high' : isLow ? 'cell-row-item cell-low' : 'cell-row-item';
      if (row.className !== wantClass) row.className = wantClass;
      const tag = isHigh ? '<span class="cell-tag high">\u25B2</span>' : isLow ? '<span class="cell-tag low">\u25BC</span>' : '';
      const idEl = row.querySelector('.cell-id');
      const newId = `C${startIdx + gi}${tag}`;
      // NB3: Compare textContent (reliable) instead of innerHTML (fragile due to browser normalization)
      const newText = `C${startIdx + gi}`;
      const newState = isHigh ? 'high' : isLow ? 'low' : 'normal';
      if (idEl.textContent !== newText || row.dataset.cellState !== newState) {
        idEl.innerHTML = newId;
        row.dataset.cellState = newState;
      }
      row.querySelector('.cell-bar').style.width = pct + '%';
      const cellValEl = row.querySelector('.cell-val');
      this._animateValue(cellValEl, parseFloat(cellValEl.textContent) || 0, v, 600, val => val.toFixed(3) + ' V');
    });
  }

  _applyBal(voltages) {
    const root = this.shadowRoot;
    const lang = this._bridge._hass?.language || 'en';
    const allV = [...voltages];
    const maxI = allV.indexOf(Math.max(...allV));
    const minI = allV.indexOf(Math.min(...allV));
    const delta = (Math.max(...allV) - Math.min(...allV)) * 1000;
    const balancing = this._bridge.getStrVal(this._bridge.E.BALANCING) === 'on';

    // Remove old balancing classes
    root.querySelectorAll('.cell-high-balancing, .cell-low-balancing').forEach(el => {
      el.classList.remove('cell-high-balancing', 'cell-low-balancing');
    });

    if (balancing) {
      // Find the cell bar elements for source and destination
      const pack1Rows = root.querySelectorAll('#pack1 .cell-row-item');
      const pack2Rows = root.querySelectorAll('#pack2 .cell-row-item');
      const allRows = [...pack1Rows, ...pack2Rows];
      const srcCell = allRows[maxI];
      const dstCell = allRows[minI];

      if (srcCell && dstCell) {
        srcCell.classList.add('cell-high-balancing');
        dstCell.classList.add('cell-low-balancing');
      }

      // Show balancing indicator
      root.getElementById('balSrc').textContent = 'C' + (maxI + 1);
      root.getElementById('balDst').textContent = 'C' + (minI + 1);
      root.getElementById('balIndicator').style.display = 'block';
    } else {
      root.getElementById('balIndicator').style.display = 'none';
    }

    const balStatusEl = root.getElementById('balStatus');
    const oldDelta = parseFloat(balStatusEl.textContent.replace(/[^0-9.]/g, '')) || 0;
    const suffix = balancing ? t(lang, 'mVBalancing') : t(lang, 'mV');
    this._animateValue(balStatusEl, oldDelta, delta, 600, v => `\u0394 ${Math.round(v)}${suffix}`);
  }

  // ============ CALC TODAY IN/OUT ============
  async _calcTodayInOut() {
    const root = this.shadowRoot;
    const E = this._bridge.E;
    const tz = this._bridge.timezone;
    try {
      const now = new Date();
      const todayStr = new Intl.DateTimeFormat('sv', { timeZone: tz }).format(now);
      // DST-safe midnight: use a noon UTC seed so we're on the right calendar day,
      // then step back by however many local h:m have elapsed to reach 00:00 local.
      const svFmt   = new Intl.DateTimeFormat('sv', { timeZone: tz });
      const timeFmt = new Intl.DateTimeFormat('sv', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
      let candidate = new Date(`${todayStr}T12:00:00Z`);
      // Ensure candidate is on the correct local date (handles edge-case offsets > ±12h)
      if (svFmt.format(candidate) < todayStr) candidate = new Date(candidate.getTime() + 86400000);
      if (svFmt.format(candidate) > todayStr) candidate = new Date(candidate.getTime() - 86400000);
      const [lh, lm] = timeFmt.format(candidate).split(':').map(Number);
      let midnightUTC = new Date(candidate.getTime() - (lh * 3600 + lm * 60) * 1000);
      // DST correction: noon offset may differ from midnight offset (spring-forward); verify and nudge
      const [vh, vm] = timeFmt.format(midnightUTC).split(':').map(Number);
      if (vh !== 0 || vm !== 0) midnightUTC = new Date(midnightUTC.getTime() - (vh * 3600 + vm * 60) * 1000);

      // Helper: integrate Watts history → kWh (rectangular rule, gap cap 1h)
      const integrateWatts = (states) => {
        let kWh = 0;
        for (let i = 1; i < states.length; i++) {
          const prevV = states[i - 1].v;
          if (prevV === null || prevV < 0) continue;
          const dtHours = (states[i].t.getTime() - states[i - 1].t.getTime()) / 3600000;
          if (dtHours > 0 && dtHours < 1) kWh += prevV * dtHours / 1000;
        }
        if (states.length > 0) {
          const last = states[states.length - 1];
          if (last.v !== null && last.v >= 0) {
            const dtHours = (now.getTime() - last.t.getTime()) / 3600000;
            if (dtHours > 0 && dtHours < 1) kWh += last.v * dtHours / 1000;
          }
        }
        return kWh;
      };

      if (E.CHG_POWER && E.DISCHG_POWER) {
        // Preferred: dedicated power sensors — clean, no sign ambiguity
        const [chgStates, dischgStates] = await Promise.all([
          this._bridge.fetchHistoryRange(E.CHG_POWER,    midnightUTC, now, true),
          this._bridge.fetchHistoryRange(E.DISCHG_POWER, midnightUTC, now, true),
        ]);
        this._todayIn  = chgStates ? integrateWatts(chgStates) : 0;
        this._todayOut = dischgStates ? integrateWatts(dischgStates) : 0;
      } else {
        // Fallback: signed current sensor (Ah → kWh)
        const nomV = this._bridge.battSpec.nomV;
        const states = await this._bridge.fetchHistoryRange(E.CURRENT, midnightUTC, now, true);
        let inAh = 0, outAh = 0;
        if (states) {
          for (let i = 1; i < states.length; i++) {
            const prevV = states[i - 1].v;
            if (prevV === null) continue;
            const dtHours = (states[i].t.getTime() - states[i - 1].t.getTime()) / 3600000;
            if (dtHours > 0 && dtHours < 1) {
              if (prevV > 0.1) inAh += prevV * dtHours;
              else if (prevV < -0.1) outAh += Math.abs(prevV) * dtHours;
            }
          }
          if (states.length > 0) {
            const last = states[states.length - 1];
            if (last.v !== null) {
              const dtHours = (now.getTime() - last.t.getTime()) / 3600000;
              if (dtHours > 0 && dtHours < 1) {
                if (last.v > 0.1) inAh += last.v * dtHours;
                else if (last.v < -0.1) outAh += Math.abs(last.v) * dtHours;
              }
            }
          }
        }
        this._todayIn  = inAh * nomV / 1000;
        this._todayOut = outAh * nomV / 1000;
      }
    } catch (e) { console.warn('[Solar] Today In/Out fetch failed', e); }

    // _todayIn / _todayOut are kWh
    const inEl = root.getElementById('battTodayIn');
    this._animateValue(inEl, parseFloat(inEl.textContent) || 0, this._todayIn, 600, v => v.toFixed(2) + ' kWh');
    const outEl = root.getElementById('battTodayOut');
    this._animateValue(outEl, parseFloat(outEl.textContent) || 0, this._todayOut, 600, v => v.toFixed(2) + ' kWh');

    // Solar generation today = charging energy (all charging assumed solar)
    const solTodayEl = root.getElementById('solTodayGen');
    if (solTodayEl) {
      this._animateValue(solTodayEl, parseFloat(solTodayEl.textContent) || 0, this._todayIn, 600, v => v.toFixed(1) + ' kWh');
    }
  }

  // ============ CLOCK ============
  _startClock() {
    const el = this.shadowRoot.getElementById('clock');
    if (el) {
      if (!this._clockFormatter) {
        this._clockFormatter = new Intl.DateTimeFormat('en-IN', {
          timeZone: this._bridge.timezone,
          weekday: 'short', day: 'numeric', month: 'short',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
        });
      }
      el.textContent = this._clockFormatter.format(new Date());
    }
  }

  // ============ CHARTS ============
  async _loadChartRange(range) {
    this._activeChartRange = range;
    if (!this._charts) return;
    // P22: Debounce to prevent API spam from rapid tab clicks / visibility resume
    const now = Date.now();
    if (this._chartFetchDebounce[range] && now - this._chartFetchDebounce[range] < 2000) return;
    this._chartFetchDebounce[range] = now;
    const root = this.shadowRoot;
    const E = this._bridge.E;
    const lang = this._bridge._hass?.language || 'en';
    // Guard: wait for entity discovery to complete
    if (!E || !E.POWER || !E.SOC) {
      return;
    }
    const canvases = {
      power: root.getElementById('chartPower'),
      soc: root.getElementById('chartSOC'),
      solar: root.getElementById('chartSolar'),
    };
    const batteryPowerEntity = E.DISCHG_POWER || E.POWER;
    const solarPowerEntity = E.CHG_POWER || E.POWER;
    const samePowerEntity = batteryPowerEntity === solarPowerEntity;

    let result, solarResult;
    try {
      if (samePowerEntity) {
        // NI3: Both charts use the same entity — fetch once, loadRange splits signed data
        // (battery chart takes negative=discharge, solar chart takes positive=charge)
        result = await this._charts.loadRange(range, canvases, {
          power: batteryPowerEntity,
          soc: E.SOC,
          _signed: !E.DISCHG_POWER,
        }, this._bridge.timezone);
        solarResult = { powerData: result.powerData, timeXLabel: result.timeXLabel };
      } else {
        [result, solarResult] = await Promise.all([
          this._charts.loadRange(range, canvases, {
            power: batteryPowerEntity,
            soc: E.SOC,
            _signed: !E.DISCHG_POWER,
          }, this._bridge.timezone),
          this._charts.loadRange(range, { solar: canvases.solar }, {
            power: solarPowerEntity,
            _signed: !E.CHG_POWER,
          }, this._bridge.timezone),
        ]);
      }
    } catch (e) {
      console.warn('[Solar] Chart data load failed:', e);
      return;
    }

    // Overlay estimated solar line on solar chart
    // For Live: use current weather conditions for fair comparison
    // For historical (1D/7D/30D): use clear-sky (no weather) since past weather is unknown
    if (canvases.solar && solarResult.powerData?.length && this._engine && this._solarEngineReady) {
      const panelConfig = this._getPanelConfig();
      const actualPts = solarResult.powerData.map(d => (d.v !== null) ? Math.max(d.v, 0) : 0);
      const isLive = range === 'Live';
      const is30D = range === '30D';
      const cloudPct = isLive ? (1 - this._weatherCloudFactor) * 100 : 0;
      const ambientC = isLive ? this._weatherAmbientC : null;
      let overlayPts, overlayLabel;
      if (is30D) {
        // 30D: show 7-day rolling average of actual as trend line (filter nighttime zeros)
        overlayPts = actualPts.map((_, i) => {
          const window = actualPts.slice(Math.max(0, i - 6), i + 1).filter(v => v > 0);
          return window.length > 0 ? window.reduce((a, b) => a + b, 0) / window.length : 0;
        });
        overlayLabel = t(lang, 'sevenDAvg');
      } else {
        overlayPts = solarResult.powerData.map(d => {
          const out = this._engine.calcSolarOutput(d.t, panelConfig, cloudPct, ambientC);
          return out.watts;
        });
        overlayLabel = t(lang, 'west');
      }
      this._charts.drawChart(canvases.solar, [
        { points: actualPts, color: 'rgb(34,197,94)', label: 'W', fill: true },
        { points: overlayPts, color: 'rgb(249,115,22)', label: overlayLabel, fill: false },
      ], { minY: 0, xLabel: solarResult.timeXLabel(solarResult.powerData), yFormat: v => Math.round(v) + ' W' }, false);
      this._charts.attachCrosshair(canvases.solar);
      const overlayLabelEl = root.getElementById('solarOverlayLabel');
      if (overlayLabelEl) overlayLabelEl.textContent = '\u25A0 ' + (is30D ? t(lang, 'sevenDAvg') : t(lang, 'estimated'));
    }

    // Update chart value displays with last data point
    const lastPwr = result.powerData?.[result.powerData.length - 1];
    const lastSoc = result.socData?.[result.socData.length - 1];
    const lastSol = solarResult.powerData?.[solarResult.powerData.length - 1];
    const pwrEl = root.getElementById('pwrVal');
    const socEl = root.getElementById('socVal');
    const solEl = root.getElementById('solVal');
    if (pwrEl && lastPwr?.v != null) pwrEl.textContent = Math.round(Math.abs(lastPwr.v)) + ' W';
    if (socEl && lastSoc?.v != null) socEl.textContent = Math.round(lastSoc.v) + '%';
    if (solEl && lastSol?.v != null) solEl.textContent = Math.round(Math.max(0, lastSol.v)) + ' W';

    // Pulse chart values
    ['pwrVal', 'socVal', 'solVal'].forEach(id => {
      const el = root.getElementById(id);
      if (el) { el.classList.remove('chart-value-pulse'); void el.offsetWidth; el.classList.add('chart-value-pulse'); }
    });
  }

  // ============ CYCLE RATE ============
  async _updateCycleRate() {
    const E = this._bridge.E;
    if (!E?.CYCLES) return;
    try {
      const data = await this._bridge.fetchStatsRange(E.CYCLES, 7);
      if (data?.length >= 2) {
        const delta = data[data.length - 1].v - data[0].v;
        this._cycleRatePerDay = (Math.max(0, delta) / 7).toFixed(2);
      }
    } catch (e) {
      // non-critical, leave null
    }
  }

  // ============ REFRESH ALL ============
  _refreshAllUI() {
    const E = this._bridge.E;
    const lang = this._bridge._hass?.language || 'en';
    const snap = {
      soc:        this._bridge.getVal(E.SOC),
      voltage:    this._bridge.getVal(E.VOLTAGE),
      current:    this._bridge.getVal(E.CURRENT),
      power:      this._bridge.getVal(E.POWER),
      remaining:  this._bridge.getVal(E.REMAINING),
      chgPower:   this._bridge.getVal(E.CHG_POWER),
      dischgPower:this._bridge.getVal(E.DISCHG_POWER),
      cycles:     this._bridge.getVal(E.CYCLES),
      throughput: this._bridge.getVal(E.THROUGHPUT),
      minCellV:   this._bridge.getVal(E.MIN_CELL_V),
      maxCellV:   this._bridge.getVal(E.MAX_CELL_V),
      mosfetTemp: this._bridge.getVal(E.MOSFET_TEMP),
      strings:    this._bridge.getVal(E.STRINGS),
    };
    this._updateBattery(snap);
    this._updatePowerFlow(snap);
    this._calcTodayInOut().catch(() => {});
    this._updateCellBalance();
    this._updateWeather();
    this._updateSolarEstimate();
    this._updateSolarUI();

    // Dispatch all system entities
    const systemEntities = [E.TEMP1, E.TEMP2, E.MOSFET_TEMP, E.CYCLES, E.RUNTIME, E.THROUGHPUT,
      E.MIN_CELL_V, E.MAX_CELL_V, E.FIRMWARE, E.MANUFACTURER, E.BAL_SWITCH, E.CHG_SWITCH, E.DISCHG_SWITCH,
      E.STRINGS, E.REMAINING];
    this._updateUI(systemEntities.filter(id => this._bridge.getState(id)));
  }

  // ============ CARD REVEAL ============
  _revealCards() {
    if (this._revealFallbackTimeout) { clearTimeout(this._revealFallbackTimeout); this._revealFallbackTimeout = null; }
    if (this._cardsRevealed) return;
    this._cardsRevealed = true;
    const cards = this.shadowRoot.querySelectorAll('.card');
    cards.forEach((card, i) => {
      setTimeout(() => card.classList.add('revealed'), i * 60);
    });
  }

  setConfig(config) {
    this._config = config || {};
  }

  static getStubConfig() {
    return {};
  }
}

customElements.define('solar-dashboard', SolarDashboard);
