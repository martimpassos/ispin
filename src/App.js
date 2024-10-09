import React, { useState, useRef } from "react";
//import { analyze } from "web-audio-beat-detector";
import {
  createRealTimeBpmProcessor,
  getBiquadFilter,
} from "realtime-bpm-analyzer";
import "./App.css";

export default function AudioCapture() {
  const [microphoneAccess, setMicrophoneAccess] = useState(false);
  const [currentTempo, setCurrentTempo] = useState(120);
  const [tempoRange, setTempoRange] = useState(5); // default percentage range
  const [isAutoBpm, setIsAutoBpm] = useState(false);
  const [volume, setVolume] = useState(0); // This will track the current volume level
  const meterRef = useRef(null);

  const handleTempoRangeChange = (e) => {
    setTempoRange(parseInt(e.target.value));
  };

  const handleAutoBpmToggle = () => {
    setIsAutoBpm(!isAutoBpm);
  };

  async function getMicrophoneAccess() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Microphone access granted");
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      const source = audioContext.createMediaStreamSource(stream);

      // Gain control to amplify signal
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 16; // Adjust gain

      // Compressor to normalize volume
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-50, audioContext.currentTime);
      compressor.knee.setValueAtTime(40, audioContext.currentTime);
      compressor.ratio.setValueAtTime(12, audioContext.currentTime);
      compressor.attack.setValueAtTime(0, audioContext.currentTime);
      compressor.release.setValueAtTime(0.25, audioContext.currentTime);

      // Band-pass filter to isolate beat frequencies (e.g., bass drum)
      const bandpass = audioContext.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.value = 200; // Center on 150Hz for bass
      bandpass.Q.value = 1; // Quality factor

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512; // Size of FFT window (more data, smoother volume)

      // Volume Meter
      const dataArray = new Uint8Array(analyser.fftSize);

      function updateMeter() {
        analyser.getByteTimeDomainData(dataArray);

        // Calculate the RMS (Root Mean Square) of the waveform
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const value = (dataArray[i] - 128) / 128; // Normalize between -1 and 1
          sum += value * value; // Sum of squares
        }
        const rms = Math.sqrt(sum / dataArray.length); // RMS value
        setVolume(rms * 100); // Scale RMS for display purposes (0 to 100)

        requestAnimationFrame(updateMeter); // Continuously update the meter
      }
      updateMeter();

      // BPM Detection
      const realtimeAnalyzerNode = await createRealTimeBpmProcessor(
        audioContext,
        {
          continuousAnalysis: true,
          stabilizationTime: 20000, // Default value is 20_000ms after what the library will automatically delete all collected data and restart analyzing BPM
        }
      );
      const lowpass = getBiquadFilter(audioContext, {
        qualityValue: 1,
        frequencyValue: 150,
      });

      // Connect nodes together
      source
        .connect(lowpass)
        .connect(gainNode)
        //.connect(compressor)
        //.connect(bandpass)
        .connect(analyser)
        .connect(realtimeAnalyzerNode);
      //source.connect(lowpass).connect(audioContext.destination);

      realtimeAnalyzerNode.port.onmessage = (event) => {
        if (event.data.message === "BPM") {
          console.log("BPM", event.data.data.bpm);
          //setCurrentTempo(event.data.data.bpm[0]?.tempo);
        }
        if (event.data.message === "BPM_STABLE") {
          console.log("BPM_STABLE", event.data.data.bpm);
          setCurrentTempo(event.data.data.bpm[0]?.tempo);
        }
      };

      setMicrophoneAccess(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setMicrophoneAccess(false);
    }
  }

  return (
    <>
      {!microphoneAccess ? (
        <button onClick={getMicrophoneAccess}>Request Microphone Access</button>
      ) : (
        <div className="container">
          {/* Logo Placeholder */}
          <div className="logo">iSpin</div>

          {/* Tempo Display */}
          <div className="tempoDisplay">{currentTempo || "???"}</div>

          {/* Circles */}
          <div className="circlesContainer">
            <div className="circle"></div>
            <div className="circle"></div>
            <div className="circle"></div>
            <div className="circle"></div>
          </div>

          {/* Tap/Sync Button */}
          <div className="buttonContainer">
            <button className="tapSyncButton">tap/sync</button>
          </div>

          {/* Controls: Auto BPM Toggle & Tempo Range Radio Buttons */}
          <div className="controlsContainer">
            {/* Auto BPM Toggle */}
            <div className="toggleContainer">
              <label>
                <input
                  type="checkbox"
                  checked={isAutoBpm}
                  onChange={handleAutoBpmToggle}
                />
                Auto BPM
              </label>
            </div>

            {/* Tempo Range Radio Buttons */}
            <div className="radioButtonsContainer">
              <label>
                <input
                  type="radio"
                  name="tempoRange"
                  value={5}
                  checked={tempoRange === 5}
                  onChange={handleTempoRangeChange}
                />
                ±5%
              </label>
              <label>
                <input
                  type="radio"
                  name="tempoRange"
                  value={8}
                  checked={tempoRange === 8}
                  onChange={handleTempoRangeChange}
                />
                ±8%
              </label>
              <label>
                <input
                  type="radio"
                  name="tempoRange"
                  value={16}
                  checked={tempoRange === 16}
                  onChange={handleTempoRangeChange}
                />
                ±16%
              </label>
            </div>
          </div>

          {/* Gradient Line & Tempo Range Display */}
          <div className="tempoRangeContainer">
            <div className="tempoLine"></div>
            <div className="tempoRangeLeft">
              {(currentTempo * (1 - tempoRange / 100)).toFixed(1)}
            </div>
            <div className="tempoRangeRight">
              {(currentTempo * (1 + tempoRange / 100)).toFixed(1)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
