import { useState, useEffect } from 'react'
import { Monitor, AlertTriangle, CheckCircle, Clock, ChevronRight, X, Activity, Thermometer, Zap, Cpu, ArrowUpDown, MapPin, Wrench, Send, ClipboardCheck, History, XOctagon, Wifi, HardDrive, BrainCircuit, ShieldAlert, ShieldCheck, Filter, RefreshCw, Siren } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'

import clinicData from './clinics_mapping.json'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ==========================================
// i18n — słownik tłumaczeń (PL kanoniczny / EN). Rozbudowywany etapami.
// ==========================================
const TRANSLATIONS = {
  pl: {
    fleet_overview: "Przegląd Floty",
    fleet_overview_sub: "Podgląd wszystkich aparatów USG w czasie rzeczywistym",
    conn_all: "Wszystkie połączenia",
    conn_gsm: "Tylko GSM",
    conn_usb: "Tylko USB",
    last_updated: "Ostatnia aktualizacja",
    sim_next_day: "Symuluj kolejną dobę (+1)",
    sim_plus10: "+10 dób",
    health_score: "Kondycja floty",
    total_devices: "Wszystkie urządzenia",
    healthy: "Sprawne",
    needs_attention: "Wymaga uwagi",
    critical: "Krytyczne",
    offline: "Offline",
    of_total: "z całości",
    devices_by_status: "Urządzenia wg statusu",
    ai_diag_summary: "Podsumowanie diagnozy AI",
    ai_confidence: "Pewność AI",
    top_issues: "Najczęstsze problemy",
    no_issues: "Brak wykrytych problemów.",
    ai_sum_critical: "Liczba urządzeń wymagających natychmiastowej interwencji: {n}.",
    ai_sum_prefail: "Liczba urządzeń zbliżających się do progu awaryjności: {n} — zalecany przegląd.",
    ai_sum_normal: "Wydajność systemu w granicach normy.",
    average_rul: "Średni RUL",
    offline_stale: "Offline / Brak Sync",
    stale_suffix: "brak sync",
    last_sync_avg: "Ostatnia sync (śr.)",
    firmware_uptodate: "Firmware aktualny",
    no_data: "brak danych",
    realtime: "na żywo",
    global_fleet_status: "Globalny status floty",
    live_ai: "Analiza AI na żywo",
    location: "Lokalizacja",
    connection: "Połączenie",
    signal_strong: "Sygnał: Silny",
    system_info: "Informacje systemowe",
    installed: "Zainstalowano",
    rul_label: "Szacowany pozostały czas pracy (RUL)",
    hrs: "godz.",
    risk_level: "Poziom ryzyka",
    ticket_creator: "Kreator Zlecenia",
    recommended_sku: "Zalecane SKU (Magazyn)",
    verify_email: "Weryfikacja Email (Klinika)",
    assign_technician: "Przypisz Serwisanta",
    select_technician: "Wybierz serwisanta...",
    notes_label: "Notatki dla serwisu / kuriera (Edytowalne)",
    cancel: "Anuluj",
    submit_ticket: "Utwórz zlecenie",
    path_a_banner: "ŚCIEŻKA A — wysyłka głowicy Plug&Play (kurier do placówki)",
    path_b_banner: "ŚCIEŻKA B — BLOKADA wysyłki kurierskiej. Część dostarcza serwisant terenowy.",
    action_required: "WYMAGANE DZIAŁANIE",
    initiate: "Uruchom:",
    reject_hitl: "Odrzuć (HitL)",
    service_completed: "Zlecenie serwisowe zrealizowane",
    service_completed_sub: "Telemetria urządzenia zostanie zresetowana przy najbliższej synchronizacji.",
    alert_ignored: "Alert AI odrzucony",
    alert_ignored_sub: "Analityk odrzucił anomalię. Oczekiwanie na synchronizację w celu wyczyszczenia stanu alertu.",
    ai_summary: "Podsumowanie analizy AI",
    ai_summary_sub: "Na podstawie telemetrii urządzenie zachowuje się stabilnie we wszystkich podsystemach. Nie wykryto anomalii.",
    telemetry_7d: "Telemetria (7 dni)",
    activity_timeline: "Oś czasu zdarzeń",
    no_service_history: "Brak historii serwisowej.",
    serviceman: "Serwisant",
    col_device_id: "ID urządzenia",
    col_model: "Model",
    col_connection: "Połączenie",
    col_last_sync: "Ostatnia sync",
    col_est_rul: "Szac. RUL",
    col_ai_status: "Status AI",
    col_diagnosis: "Diagnoza",
    col_action: "Akcja",
    view_details: "Szczegóły",
    reject_title: "Odrzucenie alertu",
    reject_desc: "Podaj powód odrzucenia diagnozy AI jako False Positive. Trafi do logów do retreningu modelu.",
    reject_reason_label: "Powód odrzucenia",
    reject_placeholder: "np. Skok wartości był efektem czyszczenia głowicy przez personel, nie awarią.",
    confirm_reject: "Potwierdź odrzucenie",
    last_7_days: "Ostatnie 7 Dni",
    raw_telemetry: "Surowe dane telemetryczne",
    time: "Czas",
    merge_charts: "Scal w jeden",
    split_charts: "Rozdziel wykresy",
    logs_for: "Logi —",
    loading_system: "Ładowanie systemu...",
    st_in_progress: "W TOKU",
    st_handled: "OBSŁUŻONE",
    st_rejected: "ODRZUCONE",
    st_no_sync: "BRAK SYNC",
    'diag.ERR-SYS-99': "CPU {v}% przy RUL 0 — awaria płyty głównej. Wykluczyć zasilacz.",
    'diag.ERR-PWR-01': "Napięcie {v} V poza zakresem 216–226 V — usterka zasilacza (AC/DC). Wykluczyć sieć placówki.",
    'diag.ERR-CPU-01': "Obciążenie CPU {v}% (≥90%) — usterka jednostki logicznej. Wykluczyć firmware.",
    'diag.ERR-TEMP-01': "Temp pracy {v}°C ponad kopertą — ryzyko degradacji przetwornika (głowica).",
    'diag.ERR-SNR-01': "SNR {v} dB poniżej progu 42 dB — degradacja przetwornika (głowica).",
    'diag.ERR-GEN-00': "RUL skrócony bez dominującej sygnatury kanałowej — zużycie eksploatacyjne.",
    'diag.ERR-NET-STALE': "Brak dzisiejszej paczki danych — przyjęto ostatni znany odczyt (tryb spoczynku).",
    'diag.ERR-NET-NEVER': "Urządzenie nigdy nie nawiązało połączenia.",
    'diag.NORMAL': "Parametry w normie.",
    'reco.ERR-SYS-99': "Wymiana jednostki bazowej (Hot-Swap). Wysyłka kurierska zablokowana.",
    'reco.ERR-PWR-01': "Interwencja serwisanta terenowego. Wysyłka części zablokowana.",
    'reco.ERR-CPU-01': "Interwencja serwisanta terenowego. Wysyłka części zablokowana.",
    'reco.ERR-TEMP-01': "Wymiana głowicy (Plug&Play). Kurier do placówki.",
    'reco.ERR-SNR-01': "Wymiana głowicy (Plug&Play). Kurier do placówki.",
    'reco.ERR-GEN-00': "Przegląd serwisowy. Bez wysyłki części.",
    'reco.ERR-NET-STALE': "Weryfikacja łącza przy kolejnej synchronizacji. Bez akcji serwisowej.",
    'reco.ERR-NET-NEVER': "Weryfikacja instalacji i łącza urządzenia.",
    'reco.NORMAL': "Brak wymaganych akcji.",
  },
  en: {
    fleet_overview: "Fleet Overview",
    fleet_overview_sub: "Real-time summary of all ultrasound devices",
    conn_all: "All Connections",
    conn_gsm: "GSM only",
    conn_usb: "USB only",
    last_updated: "Last updated",
    sim_next_day: "Simulate next day (+1)",
    sim_plus10: "+10 days",
    health_score: "Health Score",
    total_devices: "Total Devices",
    healthy: "Healthy",
    needs_attention: "Needs Attention",
    critical: "Critical",
    offline: "Offline",
    of_total: "of total",
    devices_by_status: "Devices by Status",
    ai_diag_summary: "AI Diagnosis Summary",
    ai_confidence: "AI Confidence",
    top_issues: "Top Issues Detected",
    no_issues: "No issues detected.",
    ai_sum_critical: "Devices requiring immediate service intervention: {n}.",
    ai_sum_prefail: "Devices approaching failure threshold: {n} — inspection recommended.",
    ai_sum_normal: "System performance is within normal operating parameters.",
    average_rul: "Average RUL",
    offline_stale: "Offline / No Sync",
    stale_suffix: "no sync",
    last_sync_avg: "Last Sync (Avg.)",
    firmware_uptodate: "Firmware Up to Date",
    no_data: "no data",
    realtime: "Real-time",
    global_fleet_status: "Global Fleet Status",
    live_ai: "Live AI Analysis",
    location: "Location",
    connection: "Connection",
    signal_strong: "Signal: Strong",
    system_info: "System Info",
    installed: "Installed",
    rul_label: "Estimated Remaining Useful Life (RUL)",
    hrs: "hrs",
    risk_level: "Risk Level",
    ticket_creator: "Ticket Creator",
    recommended_sku: "Recommended SKU (Warehouse)",
    verify_email: "Verify Email (Clinic)",
    assign_technician: "Assign Technician",
    select_technician: "Select technician...",
    notes_label: "Notes for service / courier (Editable)",
    cancel: "Cancel",
    submit_ticket: "Submit Ticket",
    path_a_banner: "PATH A — Plug&Play probe shipment (courier to site)",
    path_b_banner: "PATH B — Courier shipment BLOCKED. Part delivered by field technician.",
    action_required: "ACTION REQUIRED",
    initiate: "Initiate:",
    reject_hitl: "Reject (HitL)",
    service_completed: "Service Action Completed",
    service_completed_sub: "Device telemetry will be reset during the next nightly sync.",
    alert_ignored: "AI Alert Ignored",
    alert_ignored_sub: "Analyst rejected the anomaly. Waiting for sync to clear alert state.",
    ai_summary: "AI Summary Analysis",
    ai_summary_sub: "Based on telemetry, the device shows stable behavior across sub-systems. No anomalies detected.",
    telemetry_7d: "Telemetry (7 days)",
    activity_timeline: "Activity Timeline",
    no_service_history: "No service history available.",
    serviceman: "Technician",
    col_device_id: "Device ID",
    col_model: "Model",
    col_connection: "Connection",
    col_last_sync: "Last Sync",
    col_est_rul: "Est. RUL",
    col_ai_status: "AI Status",
    col_diagnosis: "Diagnosis",
    col_action: "Action",
    view_details: "View Details",
    reject_title: "Reject alert",
    reject_desc: "Provide a reason for rejecting the AI diagnosis as False Positive. It will be saved to logs for model retraining.",
    reject_reason_label: "Rejection reason",
    reject_placeholder: "e.g. The spike was caused by staff cleaning the probe, not a fault.",
    confirm_reject: "Confirm rejection",
    last_7_days: "Last 7 Days",
    raw_telemetry: "Raw Telemetry Data",
    time: "Time",
    merge_charts: "Merge into one",
    split_charts: "Split charts",
    logs_for: "Logs —",
    loading_system: "Loading system...",
    st_in_progress: "IN PROGRESS",
    st_handled: "HANDLED",
    st_rejected: "REJECTED",
    st_no_sync: "NO SYNC",
    'diag.ERR-SYS-99': "CPU {v}% at RUL 0 — mainboard failure. Rule out PSU.",
    'diag.ERR-PWR-01': "Voltage {v} V outside 216–226 V range — PSU (AC/DC) fault. Rule out site mains.",
    'diag.ERR-CPU-01': "CPU load {v}% (≥90%) — logic unit fault. Rule out firmware.",
    'diag.ERR-TEMP-01': "Operating temp {v}°C above envelope — transducer (probe) degradation risk.",
    'diag.ERR-SNR-01': "SNR {v} dB below 42 dB threshold — transducer (probe) degradation.",
    'diag.ERR-GEN-00': "Shortened RUL with no dominant channel signature — operational wear.",
    'diag.ERR-NET-STALE': "No data packet today — last known reading used (rest state).",
    'diag.ERR-NET-NEVER': "Device has never established a connection.",
    'diag.NORMAL': "Parameters within normal range.",
    'reco.ERR-SYS-99': "Base unit replacement (Hot-Swap). Courier shipment blocked.",
    'reco.ERR-PWR-01': "Field technician intervention. Part shipment blocked.",
    'reco.ERR-CPU-01': "Field technician intervention. Part shipment blocked.",
    'reco.ERR-TEMP-01': "Probe replacement (Plug&Play). Courier to site.",
    'reco.ERR-SNR-01': "Probe replacement (Plug&Play). Courier to site.",
    'reco.ERR-GEN-00': "Service inspection. No part shipment.",
    'reco.ERR-NET-STALE': "Verify link at next sync. No service action.",
    'reco.ERR-NET-NEVER': "Verify device installation and link.",
    'reco.NORMAL': "No action required.",
  }
};

// Kompaktowy Tooltip dla małych wykresów
const MiniTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1e1e24] p-2 rounded border border-slate-700 shadow-xl text-xs font-monospace">
        <span className="text-white font-bold">{payload[0].value}</span>
      </div>
    );
  }
  return null;
};

// Komponent wskaźnika "Health Score" (Okrąg SVG)
const HealthGauge = ({ score }) => {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  let color = "#34d399"; // Green
  if (score < 40) color = "#f43f5e"; // Red
  else if (score < 70) color = "#f59e0b"; // Yellow

  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg className="transform -rotate-90 w-full h-full">
        <circle cx="64" cy="64" r={radius} stroke="#1e293b" strokeWidth="12" fill="transparent" />
        <circle cx="64" cy="64" r={radius} stroke={color} strokeWidth="12" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-white">{score}</span>
        <span className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">/100</span>
      </div>
    </div>
  );
};

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [day, setDay] = useState(1);
  
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceHistory, setDeviceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [technicians, setTechnicians] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [isDraftingTicket, setIsDraftingTicket] = useState(false);
  const [ticketForm, setTicketForm] = useState({ technician_id: '', notes: '' });
  
  const [sortConfig, setSortConfig] = useState({ key: 'device_id', direction: 'asc' });
  const [handledToday, setHandledToday] = useState(new Map());
  const [expandedChart, setExpandedChart] = useState(null);
  const [mergedView, setMergedView] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [lang, setLang] = useState('pl');
  const t = (key) => (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || key;
  const composeDiag = (d) => {
    if (!d) return '';
    const code = d.error_code || (d.status === 'NORMAL' ? 'NORMAL' : null);
    if (code) {
      const tpl = t('diag.' + code);
      if (tpl !== 'diag.' + code) return tpl.replace('{v}', d.diag_value != null ? d.diag_value : '');
    }
    return d.diagnosis || '';
  };
  const composeReco = (d) => {
    if (!d) return '';
    const code = d.error_code || (d.status === 'NORMAL' ? 'NORMAL' : null);
    if (code) {
      const tpl = t('reco.' + code);
      if (tpl !== 'reco.' + code) return tpl;
    }
    return d.recommendation || '';
  };
  const [connectionFilter, setConnectionFilter] = useState('ALL');

  useEffect(() => {
    fetch(`${API_URL}/api/technicians`)
      .then(res => res.json())
      .then(data => setTechnicians(data))
      .catch(err => console.error("Błąd pobierania serwisantów:", err));
  }, []);

  const fetchNightlySync = async (simulationDay) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/nightly-sync/${simulationDay}`);
      if (!response.ok) throw new Error(`Błąd serwera: ${response.status}`);
      const jsonData = await response.json();
      if (jsonData.error) throw new Error(jsonData.error);
      setData(jsonData);
      
      if (selectedDevice) {
        const updatedDevice = jsonData.fleet_status.find(d => d.device_id === selectedDevice.device_id);
        if (updatedDevice) handleViewDetails(updatedDevice, jsonData.date);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (device, currentDate) => {
    setSelectedDevice(device);
    setIsDraftingTicket(false);
    setTicketForm({ technician_id: '', notes: '' });
    setHistoryLoading(true);
    try {
      const histResponse = await fetch(`${API_URL}/api/device/${device.device_id}/history?target_date=${currentDate || data.date}`);
      const historyData = await histResponse.json();
      setDeviceHistory(historyData);
      
      const tickResponse = await fetch(`${API_URL}/api/device/${device.device_id}/tickets`);
      const ticketsData = await tickResponse.json();
      setTickets(ticketsData);
    } catch (err) {
      console.error("Błąd pobierania danych szczegółowych", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const submitTicket = async (e) => {
    e.preventDefault();
    const payload = {
      device_id: selectedDevice.device_id,
      action_category: selectedDevice.action_category,
      sku: selectedDevice.recommended_sku,
      technician_id: ticketForm.technician_id ? parseInt(ticketForm.technician_id) : null,
      notes: ticketForm.notes
    };

    try {
      await fetch(`${API_URL}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      fetchNightlySync(day); 
    } catch (err) {
      console.error("Błąd zapisu ticketa:", err);
    }
  };

  const resolveActiveTicket = async (ticketId) => {
    try {
      await fetch(`${API_URL}/api/tickets/${ticketId}/resolve?target_date=${data.date}`, { method: 'POST' });
      setHandledToday(prev => new Map(prev).set(selectedDevice.device_id, 'REPAIRED'));
      fetchNightlySync(day);
    } catch (err) {
      console.error("Błąd zamykania ticketa:", err);
    }
  };

  const confirmReject = async () => {
    const reason = rejectReason.trim() || 'Brak podanego powodu';
    try {
      const createRes = await fetch(`${API_URL}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: selectedDevice.device_id,
          action_category: "FALSE_POSITIVE (Odrzucono)",
          sku: "BRAK",
          technician_id: null,
          notes: `Analityk odrzucił alert AI (${selectedDevice.error_code}: ${selectedDevice.diagnosis}). POWÓD ODRZUCENIA: ${reason}`
        })
      });
      const ticketData = await createRes.json();
      await fetch(`${API_URL}/api/tickets/${ticketData.ticket_id}/resolve?target_date=${data.date}`, { method: 'POST' });
      setHandledToday(prev => new Map(prev).set(selectedDevice.device_id, 'REJECTED'));
      setShowRejectModal(false);
      setRejectReason('');
      fetchNightlySync(day);
    } catch (err) {
      console.error("Błąd odrzucania diagnozy:", err);
    }
  };

  useEffect(() => {
    setHandledToday(new Map());
    fetchNightlySync(day);
  }, [day]);

  const handleSortRequest = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  if (error) return <div className="p-10 text-red-600 font-bold">Błąd: {error}</div>;
  if (loading && !data) return <div className="p-10 font-bold text-slate-400">{t('loading_system')}</div>;

  const totalDevices = data.synced_devices;
  const preFailureDevices = data.fleet_status.filter(d => d.status === 'PRE-FAILURE').length;
  const criticalOnlyDevices = data.fleet_status.filter(d => d.status === 'CRITICAL').length;
  const offlineDevices = data.fleet_status.filter(d => d.status === 'OFFLINE').length;
  const staleDevices = data.fleet_status.filter(d => d.status === 'BRAK SYNC').length;
  const criticalDevices = preFailureDevices + criticalOnlyDevices;
  const onlineDevices = totalDevices - offlineDevices - criticalDevices;
  const avgRul = totalDevices > 0 ? Math.round(data.fleet_status.reduce((acc, curr) => acc + curr.predicted_rul, 0) / totalDevices) : 0;
  const confVals = data.fleet_status.map(d => d.confidence).filter(c => c !== null && c !== undefined);
  const avgConfidence = confVals.length > 0 ? Math.round(confVals.reduce((a, b) => a + b, 0) / confVals.length) : 0;

  const gsmCount = data.fleet_status.filter(d => d.connection_type === 'GSM').length;
  const usbCount = data.fleet_status.filter(d => d.connection_type === 'USB').length;

  const fleetHealthScore = totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0;
  const fleetHealthLabel = fleetHealthScore < 40 ? 'CRITICAL' : fleetHealthScore < 70 ? 'WARNING' : 'GOOD';
  const fleetHealthLabelColor = fleetHealthScore < 40 ? 'text-[#f43f5e] bg-[#f43f5e]/10 border-[#f43f5e]/30' : fleetHealthScore < 70 ? 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/30' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

  const statusPieData = [
    { name: 'Healthy', value: onlineDevices, color: '#34d399' },
    { name: 'Needs Attention', value: preFailureDevices, color: '#f59e0b' },
    { name: 'Critical', value: criticalOnlyDevices, color: '#f43f5e' },
    { name: 'Offline', value: offlineDevices, color: '#64748b' },
  ];

  const issuesMap = {};
  data.fleet_status.forEach(d => {
    if (!d.diagnosis || d.status === 'NORMAL' || d.status === 'OFFLINE' || d.status === 'BRAK SYNC') return;
    const ikey = d.error_code || d.diagnosis;
    if (!issuesMap[ikey]) issuesMap[ikey] = { error_code: d.error_code, diag_value: d.diag_value, diagnosis: d.diagnosis, status: d.status, count: 0, critical: false };
    issuesMap[ikey].count += 1;
    if (d.status === 'CRITICAL') issuesMap[ikey].critical = true;
  });
  const topIssues = Object.values(issuesMap).sort((a, b) => b.count - a.count).slice(0, 3);

  const aiSummaryText = criticalOnlyDevices > 0
    ? t('ai_sum_critical').replace('{n}', criticalOnlyDevices)
    : preFailureDevices > 0
    ? t('ai_sum_prefail').replace('{n}', preFailureDevices)
    : t('ai_sum_normal');
  const aiSummaryColor = criticalOnlyDevices > 0 ? 'text-[#f43f5e]' : preFailureDevices > 0 ? 'text-[#f59e0b]' : 'text-emerald-400';

  const displayFleet = data.fleet_status.map(device => {
    let updatedStatus = device.status;
    if (handledToday.has(device.device_id)) {
      const action = handledToday.get(device.device_id);
      if (action === 'REJECTED') updatedStatus = 'ZIGNOROWANO';
      if (action === 'REPAIRED') updatedStatus = 'ZAKOŃCZONO SERWIS';
    }
    return { ...device, status: updatedStatus };
  });

  const sortedFleet = displayFleet.sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    if (sortConfig.key === 'status') {
      const weight = { 'CRITICAL': 7, 'PRE-FAILURE': 6, 'IN PROGRESS': 5, 'ZAKOŃCZONO SERWIS': 4, 'ZIGNOROWANO': 3, 'NORMAL': 2, 'OFFLINE': 1 };
      aVal = weight[aVal] || 0;
      bVal = weight[bVal] || 0;
    }
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredFleet = connectionFilter === 'ALL' ? sortedFleet : sortedFleet.filter(d => d.connection_type === connectionFilter);

  const getStatusBadge = (status) => {
    switch(status) {
      case 'NORMAL': return <span className="text-[#34d399] flex items-center gap-1 font-bold text-xs"><CheckCircle size={12}/> NORMAL</span>;
      case 'PRE-FAILURE': return <span className="text-[#f59e0b] flex items-center gap-1 font-bold text-xs"><AlertTriangle size={12}/> PRE-FAILURE</span>;
      case 'CRITICAL': return <span className="text-[#f43f5e] flex items-center gap-1 font-bold text-xs animate-pulse"><AlertTriangle size={12}/> CRITICAL</span>;
      case 'IN PROGRESS': return <span className="text-blue-400 flex items-center gap-1 font-bold text-xs"><Wrench size={12}/> {t('st_in_progress')}</span>;
      case 'ZAKOŃCZONO SERWIS': return <span className="text-emerald-400 flex items-center gap-1 font-bold text-xs"><CheckCircle size={12}/> {t('st_handled')}</span>;
      case 'ZIGNOROWANO': return <span className="text-slate-400 flex items-center gap-1 font-bold text-xs"><XOctagon size={12}/> {t('st_rejected')}</span>;
      case 'BRAK SYNC': return <span className="text-amber-400 flex items-center gap-1 font-bold text-xs animate-pulse"><Wifi size={12}/> {t('st_no_sync')}</span>;
      case 'OFFLINE': return <span className="text-slate-500 flex items-center gap-1 font-bold text-xs"><Wifi size={12}/> OFFLINE</span>;
      default: return <span>{status}</span>;
    }
  };

  const currentClinicInfo = selectedDevice ? (clinicData[selectedDevice.device_id] || { 
    clinic_name: "Nieznana Placówka", address: "Brak danych", zip_code: "00-000", city: "Brak danych", contact: "Brak danych", email: "brak@danych.pl" 
  }) : null;

  const activeTicket = tickets.find(t => t.status === 'OPEN');
  const selectedDisplayStatus = selectedDevice ? displayFleet.find(d => d.device_id === selectedDevice.device_id)?.status || selectedDevice.status : null;

  // Obliczenia do widoków
  const healthScore = selectedDevice ? Math.max(0, Math.min(100, Math.round((selectedDevice.predicted_rul / 168) * 100))) : 0;
  const isHealthy = healthScore > 70;

  // Obliczanie wartości Min/Max dla małych wykresów
  const getMinMax = (key) => {
    if (!deviceHistory || deviceHistory.length === 0) return { min: 0, max: 0 };
    const values = deviceHistory.map(d => d[key]).filter(v => v !== null);
    if (values.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...values).toFixed(1), max: Math.max(...values).toFixed(1) };
  };

  const tempStats = getMinMax('temp_c');
  const snrStats = getMinMax('snr_db');
  const cpuStats = getMinMax('cpu_pct');
  const voltStats = getMinMax('voltage_v');

  const CHART_PAIRS = {
    head: {
      title: "Głowica — Temperatura i SNR",
      left: 'temp_c', right: 'snr_db',
      metrics: [
        { key: 'temp_c', label: 'Temperatura głowicy', unit: '°C', color: '#f59e0b', icon: <Thermometer size={16} className="text-[#f59e0b]"/> },
        { key: 'snr_db', label: 'SNR', unit: 'dB', color: '#60a5fa', icon: <Activity size={16} className="text-blue-400"/> },
      ]
    },
    unit: {
      title: "Jednostka — CPU i Napięcie",
      left: 'cpu_pct', right: 'voltage_v',
      metrics: [
        { key: 'cpu_pct', label: 'CPU', unit: '%', color: '#34d399', icon: <Cpu size={16} className="text-[#34d399]"/> },
        { key: 'voltage_v', label: 'Napięcie', unit: 'V', color: '#c084fc', icon: <Zap size={16} className="text-purple-400"/> },
      ]
    }
  };

  return (
    <div className="min-h-screen p-8 bg-[#0b0e14] text-slate-300 relative overflow-x-hidden font-sans selection:bg-indigo-500/30">
      
      {selectedDevice && (
        <div className="fixed inset-0 bg-black/70 z-40 transition-opacity backdrop-blur-sm" onClick={() => setSelectedDevice(null)}></div>
      )}

      {/* NOWY PANEL BOCZNY (WIDER & STYLED) */}
      <div className={`fixed inset-y-0 right-0 w-[800px] bg-[#111621] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-l border-[#1e293b] ${selectedDevice ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedDevice && (
          <>
            {/* GŁÓWNY NAGŁÓWEK */}
            <div className="flex justify-between items-start p-6 pb-4 border-b border-[#1e293b] bg-[#0b0e14]">
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight">{selectedDevice.device_id}</h2>
                <p className="text-sm text-[#8899aa] capitalize">{selectedDevice.device_model.replace('_', ' ')} ({selectedDevice.connection_type})</p>
              </div>
              <button onClick={() => setSelectedDevice(null)} className="p-2 bg-[#1e293b] rounded-full text-[#8899aa] hover:text-white transition">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* TOP CARDS ROW */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#182132] border border-[#2a374a] rounded-xl p-4 flex flex-col">
                  <div className="flex items-center gap-2 text-indigo-400 mb-2"><MapPin size={16}/> <span className="text-xs font-bold">{t('location')}</span></div>
                  <span className="text-sm font-bold text-white truncate">{currentClinicInfo.clinic_name}</span>
                  <span className="text-xs text-[#8899aa]">{currentClinicInfo.address}</span>
                  <span className="text-xs text-[#8899aa]">{currentClinicInfo.zip_code} {currentClinicInfo.city}</span>
                  <span className="text-xs text-[#8899aa] mt-1">Tel: {currentClinicInfo.contact}</span>
                </div>
                <div className="bg-[#182132] border border-[#2a374a] rounded-xl p-4 flex flex-col">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2"><Wifi size={16}/> <span className="text-xs font-bold">{t('connection')}</span></div>
                  <span className="text-sm font-bold text-white">{selectedDevice.connection_type} Active</span>
                  <span className="text-xs text-[#8899aa] flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Online</span>
                  <span className="text-xs text-[#8899aa] mt-1">{t('signal_strong')}</span>
                </div>
                <div className="bg-[#182132] border border-[#2a374a] rounded-xl p-4 flex flex-col">
                  <div className="flex items-center gap-2 text-blue-400 mb-2"><HardDrive size={16}/> <span className="text-xs font-bold">{t('system_info')}</span></div>
                  <span className="text-sm font-bold text-white">Firmware v3.1.5</span>
                  <span className="text-xs text-[#8899aa]">Last Sync: {selectedDevice.timestamp}</span>
                  <span className="text-xs text-[#8899aa] mt-1">{t('installed')}: 2024-01-15</span>
                </div>
              </div>

              {/* HEALTH OVERVIEW */}
              <div className="bg-[#182132] border border-[#2a374a] rounded-xl p-6 shadow-md flex justify-between items-center relative overflow-hidden">
                <div className="flex items-center gap-8">
                  <HealthGauge score={healthScore} />
                  <div>
                    <span className="text-xs text-[#8899aa] font-bold">{t('rul_label')} <Clock size={12} className="inline ml-1 mb-0.5"/></span>
                    <div className="text-5xl font-black text-white mt-1 mb-3">{selectedDevice.predicted_rul >= 168 ? '168+' : selectedDevice.predicted_rul} <span className="text-lg text-[#8899aa] font-normal">{t('hrs')}</span></div>
                    
                    <div className="flex gap-6 mt-4">
                      <div>
                        <span className="text-[10px] text-[#8899aa] uppercase tracking-wider block mb-1">{t('risk_level')}</span>
                        {getStatusBadge(selectedDisplayStatus)}
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8899aa] uppercase tracking-wider block mb-1">{t('ai_confidence')}</span>
                        <span className="text-sm font-bold text-blue-400">{selectedDevice.confidence != null ? selectedDevice.confidence : '—'}%</span>
                      </div>
                    </div>
                  </div>
                </div>
                <BrainCircuit size={120} className="absolute -right-10 -bottom-10 text-indigo-500/10" strokeWidth={1} />
              </div>

              {/* DYNAMIC ACTION CENTER (REPLACES RECOMMENDED ACTION) */}
              <div className={`rounded-xl border ${selectedDisplayStatus === 'CRITICAL' || selectedDisplayStatus === 'PRE-FAILURE' ? 'border-[#f43f5e]/30 bg-[#f43f5e]/10' : selectedDisplayStatus === 'IN PROGRESS' ? 'border-blue-500/30 bg-blue-500/10' : 'border-[#2a374a] bg-[#182132]'} overflow-hidden transition-colors`}>
                
                {/* WIZARD ZGŁOSZENIA */}
                {isDraftingTicket ? (
                  <form onSubmit={submitTicket} className="p-5">
                    <h4 className="font-bold text-indigo-400 mb-3 border-b border-indigo-900/50 pb-2">{t('ticket_creator')}: {selectedDevice.action_category}</h4>
                    {selectedDevice.action_category === 'WYSYŁKA_CZĘŚCI' ? (
                      <div className="mb-4 text-xs font-bold text-[#60a5fa] bg-[#60a5fa]/10 border border-[#60a5fa]/30 rounded p-2 flex items-center gap-2">
                        <Send size={13}/> {t('path_a_banner')}
                      </div>
                    ) : (
                      <div className="mb-4 text-xs font-bold text-[#f43f5e] bg-[#f43f5e]/10 border border-[#f43f5e]/30 rounded p-2 flex items-center gap-2">
                        <ShieldAlert size={13}/> {t('path_b_banner')}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs text-[#8899aa] mb-1">{t('recommended_sku')}</label>
                        <input type="text" readOnly value={selectedDevice.recommended_sku || 'Brak'} className="w-full bg-[#0b0e14] border border-[#2a374a] rounded p-2 text-sm text-slate-300 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-xs text-[#8899aa] mb-1">{t('verify_email')}</label>
                        <input type="email" key={selectedDevice.device_id} defaultValue={currentClinicInfo.email} className="w-full bg-[#0b0e14] border border-[#2a374a] rounded p-2 text-sm text-indigo-300 focus:outline-none focus:border-indigo-500" />
                      </div>
                    </div>
                    {(selectedDevice.action_category === 'WIZYTA_SERWISANTA' || selectedDevice.action_category === 'WYMIANA_JEDNOSTKI') && (
                      <div className="mb-4">
                        <label className="block text-xs text-[#8899aa] mb-1">{t('assign_technician')}</label>
                        <select required value={ticketForm.technician_id} onChange={(e) => setTicketForm({...ticketForm, technician_id: e.target.value})} className="w-full bg-[#111621] border border-[#2a374a] rounded p-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                          <option value="">{t('select_technician')}</option>
                          {technicians.map(tech => <option key={tech.id} value={tech.id}>{tech.first_name} {tech.last_name} ({tech.phone})</option>)}
                        </select>
                      </div>
                    )}
                    <div className="mb-4">
                      <label className="block text-xs text-[#8899aa] mb-1">{t('notes_label')}</label>
                      <textarea rows="2" value={ticketForm.notes} onChange={(e) => setTicketForm({...ticketForm, notes: e.target.value})} className="w-full bg-[#111621] border border-[#2a374a] rounded p-2 text-sm text-white focus:border-indigo-500 focus:outline-none"></textarea>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setIsDraftingTicket(false)} className="flex-1 bg-transparent hover:bg-white/5 border border-[#2a374a] text-white py-2 rounded text-sm transition">{t('cancel')}</button>
                      <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded text-sm transition shadow-lg">{t('submit_ticket')}</button>
                    </div>
                  </form>
                ) : 
                
                selectedDisplayStatus === 'IN PROGRESS' && activeTicket ? (
                  <div className="p-5 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2 text-blue-400 font-bold mb-1"><Wrench size={16}/> TICKET {activeTicket.ticket_id} ACTIVE</div>
                      <p className="text-sm text-slate-300">Action: {activeTicket.action_category} ({activeTicket.sku})</p>
                      {activeTicket.first_name && <p className="text-xs text-blue-300 mt-1 flex items-center gap-1"><Wrench size={12}/> {t('serviceman')}: {activeTicket.first_name} {activeTicket.last_name}</p>}
                    </div>
                    <button onClick={() => resolveActiveTicket(activeTicket.ticket_id)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold transition flex items-center gap-2 shadow-lg">
                      <ClipboardCheck size={16}/> Resolve Issue
                    </button>
                  </div>
                ) : 
                
                (selectedDisplayStatus === 'CRITICAL' || selectedDisplayStatus === 'PRE-FAILURE') ? (
                  <div className="p-5 flex justify-between items-center">
                    <div className="max-w-md">
                      <div className="flex items-center gap-2 text-[#f43f5e] font-bold mb-1"><ShieldAlert size={16}/> {t('action_required')}: {selectedDevice.error_code}</div>
                      <p className="text-sm text-white font-semibold mb-1">{composeDiag(selectedDevice)}</p>
                      <p className="text-xs text-slate-300">{composeReco(selectedDevice)}</p>
                    </div>
                    <div className="flex flex-col gap-2 min-w-[160px]">
                      <button onClick={() => {
                        setTicketForm({ technician_id: '', notes: `Anomalia: ${selectedDevice.diagnosis}\nAdres: ${currentClinicInfo.address}, ${currentClinicInfo.city}`});
                        setIsDraftingTicket(true);
                      }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg">
                        {t('initiate')} {selectedDevice.action_category.split('_')[0]}
                      </button>
                      <button onClick={() => { setRejectReason(''); setShowRejectModal(true); }} className="bg-transparent hover:bg-red-900/30 border border-[#f43f5e]/50 text-[#f43f5e] px-4 py-1.5 rounded text-xs transition flex items-center justify-center gap-2">
                        {t('reject_hitl')}
                      </button>
                    </div>
                  </div>
                ) : 
                
                selectedDisplayStatus === 'ZAKOŃCZONO SERWIS' ? (
                  <div className="p-5 flex items-center gap-4">
                    <ShieldCheck size={32} className="text-emerald-400" />
                    <div>
                      <h4 className="text-emerald-400 font-bold text-sm mb-0.5">{t('service_completed')}</h4>
                      <p className="text-xs text-slate-400">{t('service_completed_sub')}</p>
                    </div>
                  </div>
                ) : 
                
                selectedDisplayStatus === 'ZIGNOROWANO' ? (
                  <div className="p-5 flex items-center gap-4">
                    <XOctagon size={32} className="text-slate-500" />
                    <div>
                      <h4 className="text-slate-400 font-bold text-sm mb-0.5">{t('alert_ignored')}</h4>
                      <p className="text-xs text-slate-500">{t('alert_ignored_sub')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 flex items-center gap-4">
                    <BrainCircuit size={32} className="text-indigo-500" />
                    <div>
                      <h4 className="text-indigo-400 font-bold text-sm mb-0.5">{t('ai_summary')}</h4>
                      <p className="text-xs text-slate-400">{t('ai_summary_sub')}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* DWA SPAROWANE WYKRESY (F-07): temp+SNR (głowica) oraz CPU+napięcie (jednostka) */}
              <h3 className="text-[11px] font-bold text-[#8899aa] uppercase tracking-wider mb-2 mt-4">{t('telemetry_7d')}</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

                {/* WYKRES 1: Temperatura głowicy + SNR (Ścieżka A) */}
                <div onClick={() => { setExpandedChart('head'); setMergedView(false); }} className="bg-[#182132] border border-[#2a374a] hover:border-[#f59e0b]/50 transition cursor-pointer rounded-xl p-3">
                  <div className="flex items-center gap-4 mb-1">
                    <span className="text-[10px] font-bold flex items-center gap-1 text-[#f59e0b]"><Thermometer size={11}/> Temp głowicy (°C)</span>
                    <span className="text-[10px] font-bold flex items-center gap-1 text-[#60a5fa]"><Activity size={11}/> SNR (dB)</span>
                  </div>
                  <div className="h-[140px] w-full pointer-events-none">
                    <ResponsiveContainer>
                      <LineChart data={deviceHistory} margin={{top:5, right:8, left:8, bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a374a" vertical={false}/>
                        <XAxis dataKey="display_time" tick={{fontSize:9, fill:'#8899aa'}} minTickGap={50} axisLine={false} tickLine={false}/>
                        <YAxis yAxisId="t" tick={{fontSize:9, fill:'#f59e0b'}} axisLine={false} tickLine={false} width={42}/>
                        <YAxis yAxisId="s" orientation="right" tick={{fontSize:9, fill:'#60a5fa'}} axisLine={false} tickLine={false} width={42}/>
                        <Tooltip contentStyle={{background:'#0b0e14', border:'1px solid #2a374a', borderRadius:8, fontSize:11}}/>
                        <Line yAxisId="t" type="monotone" dataKey="temp_c" name="Temp" stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls={false}/>
                        <Line yAxisId="s" type="monotone" dataKey="snr_db" name="SNR" stroke="#60a5fa" strokeWidth={1.5} dot={false} connectNulls={false}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-between text-[9px] text-[#8899aa] mt-1">
                    <span>Temp {tempStats.min}–{tempStats.max}°C</span><span>SNR {snrStats.min}–{snrStats.max} dB</span>
                  </div>
                </div>

                {/* WYKRES 2: CPU + Napięcie (Ścieżka B) */}
                <div onClick={() => { setExpandedChart('unit'); setMergedView(false); }} className="bg-[#182132] border border-[#2a374a] hover:border-[#34d399]/50 transition cursor-pointer rounded-xl p-3">
                  <div className="flex items-center gap-4 mb-1">
                    <span className="text-[10px] font-bold flex items-center gap-1 text-[#34d399]"><Cpu size={11}/> CPU (%)</span>
                    <span className="text-[10px] font-bold flex items-center gap-1 text-purple-400"><Zap size={11}/> Napięcie (V)</span>
                  </div>
                  <div className="h-[140px] w-full pointer-events-none">
                    <ResponsiveContainer>
                      <LineChart data={deviceHistory} margin={{top:5, right:8, left:8, bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a374a" vertical={false}/>
                        <XAxis dataKey="display_time" tick={{fontSize:9, fill:'#8899aa'}} minTickGap={50} axisLine={false} tickLine={false}/>
                        <YAxis yAxisId="c" tick={{fontSize:9, fill:'#34d399'}} axisLine={false} tickLine={false} width={42}/>
                        <YAxis yAxisId="v" orientation="right" domain={['dataMin - 5','dataMax + 5']} tick={{fontSize:9, fill:'#c084fc'}} axisLine={false} tickLine={false} width={42}/>
                        <Tooltip contentStyle={{background:'#0b0e14', border:'1px solid #2a374a', borderRadius:8, fontSize:11}}/>
                        <Line yAxisId="c" type="monotone" dataKey="cpu_pct" name="CPU" stroke="#34d399" strokeWidth={1.5} dot={false} connectNulls={false}/>
                        <Line yAxisId="v" type="monotone" dataKey="voltage_v" name="Napięcie" stroke="#c084fc" strokeWidth={1.5} dot={false} connectNulls={false}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-between text-[9px] text-[#8899aa] mt-1">
                    <span>CPU {cpuStats.min}–{cpuStats.max}%</span><span>Napięcie {voltStats.min}–{voltStats.max} V</span>
                  </div>
                </div>
              </div>
              {/* TIMELINE (Service History) */}
              <div className="flex justify-between items-end mb-2 mt-4">
                <h3 className="text-[11px] font-bold text-[#8899aa] uppercase tracking-wider">{t('activity_timeline')}</h3>
                <button 
                  onClick={() => {
                    if (!tickets || tickets.length === 0) return alert("Brak historii do eksportu.");
                    let csv = "Ticket ID,Data Utworzenia,Typ Akcji,Status,Notatki,Kwalifikacja ML (Retrening)\n";
                    tickets.forEach(t => {
                      const isRejected = t.action_category.includes('FALSE_POSITIVE');
                      const mlQualification = isRejected ? "FALSE_POSITIVE (DO_RETRENINGU)" : "TRUE_POSITIVE (ZASADNE)";
                      const safeNotes = t.notes ? `"${t.notes.replace(/"/g, '""').replace(/\n/g, ' ')}"` : "BRAK";
                      csv += `${t.ticket_id},${t.creation_date},"${t.action_category}",${t.status},${safeNotes},"${mlQualification}"\n`;
                    });
                    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `VETEYE_Dataset_ML_${selectedDevice.device_id}.csv`;
                    a.click();
                  }}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-[#1e293b] hover:bg-indigo-500/20 text-[#8899aa] hover:text-indigo-400 px-3 py-1.5 rounded transition border border-[#2a374a] hover:border-indigo-500/30"
                >
                  <HardDrive size={12} /> Export CSV (ML Dataset)
                </button>
              </div>
              <div className="bg-[#182132] border border-[#2a374a] rounded-xl p-5">
                {tickets.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-2">{t('no_service_history')}</p>
                ) : (
                  <div className="relative border-l border-[#2a374a] ml-3 space-y-6">
                    {tickets.map((t, idx) => (
                      <div key={t.ticket_id} className="relative pl-6">
                        <div className={`absolute w-3 h-3 rounded-full -left-[6.5px] top-1 ${t.status === 'OPEN' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-[#2a374a]'}`}></div>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-bold text-white">{t.action_category.split(' ')[0]} <span className="text-xs font-normal text-slate-400">({t.ticket_id})</span></span>
                          <span className={`text-[10px] border px-2 py-0.5 rounded ${t.status === 'OPEN' ? 'border-blue-500 text-blue-400' : 'border-slate-600 text-slate-500'}`}>{t.status}</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-1">{t.notes ? `"${t.notes}"` : `SKU: ${t.sku}`}</p>
                        <span className="text-[10px] text-[#8899aa] block">{t.creation_date.split(' ')[0]} {t.resolved_date ? `— Closed: ${t.resolved_date.split(' ')[0]}` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>            
            </div>
          </>
        )}
      </div>

      {/* GŁÓWNY DASHBOARD — FLEET OVERVIEW */}
      <div className="flex justify-between items-start flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">{t('fleet_overview')}</h1>
          <p className="text-slate-400 mt-1">{t('fleet_overview_sub')}</p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Przełącznik języka PL / EN */}
          <div className="flex items-center bg-[#111621] border border-[#1e293b] rounded-lg overflow-hidden">
            <button onClick={() => setLang('pl')} className={`px-3 py-2 text-xs font-bold transition ${lang === 'pl' ? 'bg-indigo-600 text-white' : 'text-[#8899aa] hover:text-white'}`}>PL</button>
            <button onClick={() => setLang('en')} className={`px-3 py-2 text-xs font-bold transition ${lang === 'en' ? 'bg-indigo-600 text-white' : 'text-[#8899aa] hover:text-white'}`}>EN</button>
          </div>
          <div className="relative">
            <select value={connectionFilter} onChange={(e) => setConnectionFilter(e.target.value)} className="appearance-none bg-[#111621] border border-[#1e293b] text-white text-sm font-semibold pl-4 pr-9 py-2.5 rounded-lg cursor-pointer hover:border-[#2a374a] transition focus:outline-none focus:border-indigo-500">
              <option value="ALL">{t('conn_all')}</option>
              <option value="GSM">{t('conn_gsm')}</option>
              <option value="USB">{t('conn_usb')}</option>
            </select>
            <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8899aa] pointer-events-none" />
          </div>
          <div className="flex items-center gap-2 text-xs text-[#8899aa] font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {t('last_updated')}: {data.date}
          </div>
          <div className="h-8 w-px bg-[#2a374a] hidden sm:block"></div>
          <button onClick={() => setDay(day + 1)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-500 transition shadow-[0_0_15px_rgba(79,70,229,0.4)] active:scale-95 text-sm whitespace-nowrap">
            {t('sim_next_day')}
          </button>
          <button onClick={() => setDay(day + 10)} className="bg-[#1e293b] text-indigo-300 px-4 py-2.5 rounded-lg font-semibold hover:bg-[#2a374a] transition active:scale-95 text-sm whitespace-nowrap border border-indigo-500/30">
            {t('sim_plus10')}
          </button>
        </div>
      </div>

      {/* 5 KART STATYSTYK */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className={`bg-[#111621] p-5 rounded-xl border-t-4 border border-[#1e293b] shadow-lg flex flex-col justify-between ${fleetHealthScore < 40 ? 'border-t-[#f43f5e]' : fleetHealthScore < 70 ? 'border-t-[#f59e0b]' : 'border-t-emerald-500'}`}>
          <div className="flex items-center gap-2 text-[#8899aa] mb-2"><Activity size={16} /> <span className="font-bold text-[11px] uppercase tracking-wider">{t('health_score')}</span></div>
          <div className="text-3xl font-black text-white">{fleetHealthScore}</div>
          <span className={`text-[10px] font-bold mt-2 ${fleetHealthScore < 40 ? 'text-[#f43f5e]' : fleetHealthScore < 70 ? 'text-[#f59e0b]' : 'text-emerald-400'}`}>{fleetHealthLabel}</span>
        </div>
        <div className="bg-[#111621] p-5 rounded-xl border border-[#1e293b] shadow-lg flex flex-col justify-between">
          <div className="flex items-center gap-2 text-[#8899aa] mb-2"><Monitor size={16} /> <span className="font-bold text-[11px] uppercase tracking-wider">{t('total_devices')}</span></div>
          <div className="text-3xl font-black text-white">{totalDevices}</div>
          <div className="flex gap-2 mt-2">
            <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{gsmCount} GSM</span>
            <span className="text-[10px] font-bold text-[#8899aa] bg-white/5 px-2 py-0.5 rounded border border-[#2a374a]">{usbCount} USB</span>
          </div>
        </div>
        <div className="bg-[#111621] p-5 rounded-xl border-t-4 border-t-emerald-500 border border-[#1e293b] shadow-lg flex flex-col justify-between">
          <div className="flex items-center gap-2 text-[#8899aa] mb-2"><CheckCircle size={16} className="text-emerald-500" /> <span className="font-bold text-[11px] uppercase tracking-wider">{t('healthy')}</span></div>
          <div className="text-3xl font-black text-white">{onlineDevices}</div>
          <span className="text-[10px] font-bold text-emerald-400 mt-2">{totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0}% {t('of_total')}</span>
        </div>
        <div className="bg-[#111621] p-5 rounded-xl border-t-4 border-t-[#f59e0b] border border-[#1e293b] shadow-lg flex flex-col justify-between">
          <div className="flex items-center gap-2 text-[#8899aa] mb-2"><AlertTriangle size={16} className="text-[#f59e0b]" /> <span className="font-bold text-[11px] uppercase tracking-wider">{t('needs_attention')}</span></div>
          <div className="text-3xl font-black text-[#f59e0b]">{preFailureDevices}</div>
          <span className="text-[10px] font-bold text-[#f59e0b] mt-2">{totalDevices > 0 ? Math.round((preFailureDevices / totalDevices) * 100) : 0}% {t('of_total')}</span>
        </div>
        <div className="bg-[#111621] p-5 rounded-xl border-t-4 border-t-[#f43f5e] border border-[#1e293b] shadow-lg flex flex-col justify-between">
          <div className="flex items-center gap-2 text-[#8899aa] mb-2"><Siren size={16} className="text-[#f43f5e]" /> <span className="font-bold text-[11px] uppercase tracking-wider">{t('critical')}</span></div>
          <div className="text-3xl font-black text-[#f43f5e] drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]">{criticalOnlyDevices}</div>
          <span className="text-[10px] font-bold text-[#f43f5e] mt-2">{totalDevices > 0 ? Math.round((criticalOnlyDevices / totalDevices) * 100) : 0}% {t('of_total')}</span>
        </div>
      </div>

      {/* DEVICES BY STATUS / AI DIAGNOSIS / TOP ISSUES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#111621] p-6 rounded-xl border border-[#1e293b] shadow-lg">
          <h3 className="text-[11px] font-bold text-[#8899aa] uppercase tracking-wider mb-4">{t('devices_by_status')}</h3>
          <div className="flex items-center gap-6">
            <div className="w-28 h-28 flex-shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={statusPieData} dataKey="value" innerRadius={38} outerRadius={54} paddingAngle={2} stroke="none">
                    {statusPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 text-xs">
              {statusPieData.map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></span>
                  <span className="text-slate-300">{t({'Healthy':'healthy','Needs Attention':'needs_attention','Critical':'critical','Offline':'offline'}[s.name] || s.name)}</span>
                  <span className="text-[#8899aa]">{s.value} ({totalDevices > 0 ? Math.round((s.value / totalDevices) * 100) : 0}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#111621] p-6 rounded-xl border border-[#1e293b] shadow-lg flex flex-col">
          <h3 className="text-[11px] font-bold text-[#8899aa] uppercase tracking-wider mb-4">{t('ai_diag_summary')}</h3>
          <div className="flex items-center gap-4 flex-1">
            <BrainCircuit size={48} className="text-indigo-400 flex-shrink-0" />
            <div>
              <div className="text-3xl font-black text-emerald-400">{avgConfidence}%</div>
              <span className="text-[10px] text-[#8899aa] uppercase tracking-wider font-bold">{t('ai_confidence')}</span>
            </div>
          </div>
          <p className={`text-xs mt-3 ${aiSummaryColor}`}>{aiSummaryText}</p>
        </div>

        <div className="bg-[#111621] p-6 rounded-xl border border-[#1e293b] shadow-lg">
          <h3 className="text-[11px] font-bold text-[#8899aa] uppercase tracking-wider mb-4">{t('top_issues')}</h3>
          {topIssues.length === 0 ? (
            <p className="text-xs text-slate-500">{t('no_issues')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {topIssues.map(issue => (
                <div key={issue.error_code || issue.diagnosis} className="flex justify-between items-center gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${issue.critical ? 'bg-[#f43f5e]' : 'bg-[#f59e0b]'}`}></span>
                    <span className="text-xs text-slate-300 truncate">{composeDiag(issue)}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-[#8899aa]">{issue.count}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${issue.critical ? 'text-[#f43f5e] bg-[#f43f5e]/10' : 'text-[#f59e0b] bg-[#f59e0b]/10'}`}>{issue.critical ? 'Critical' : 'Warning'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SZYBKIE STATYSTYKI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8 bg-[#111621] border border-[#1e293b] rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <Clock size={20} className="text-[#8899aa]" />
          <div>
            <span className="text-[10px] text-[#8899aa] uppercase tracking-wider font-bold block">{t('average_rul')}</span>
            <span className="text-lg font-bold text-white">{avgRul} h</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Wifi size={20} className="text-[#8899aa]" />
          <div>
            <span className="text-[10px] text-[#8899aa] uppercase tracking-wider font-bold block">{t('offline_stale')}</span>
            <span className="text-lg font-bold text-white">{offlineDevices} <span className="text-xs text-[#8899aa] font-normal">{t('offline').toLowerCase()}</span> · <span className="text-amber-400">{staleDevices}</span> <span className="text-xs text-[#8899aa] font-normal">{t('stale_suffix')}</span></span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RefreshCw size={20} className="text-[#8899aa]" />
          <div>
            <span className="text-[10px] text-[#8899aa] uppercase tracking-wider font-bold block">{t('last_sync_avg')}</span>
            <span className="text-lg font-bold text-white">22:00 <span className="text-xs text-emerald-400 font-normal">{t('realtime')}</span></span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ShieldCheck size={20} className="text-[#8899aa]" />
          <div>
            <span className="text-[10px] text-[#8899aa] uppercase tracking-wider font-bold block">{t('firmware_uptodate')}</span>
            <span className="text-lg font-bold text-white">— <span className="text-xs text-[#8899aa] font-normal">{t('no_data')}</span></span>
          </div>
        </div>
      </div>

      {/* TABELA */}
      <div className="bg-[#111621] border border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-[#1e293b] flex justify-between items-center bg-[#0b0e14]">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">{t('global_fleet_status')}</h2>
          <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded border border-indigo-500/30">{t('live_ai')}</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-[#111621] text-[#8899aa] uppercase font-bold text-[10px] tracking-widest border-b border-[#1e293b]">
              <tr>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition group select-none" onClick={() => handleSortRequest('device_id')}>{t('col_device_id')} <ArrowUpDown size={12} className="inline opacity-50 group-hover:opacity-100 ml-1" /></th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition group select-none" onClick={() => handleSortRequest('device_model')}>{t('col_model')} <ArrowUpDown size={12} className="inline opacity-50 group-hover:opacity-100 ml-1" /></th>
                <th className="px-6 py-4">{t('connection')}</th>
                <th className="px-6 py-4">{t('col_last_sync')}</th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition group select-none" onClick={() => handleSortRequest('predicted_rul')}>{t('col_est_rul')} <ArrowUpDown size={12} className="inline opacity-50 group-hover:opacity-100 ml-1" /></th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition group select-none" onClick={() => handleSortRequest('status')}>{t('col_ai_status')} <ArrowUpDown size={12} className="inline opacity-50 group-hover:opacity-100 ml-1" /></th>
                <th className="px-6 py-4">{t('col_diagnosis')}</th>
                <th className="px-6 py-4 text-right">{t('col_action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b]">
              {filteredFleet.map((device) => (
                <tr key={device.device_id} className="hover:bg-[#182132] transition group cursor-pointer" onClick={() => handleViewDetails(device, data.date)}>
                  <td className="px-6 py-4 font-bold text-white">{device.device_id}</td>
                  <td className="px-6 py-4 capitalize text-[#8899aa]">{device.device_model.replace('_', ' ')}</td>
                  <td className="px-6 py-4 font-bold tracking-wider text-[10px]"><span className={device.connection_type === 'GSM' ? 'text-emerald-400' : 'text-amber-500'}>{device.connection_type}</span></td>
                  <td className="px-6 py-4 text-[#8899aa] text-xs whitespace-nowrap">{device.timestamp}</td>
                  <td className="px-6 py-4"><span className={`font-bold ${device.predicted_rul < 24 ? 'text-[#f43f5e]' : device.predicted_rul < 144 ? 'text-[#f59e0b]' : 'text-slate-300'}`}>{device.predicted_rul >= 168 ? '168+' : device.predicted_rul} h</span></td>
                  <td className="px-6 py-4">{getStatusBadge(device.status)}</td>
                  <td className="px-6 py-4 max-w-xs truncate text-xs"><span className={device.status !== 'NORMAL' ? 'text-white font-medium' : 'text-[#8899aa]'}>{composeDiag(device)}</span></td>
                  <td className="px-6 py-4 text-right"><button className="inline-flex items-center justify-center gap-1 text-indigo-400 group-hover:text-white font-semibold bg-indigo-500/10 px-3 py-1.5 rounded text-xs transition group-hover:bg-indigo-600 border border-indigo-500/20 group-hover:border-indigo-500">{t('view_details')} <ChevronRight size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* MODAL POWIĘKSZONEGO WYKRESU I ANALIZY */}
      {showRejectModal && selectedDevice && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowRejectModal(false)}></div>
          <div className="bg-[#111621] border border-[#f43f5e]/40 rounded-2xl w-full max-w-md relative z-10 shadow-2xl p-6">
            <div className="flex items-center gap-2 text-[#f43f5e] mb-3">
              <XOctagon size={20}/>
              <h3 className="text-lg font-bold">{t('reject_title')} ({selectedDevice.error_code})</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">{t('reject_desc')}</p>
            <label className="block text-xs text-[#8899aa] mb-1">{t('reject_reason_label')}</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              autoFocus
              rows={3}
              placeholder={t('reject_placeholder')}
              className="w-full bg-[#0b0e14] border border-[#2a374a] rounded p-2 text-sm text-white focus:outline-none focus:border-[#f43f5e] resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowRejectModal(false)} className="flex-1 bg-[#1e293b] text-slate-300 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2a374a] transition">{t('cancel')}</button>
              <button onClick={confirmReject} className="flex-1 bg-[#f43f5e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#e11d48] transition">{t('confirm_reject')}</button>
            </div>
          </div>
        </div>
      )}

      {expandedChart && CHART_PAIRS[expandedChart] && (() => {
        const pair = CHART_PAIRS[expandedChart];
        const m0 = pair.metrics[0], m1 = pair.metrics[1];
        return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setExpandedChart(null)}></div>
          <div className="bg-[#111621] border border-[#2a374a] rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col relative z-10 shadow-2xl">

            {/* Header + przełącznik scalania */}
            <div className="flex justify-between items-center p-5 border-b border-[#1e293b] bg-[#0b0e14] rounded-t-2xl">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-white">{pair.title}</h3>
                <span className="px-2 py-0.5 bg-[#1e293b] text-[#8899aa] rounded text-xs">{t('last_7_days')}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setMergedView(!mergedView)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-[#1e293b] text-indigo-300 hover:bg-[#2a374a] transition">
                  {mergedView ? t('split_charts') : t('merge_charts')}
                </button>
                <button onClick={() => setExpandedChart(null)} className="text-[#8899aa] hover:text-white transition bg-[#1e293b] p-1.5 rounded-full"><X size={20}/></button>
              </div>
            </div>

            {mergedView ? (
              // WIDOK SCALONY: jeden wykres z podwójną osią + wspólna tabela logów
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-[2] p-6 border-r border-[#1e293b] flex flex-col">
                  <div className="flex items-center gap-4 mb-2">
                    {pair.metrics.map(m => <span key={m.key} className="text-xs font-bold flex items-center gap-1" style={{color: m.color}}>{m.icon}{m.label} ({m.unit})</span>)}
                  </div>
                  <div className="flex-1 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={deviceHistory} margin={{top:10, right:10, left:0, bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a374a"/>
                        <XAxis dataKey="display_time" axisLine={false} tickLine={false} tick={{fontSize:11, fill:'#8899aa'}} minTickGap={60}/>
                        <YAxis yAxisId="l" axisLine={false} tickLine={false} tick={{fontSize:11, fill:m0.color}}/>
                        <YAxis yAxisId="r" orientation="right" axisLine={false} tickLine={false} tick={{fontSize:11, fill:m1.color}}/>
                        <Tooltip contentStyle={{backgroundColor:'#182132', borderColor:'#2a374a', borderRadius:'8px'}}/>
                        <Line yAxisId="l" type="monotone" dataKey={pair.left} name={m0.label} stroke={m0.color} strokeWidth={2} dot={false} connectNulls={false}/>
                        <Line yAxisId="r" type="monotone" dataKey={pair.right} name={m1.label} stroke={m1.color} strokeWidth={2} dot={false} connectNulls={false}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="flex-1 flex flex-col bg-[#0b0e14]">
                  <div className="p-4 border-b border-[#1e293b]"><h4 className="text-xs font-bold text-[#8899aa] uppercase tracking-wider">{t('raw_telemetry')}</h4></div>
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-[#111621]">
                        <tr>
                          <th className="px-3 py-3 text-[10px] font-bold text-[#8899aa] uppercase tracking-wider">{t('time')}</th>
                          <th className="px-3 py-3 text-[10px] font-bold text-right uppercase tracking-wider" style={{color:m0.color}}>{m0.unit}</th>
                          <th className="px-3 py-3 text-[10px] font-bold text-right uppercase tracking-wider" style={{color:m1.color}}>{m1.unit}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e293b]">
                        {[...deviceHistory].reverse().map((log, idx) => (
                          <tr key={idx} className="hover:bg-[#182132] transition">
                            <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">{log.display_time}</td>
                            <td className="px-3 py-2 text-xs font-bold text-right text-white">{log[pair.left] != null ? log[pair.left] : '—'}</td>
                            <td className="px-3 py-2 text-xs font-bold text-right text-white">{log[pair.right] != null ? log[pair.right] : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              // WIDOK ROZDZIELNY: dwa wykresy jeden pod drugim, każdy z osobną tabelą logów
              <div className="flex-1 overflow-y-auto divide-y divide-[#1e293b]">
                {pair.metrics.map(m => (
                  <div key={m.key} className="flex min-h-[290px]">
                    <div className="flex-[2] p-5 border-r border-[#1e293b] flex flex-col">
                      <div className="flex items-center gap-2 mb-2 text-sm font-bold" style={{color:m.color}}>{m.icon}{m.label} ({m.unit})</div>
                      <div className="flex-1 min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={deviceHistory} margin={{top:5, right:10, left:0, bottom:0}}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a374a"/>
                            <XAxis dataKey="display_time" axisLine={false} tickLine={false} tick={{fontSize:10, fill:'#8899aa'}} minTickGap={60}/>
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize:10, fill:'#8899aa'}}/>
                            <Tooltip contentStyle={{backgroundColor:'#182132', borderColor:'#2a374a', borderRadius:'8px'}} itemStyle={{color:m.color, fontWeight:'bold'}}/>
                            <Line type="monotone" dataKey={m.key} name={m.label} stroke={m.color} strokeWidth={2} dot={false} connectNulls={false}/>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col bg-[#0b0e14]">
                      <div className="p-3 border-b border-[#1e293b]"><h4 className="text-[10px] font-bold text-[#8899aa] uppercase tracking-wider">{t('logs_for')} {m.label}</h4></div>
                      <div className="flex-1 overflow-y-auto max-h-[240px]">
                        <table className="w-full text-left text-sm">
                          <thead className="sticky top-0 bg-[#111621]">
                            <tr>
                              <th className="px-3 py-2 text-[10px] font-bold text-[#8899aa] uppercase tracking-wider">{t('time')}</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-[#8899aa] uppercase tracking-wider text-right">{m.unit}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1e293b]">
                            {[...deviceHistory].reverse().map((log, idx) => (
                              <tr key={idx} className="hover:bg-[#182132] transition">
                                <td className="px-3 py-1.5 text-xs text-slate-400 whitespace-nowrap">{log.display_time}</td>
                                <td className={`px-3 py-1.5 text-xs font-bold text-right ${log[m.key] == null ? 'text-red-500' : 'text-white'}`}>{log[m.key] != null ? log[m.key] : 'BRAK'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        );
      })()}
      </div>
    </div>
  )
}

export default App