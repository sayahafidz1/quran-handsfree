export interface AudioChunkSummary {
  samples: number;
  rms: number;
  peak: number;
}

export function summarizeAudioChunk(samples: Float32Array): AudioChunkSummary {
  let sumSquares = 0;
  let peak = 0;
  for (const sample of samples) {
    sumSquares += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  return {
    samples: samples.length,
    rms: samples.length ? Math.sqrt(sumSquares / samples.length) : 0,
    peak
  };
}

export function getTranscriptDelta(previous: string, current: string): {
  text: string;
  revised: boolean;
} {
  let commonPrefixLength = 0;
  while (
    commonPrefixLength < previous.length
    && commonPrefixLength < current.length
    && previous[commonPrefixLength] === current[commonPrefixLength]
  ) {
    commonPrefixLength += 1;
  }
  return {
    text: current.slice(commonPrefixLength),
    revised: commonPrefixLength < previous.length
  };
}
