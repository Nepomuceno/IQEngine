import React, { createContext, useContext, useState } from 'react';

const SpectrogramContext = createContext(null);

export function SpectrogramContextProvider({ children, type, account, container, filePath }) {
  const [magnitudeMin, setMagnitudeMin] = useState<number>(-100);
  const [magnitudeMax, setMagnitudeMax] = useState<number>(50);
  const [colmap, setColmap] = useState<string>('viridis');
  const [windowFunction, setWindowFunction] = useState<string>('hann');
  const [fftSize, setFFTSize] = useState<number>(1024);
  const [spectrogramHeight, setSpectrogramHeight] = useState<number>(800);
  const [spectrogramWidth, setSpectrogramWidth] = useState<number>(1024);

  return (
    <SpectrogramContext.Provider
      value={{
        type,
        account,
        container,
        filePath,
        magnitudeMin,
        setMagnitudeMin,
        magnitudeMax,
        setMagnitudeMax,
        colmap,
        setColmap,
        windowFunction,
        setWindowFunction,
        fftSize,
        setFFTSize,
        spectrogramHeight,
        setSpectrogramHeight,
        spectrogramWidth,
        setSpectrogramWidth,
      }}
    >
      {children}
    </SpectrogramContext.Provider>
  );
}

export function useSpectrogramContext() {
  const context = useContext(SpectrogramContext);
  if (context === undefined) {
    throw new Error('useSpectrogramContext must be used within a SpectrogramContextProvider');
  }
  return context;
}
