/**
 * Time Ruler Component
 *
 * Displays time markers along the top of the timeline.
 * Supports two display formats:
 * - Bars:Beats (musical time)
 * - Minutes:Seconds (clock time)
 *
 * Automatically adjusts grid density based on zoom level.
 */

"use client";

import { useMemo } from "react";
import type { TimeSignature, TimeDisplayFormat } from "@/types/studio";
import {
  getSamplesPerBar,
  getSamplesPerBeat,
  samplesToBarsBeatsTicks,
  samplesToTimePosition,
  formatBarsBeatsShort,
  formatSamplesAsShortTime,
} from "@/lib/utils/time-utils";

interface TimeRulerProps {
  width: number;
  height: number;
  pixelsPerSecond: number;
  sampleRate: number;
  bpm: number;
  timeSignature: TimeSignature;
  timeFormat: TimeDisplayFormat;
}

interface RulerMark {
  position: number; // pixels
  label: string;
  isMajor: boolean;
}

export function TimeRuler({
  width,
  height,
  pixelsPerSecond,
  sampleRate,
  bpm,
  timeSignature,
  timeFormat,
}: TimeRulerProps) {
  // Generate ruler marks based on format and zoom level
  const marks = useMemo(() => {
    const result: RulerMark[] = [];

    if (timeFormat === "bars") {
      // Musical time format
      const samplesPerBar = getSamplesPerBar(bpm, timeSignature, sampleRate);
      const samplesPerBeat = getSamplesPerBeat(bpm, sampleRate);
      const pixelsPerBar = (samplesPerBar / sampleRate) * pixelsPerSecond;
      const pixelsPerBeat = (samplesPerBeat / sampleRate) * pixelsPerSecond;

      // Determine grid density based on zoom
      // Show bars when zoomed out, beats when zoomed in
      const showBeats = pixelsPerBeat > 30;
      const showSubdivisions = pixelsPerBeat > 60;

      // Calculate number of bars to show
      const totalSamples = (width / pixelsPerSecond) * sampleRate;
      const totalBars = Math.ceil(totalSamples / samplesPerBar) + 1;

      for (let bar = 1; bar <= totalBars; bar++) {
        const barSamples = (bar - 1) * samplesPerBar;
        const barPosition = (barSamples / sampleRate) * pixelsPerSecond;

        // Bar marker (major)
        result.push({
          position: barPosition,
          label: `${bar}`,
          isMajor: true,
        });

        // Beat markers within bar
        if (showBeats) {
          for (let beat = 2; beat <= timeSignature.numerator; beat++) {
            const beatSamples = barSamples + (beat - 1) * samplesPerBeat;
            const beatPosition = (beatSamples / sampleRate) * pixelsPerSecond;

            result.push({
              position: beatPosition,
              label: showSubdivisions ? `${bar}.${beat}` : "",
              isMajor: false,
            });
          }
        }
      }
    } else {
      // Clock time format (MM:SS)
      const pixelsPerSecondActual = pixelsPerSecond;

      // Determine time grid interval based on zoom
      let intervalSeconds: number;
      if (pixelsPerSecondActual < 20) {
        intervalSeconds = 30; // 30 second intervals
      } else if (pixelsPerSecondActual < 50) {
        intervalSeconds = 10; // 10 second intervals
      } else if (pixelsPerSecondActual < 100) {
        intervalSeconds = 5; // 5 second intervals
      } else if (pixelsPerSecondActual < 200) {
        intervalSeconds = 1; // 1 second intervals
      } else {
        intervalSeconds = 0.5; // 0.5 second intervals
      }

      // Major marks every N intervals
      const majorInterval = intervalSeconds < 5 ? 5 : 1;

      const totalSeconds = width / pixelsPerSecond;
      const numMarks = Math.ceil(totalSeconds / intervalSeconds) + 1;

      for (let i = 0; i <= numMarks; i++) {
        const seconds = i * intervalSeconds;
        const position = seconds * pixelsPerSecond;
        const isMajor = i % majorInterval === 0;

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const label = isMajor ? `${mins}:${secs.toString().padStart(2, "0")}` : "";

        result.push({
          position,
          label,
          isMajor,
        });
      }
    }

    return result;
  }, [width, pixelsPerSecond, sampleRate, bpm, timeSignature, timeFormat]);

  return (
    <div
      className="relative bg-zinc-900"
      style={{ width, height }}
    >
      {/* Grid lines and labels */}
      {marks.map((mark, index) => (
        <div
          key={index}
          className="absolute top-0"
          style={{ left: mark.position }}
        >
          {/* Tick mark */}
          <div
            className={mark.isMajor ? "bg-zinc-500" : "bg-zinc-700"}
            style={{
              width: 1,
              height: mark.isMajor ? height * 0.6 : height * 0.3,
              marginTop: mark.isMajor ? 0 : height * 0.3,
            }}
          />

          {/* Label */}
          {mark.label && (
            <span
              className="absolute text-[10px] text-zinc-400 whitespace-nowrap"
              style={{
                top: 2,
                left: 4,
              }}
            >
              {mark.label}
            </span>
          )}
        </div>
      ))}

      {/* Bottom border line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-zinc-800"
      />
    </div>
  );
}
