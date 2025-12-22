import { useEffect, useRef, useState } from 'react';
import mqtt from 'mqtt';

function App() {
  const [moisture, setMoisture] = useState(0);
  const [displayedMoisture, setDisplayedMoisture] = useState(0);
  const [pumpOn, setPumpOn] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [connection, setConnection] = useState('Connecting');

  const clientRef = useRef(null);
  const animRef = useRef(null);

  // ---------- MQTT CONNECT ----------
  useEffect(() => {
    const client = mqtt.connect(
      'wss://c946cbf4bb284a01a41608824a6630cb.s1.eu.hivemq.cloud:8884/mqtt',
      {
        username: 'Swayam',
        password: 'Swym(232459)',
        clientId: `react_${Math.random().toString(16).slice(2)}`,
      }
    );

    clientRef.current = client;

    client.on('connect', () => {
      setConnection('Connected');
      client.subscribe([
        'plant/moisture',
        'plant/pump/status',
        'plant/auto/status',
      ]);
    });

    client.on('message', (topic, message) => {
      const msg = message.toString();

      if (topic === 'plant/moisture') {
        const val = Number(msg);
        if (!isNaN(val)) setMoisture(val);
      }

      if (topic === 'plant/pump/status') {
        setPumpOn(msg === 'ON');
      }

      if (topic === 'plant/auto/status') {
        setAutoMode(msg === 'ON');
      }
    });

    return () => client.end(true);
  }, []);

  // ---------- ANIMATION ----------
  useEffect(() => {
    const start = displayedMoisture;
    const end = moisture;
    const startTime = performance.now();
    const duration = 600;

    const animate = (t) => {
      const p = Math.min((t - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayedMoisture(start + (end - start) * eased);
      if (p < 1) animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [moisture]);

  // ---------- CONTROLS ----------
  const toggleAuto = () => {
    clientRef.current?.publish('plant/auto', autoMode ? 'OFF' : 'ON');
  };

  const togglePump = () => {
    if (autoMode) return;
    clientRef.current?.publish('plant/pump', pumpOn ? 'OFF' : 'ON');
  };

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-[320px] bg-zinc-950 rounded-3xl p-6 border border-zinc-900">
        <p className="text-center text-zinc-500 text-sm">SOIL MOISTURE</p>
        <p className="text-center text-5xl font-bold text-white mt-2">
          {Math.round(displayedMoisture)}%
        </p>

        {/* Auto Toggle */}
        <div className="flex justify-between items-center bg-zinc-900 p-4 rounded-xl mt-8">
          <span className="text-white">Auto Mode</span>
          <button
            onClick={toggleAuto}
            className={`w-12 h-6 rounded-full p-1 ${
              autoMode ? 'bg-green-500' : 'bg-zinc-700'
            }`}
          >
            <div
              className={`w-4 h-4 bg-white rounded-full transition ${
                autoMode ? 'translate-x-6' : ''
              }`}
            />
          </button>
        </div>

        {/* Pump Button */}
        <button
          onClick={togglePump}
          disabled={autoMode}
          className={`w-full mt-6 py-5 rounded-2xl font-bold text-lg transition
            ${
              pumpOn
                ? 'bg-red-500/10 text-red-500 border border-red-500/50'
                : 'bg-white text-black'
            } ${autoMode ? 'opacity-50' : ''}`}
        >
          {pumpOn ? 'STOP WATERING' : 'WATER PLANT'}
        </button>

        <p className="text-center text-xs text-zinc-600 mt-4">
          {autoMode
            ? 'Automatic watering enabled'
            : pumpOn
            ? 'Pump is running'
            : 'Manual mode'}
        </p>
      </div>
    </div>
  );
}

export default App;
