import { INITIAL_PYTHON_SNIPPET, TILE_SIZE_IN_IQ_SAMPLES } from '@/Utils/constants';
import { range } from '@/Utils/selector';
import { SigMFMetadata } from '@/Utils/sigmfMetadata';
import { getIQDataSlices } from '@/api/iqdata/Queries';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { applyProcessing } from '@/Sources/FetchMoreDataSource';
import { FFT } from '@/Utils/fft';
import { fftshift } from 'fftshift';
import { colMap } from '@/Utils/colormap';

function getFFTData(samples: Float32Array, fftSize: number, windowFunction: string) {
  let startTime = performance.now();
  const numFftsPerTile = TILE_SIZE_IN_IQ_SAMPLES / fftSize;
  let ffts = [];
  // loop through each row
  for (let i = 0; i < numFftsPerTile; i++) {
    let samples_slice = samples.slice(i * fftSize * 2, (i + 1) * fftSize * 2); // mult by 2 because this is int/floats not IQ samples

    // Apply a hamming window and hanning window
    if (windowFunction === 'hamming') {
      for (let window_i = 0; window_i < fftSize; window_i++) {
        samples_slice[window_i] =
          samples_slice[window_i] * (0.54 - 0.46 * Math.cos((2 * Math.PI * window_i) / (fftSize - 1)));
      }
    } else if (windowFunction === 'hanning') {
      for (let window_i = 0; window_i < fftSize; window_i++) {
        samples_slice[window_i] =
          samples_slice[window_i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * window_i) / (fftSize - 1)));
      }
    } else if (windowFunction === 'bartlett') {
      for (let window_i = 0; window_i < fftSize; window_i++) {
        samples_slice[window_i] =
          samples_slice[window_i] *
          ((2 / (fftSize - 1)) * ((fftSize - 1) / 2) - Math.abs(window_i - (fftSize - 1) / 2));
      }
    } else if (windowFunction === 'blackman') {
      for (let window_i = 0; window_i < fftSize; window_i++) {
        samples_slice[window_i] =
          samples_slice[window_i] *
          (0.42 -
            0.5 * Math.cos((2 * Math.PI * window_i) / fftSize) +
            0.08 * Math.cos((4 * Math.PI * window_i) / fftSize));
      }
    }

    const f = new FFT(fftSize);
    const out = f.createComplexArray(); // creates an empty array the length of fft.size*2
    f.transform(out, samples_slice);
    ffts.push(out);
  }
  console.debug('time to fft', performance.now() - startTime, 'ms');
  return ffts;
}

function getDb(ffts: number[][]) {
  let results = [];
  for (let i = 0; i < ffts.length; i++) {
    const fft = ffts[i];
    // convert to magnitude
    let magnitudes = new Array(fft.length / 2);
    for (let j = 0; j < fft.length / 2; j++) {
      magnitudes[j] = Math.sqrt(Math.pow(fft[j * 2], 2) + Math.pow(fft[j * 2 + 1], 2)); // take magnitude
    }

    fftshift(magnitudes); // in-place

    magnitudes = magnitudes.map((x) => 10.0 * Math.log10(x)); // convert to dB
    magnitudes = magnitudes.map((x) => (isFinite(x) ? x : 0)); // get rid of -infinity which happens when the input is all 0s
    results.push(magnitudes);
  }
  return results;
}

function getMagnitudes(db: number[][], magnitude_min: number, magnitude_max: number) {
  let results = [];
  for (let i = 0; i < db.length; i++) {
    let magnitudes = db[i];
    const tempFftMax = Math.max(...magnitudes);
    if (tempFftMax > magnitude_max) magnitude_max = tempFftMax;
    const tempFftMin = Math.min(...magnitudes);
    if (tempFftMin < magnitude_min) magnitude_min = tempFftMin;

    // convert to 0 - 255
    magnitudes = magnitudes.map((x) => x - magnitude_max); // lowest value is now 0
    magnitudes = magnitudes.map((x) => x / (magnitude_max - magnitude_min)); // highest value is now 1
    magnitudes = magnitudes.map((x) => x * 255); // now from 0 to 255

    // To leave some margin to go above max and below min, scale it to 50 to 200 for now
    magnitudes = magnitudes.map((x) => x * 0.588 + 50); // 0.588 is (200-50)/255

    // apply magnitude min and max
    magnitudes = magnitudes.map((x) => x / ((magnitude_max - magnitude_min) / 255));
    magnitudes = magnitudes.map((x) => x - magnitude_min);

    // Clip from 0 to 255 and convert to ints
    magnitudes = magnitudes.map((x) => (x > 255 ? 255 : x)); // clip above 255
    magnitudes = magnitudes.map((x) => (x < 0 ? 0 : x)); // clip below 0
    results.push(magnitudes);
  }
  return results;
}

function getTileImage(magnitudes: number[][], fftSize: number) {
  let startOfs = 0;
  let newFftData = new Uint8ClampedArray(fftSize * magnitudes.length * 4);
  console.debug('number of ffts magnitude', magnitudes.length, newFftData.length);
  for (let i = 0; i < magnitudes.length; i++) {
    let magnitude = magnitudes[i];
    let ipBuf8 = Uint8ClampedArray.from(magnitude); // anything over 255 or below 0 at this point will become a random number, hence clipping above
    // Apply colormap
    let line_offset = i * fftSize * 4;
    for (let sigVal, rgba, opIdx = 0, ipIdx = startOfs; ipIdx < fftSize + startOfs; opIdx += 4, ipIdx++) {
      sigVal = ipBuf8[ipIdx] || 0; // if input line too short add zeros
      rgba = colMap[sigVal]; // array of rgba values
      // byte reverse so number aa bb gg rr
      newFftData[line_offset + opIdx] = rgba[0]; // red
      newFftData[line_offset + opIdx + 1] = rgba[1]; // green
      newFftData[line_offset + opIdx + 2] = rgba[2]; // blue
      newFftData[line_offset + opIdx + 3] = rgba[3]; // alpha
    }
  }
  return newFftData;
}

function getCanvasImage(
  lowerTile: number,
  upperTile: number,
  fftSize: number,
  imageData: Record<number, Uint8ClampedArray>,
  zoomLevel: number
) {
  const numFftsPerTile = TILE_SIZE_IN_IQ_SAMPLES / fftSize;
  const tiles = range(Math.floor(lowerTile), Math.ceil(upperTile));
  if (tiles.length === 0) return;
  // Concatenate the full tiles
  let totalFftData = new Uint8ClampedArray(tiles.length * fftSize * numFftsPerTile * 4); // 4 because RGBA
  let counter = 0; // can prob make this cleaner with an iterator in the for loop below
  for (let tile of tiles) {
    if (imageData[tile]) {
      totalFftData.set(imageData[tile], counter);
    } else {
      // If the tile isnt available, fill with ones (white)
      let fakeFftData = new Uint8ClampedArray(fftSize * numFftsPerTile * 4);
      fakeFftData.fill(255); // for debugging its better to have the alpha set to opaque so the missing part isnt invisible
      totalFftData.set(fakeFftData, counter);
    }
    counter = counter + fftSize * numFftsPerTile * 4;
  }

  // Trim off the top and bottom
  let lowerTrim = (lowerTile - Math.floor(lowerTile)) * fftSize * numFftsPerTile; // amount we want to get rid of
  lowerTrim = lowerTrim - (lowerTrim % fftSize); // make it an even FFT size. TODO We need this rounding to happen earlier, so we get a consistent 600 ffts in the image
  let upperTrim = (1 - (upperTile - Math.floor(upperTile))) * fftSize * numFftsPerTile; // amount we want to get rid of
  upperTrim = upperTrim - (upperTrim % fftSize);
  let trimmedFftData = totalFftData.slice(lowerTrim * 4, totalFftData.length - upperTrim * 4); // totalFftData.length already includes the *4
  let num_final_ffts = trimmedFftData.length / fftSize / 4;

  // zoomLevel portion (decimate by N)
  if (zoomLevel !== 1) {
    num_final_ffts = Math.floor(num_final_ffts / zoomLevel);
    console.debug(num_final_ffts);
    let zoomedFftData = new Uint8ClampedArray(num_final_ffts * fftSize * 4);
    // loop through ffts
    for (let i = 0; i < num_final_ffts; i++) {
      zoomedFftData.set(
        trimmedFftData.slice(i * zoomLevel * fftSize * 4, (i * zoomLevel + 1) * fftSize * 4),
        i * fftSize * 4 // item offset for this data to be inserted
      );
    }
    trimmedFftData = zoomedFftData;
  }
  return new ImageData(trimmedFftData, fftSize, num_final_ffts);
}

export const useSpectrogram = (meta: SigMFMetadata) => {
  const [lowerTile, setLowerTile] = useState<number>(-1);
  const [upperTile, setUpperTile] = useState<number>(-1);
  const [tilesToDownload, setTilesToDownload] = useState<number[]>([]);
  const [rawIQData, setRawIQData] = useState<Record<number, Float32Array>>({});
  const [processedIQData, setProcessedIQData] = useState<Record<number, Float32Array>>({});
  const [fftData, setFFTData] = useState<Record<number, number[][]>>({});
  const [magnitudes, setMagnitudes] = useState<Record<number, number[]>>({});
  const [tileImages, setTileImages] = useState<Record<number, Uint8ClampedArray>>({});
  const [canvasImage, setCanvasImage] = useState<ImageData>();

  // Changes processing parameters (python snippet, taps, pyodide)
  const [pyodide, setInternalPyodide] = useState<any>(null);
  const [pythonSnippet, setInternalPythonSnippet] = useState<string>(INITIAL_PYTHON_SNIPPET);
  const [taps, setInternalTaps] = useState<number[]>([1]);

  function setPythonSnippet(snippet: string) {
    setProcessedIQData({});
    setFFTData({});
    setMagnitudes({});
    setTileImages({});
    setInternalPythonSnippet(snippet);
  }

  function setTaps(taps: number[]) {
    setProcessedIQData({});
    setFFTData({});
    setMagnitudes({});
    setTileImages({});
    setInternalTaps(taps);
  }

  function setPyodide(pyodide: any) {
    setProcessedIQData({});
    setFFTData({});
    setMagnitudes({});
    setTileImages({});
    setInternalPyodide(pyodide);
  }

  useEffect(() => {
    console.log('Processing raw IQ', rawIQData);
    Object.keys(rawIQData).forEach((key) => {
      if (!processedIQData[key]) {
        setProcessedIQData((prev) => {
          return {
            ...prev,
            [key]: applyProcessing(rawIQData[key], taps, pythonSnippet, pyodide),
          };
        });
      }
    });
  }, [rawIQData, pythonSnippet, taps, pyodide]);

  // Changes FFT parameters (fftSize, windowFunction)
  const [fftSize, setInternalFFTSize] = useState<number>(1024);
  const [windowFunction, setInternalWindowFunction] = useState<string>('hamming');

  function setFFTSize(fftSize: number) {
    setFFTData({});
    setMagnitudes({});
    setTileImages({});
    setInternalFFTSize(fftSize);
  }

  function setWindowFunction(windowFunction: string) {
    setFFTData({});
    setMagnitudes({});
    setTileImages({});
    setInternalWindowFunction(windowFunction);
  }

  useEffect(() => {
    console.log('Processing processed IQ', processedIQData);
    Object.keys(processedIQData).forEach((key) => {
      if (!fftData[key]) {
        setFFTData((prev) => {
          console.log('processing fft', key, processedIQData[key]);
          return {
            ...prev,
            [key]: getDb(getFFTData(processedIQData[key], fftSize, windowFunction)),
          };
        });
      }
    });
  }, [processedIQData, fftSize, windowFunction]);

  // Changes magnitude parameters (magnitudeMin, magnitudeMax)
  const [magnitudeMin, setInernalMagnitudeMin] = useState<number>(-30);
  const [magnitudeMax, setInternalMagnitudeMax] = useState<number>(-10);

  function setMagnitudeMin(magnitudeMin: number) {
    setMagnitudes({});
    setTileImages({});
    setInernalMagnitudeMin(magnitudeMin);
  }

  function setMagnitudeMax(magnitudeMax: number) {
    setMagnitudes({});
    setTileImages({});
    setInternalMagnitudeMax(magnitudeMax);
  }

  useEffect(() => {
    console.log('Processing FFT', fftData);
    Object.keys(fftData).forEach((key) => {
      if (!magnitudes[key]) {
        setMagnitudes((prev) => {
          return {
            ...prev,
            [key]: getMagnitudes(fftData[key], magnitudeMin, magnitudeMax),
          };
        });
      }
    });
  }, [fftData, magnitudeMin, magnitudeMax]);

  const [imageBitmap, setImageBitmap] = useState<ImageBitmap>();

  const handleNewSlice = (slice) => {
    console.log('new slice', slice);
  };

  useEffect(() => {
    console.log('Change Lower Uper', meta, lowerTile, upperTile);
    if (!meta || lowerTile < 0 || upperTile < 0 || lowerTile >= upperTile) return;
    const tiles = range(Math.floor(lowerTile), Math.ceil(upperTile));
    console.log('tiles', tiles);
    if (tiles.length > 0) {
      setTilesToDownload(tiles);
    }
  }, [lowerTile, upperTile]);

  const iqDataQuery = getIQDataSlices(
    meta,
    tilesToDownload,
    handleNewSlice,
    TILE_SIZE_IN_IQ_SAMPLES,
    !!meta && tilesToDownload?.length > 0
  );

  useEffect(() => {
    if (!iqDataQuery) return;
    iqDataQuery.forEach((slice) => {
      if (slice.data) {
        if (!rawIQData[slice.data.index]) {
          setRawIQData((prev) => {
            return {
              ...prev,
              [slice.data.index]: slice.data.iqArray,
            };
          });
        }
      }
    });
  }, [iqDataQuery.reduce((previous, current) => previous + current.dataUpdatedAt, '')]);

  useEffect(() => {
    console.log('Processing Magnitudes', magnitudes);
    Object.keys(magnitudes).forEach((key) => {
      setTileImages((prev) => {
        return {
          ...prev,
          [key]: getTileImage(magnitudes[key], fftSize),
        };
      });
    });
  }, [magnitudes, fftSize]);

  useEffect(() => {
    console.log('Processing Tile Images', tileImages);
    setCanvasImage(getCanvasImage(lowerTile, upperTile, fftSize, tileImages, 1));
  }, [tileImages, lowerTile, upperTile, fftSize, magnitudeMin, magnitudeMax]);

  useEffect(() => {
    console.log('Processing Canvas Image', canvasImage);
    createImageBitmap(canvasImage).then((imageBitmap) => {
      setImageBitmap(imageBitmap);
    });
  }, [canvasImage]);

  return {
    lowerTile,
    upperTile,
    taps,
    pythonSnippet,
    windowFunction,
    magnitudeMax,
    magnitudeMin,
    fftSize,
    pyodide,
    imageBitmap,
    processedIQData,
    fftData,
    magnitudes,
    tileImages,
    canvasImage,
    setLowerTile,
    setUpperTile,
    setTaps,
    setWindowFunction,
    setPythonSnippet,
    setMagnitudeMax,
    setMagnitudeMin,
    setFFTSize,
    setPyodide,
  };
};
