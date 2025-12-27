/**
 * Timeline Component
 *
 * Main timeline container that orchestrates:
 * - TimeRuler (top bar with time/bar markers)
 * - TrackLanes (horizontal tracks with clips)
 * - PlayheadCursor (animated playhead)
 * - LoopRegion (loop markers overlay)
 * - Markers (named position markers)
 *
 * Handles horizontal/vertical scrolling and zoom.
 */

"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useStudioStore, useTracks, useTimelineView, useMarkers } from "@/stores/studio-store";
import { useTransportStore } from "@/stores/transport-store";
import { TimeRuler } from "./TimeRuler";
import { TrackLane } from "./TrackLane";
import { PlayheadCursor } from "./PlayheadCursor";
import { LoopRegion } from "./LoopRegion";
import { Marker } from "./Marker";
import { samplesToPixels, pixelsToSamples } from "@/lib/utils/time-utils";

/**
 * Track header width (fixed)
 */
const TRACK_HEADER_WIDTH = 192; // 12rem = 192px

/**
 * Timeline ruler height
 */
const RULER_HEIGHT = 32;

/**
 * Default track height
 */
const DEFAULT_TRACK_HEIGHT = 80;

interface TimelineProps {
  className?: string;
}

export function Timeline({ className }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  const tracks = useTracks();
  const markers = useMarkers();
  const timelineView = useTimelineView();
  const { setScrollPosition, setZoom } = useStudioStore();

  const transportStore = useTransportStore();
  const { positionSamples, sampleRate, bpm, timeSignature, loop } = transportStore;

  // Track container dimensions
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Calculate total timeline width based on content
  const getTimelineWidth = useCallback(() => {
    // Get the furthest clip end position
    let maxEndSamples = sampleRate * 60; // Minimum 60 seconds
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (clip.endSamples > maxEndSamples) {
          maxEndSamples = clip.endSamples;
        }
      }
    }
    // Add some padding at the end
    maxEndSamples += sampleRate * 10; // 10 seconds padding

    return samplesToPixels(maxEndSamples, timelineView.pixelsPerSecond, sampleRate);
  }, [tracks, timelineView.pixelsPerSecond, sampleRate]);

  // Calculate total tracks height
  const getTotalTracksHeight = useCallback(() => {
    return tracks.reduce((total, track) => total + (track.height || DEFAULT_TRACK_HEIGHT), 0);
  }, [tracks]);

  // Update container dimensions on resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Sync ruler scroll with main scroll
  const handleScroll = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    const ruler = rulerRef.current;

    if (scrollContainer && ruler) {
      ruler.scrollLeft = scrollContainer.scrollLeft;
      setScrollPosition(scrollContainer.scrollLeft, scrollContainer.scrollTop);
    }
  }, [setScrollPosition]);

  // Handle wheel zoom (Ctrl/Cmd + wheel)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(10, Math.min(1000, timelineView.pixelsPerSecond * zoomFactor));
        setZoom(newZoom);
      }
    },
    [timelineView.pixelsPerSecond, setZoom]
  );

  // Handle click on timeline to seek
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      // Only handle clicks on the timeline area, not track headers
      const rect = scrollContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left + scrollContainer.scrollLeft;

      // Subtract track header width
      const timelineX = clickX - TRACK_HEADER_WIDTH;
      if (timelineX < 0) return;

      // Convert to samples
      const clickSamples = pixelsToSamples(timelineX, timelineView.pixelsPerSecond, sampleRate);
      transportStore.seekTo(Math.max(0, clickSamples));
    },
    [timelineView.pixelsPerSecond, sampleRate, transportStore]
  );

  // Calculate playhead position
  const playheadX = samplesToPixels(positionSamples, timelineView.pixelsPerSecond, sampleRate);

  // Timeline content width
  const timelineWidth = getTimelineWidth();
  const totalHeight = getTotalTracksHeight();

  return (
    <div
      ref={containerRef}
      className={cn("flex flex-col bg-zinc-950 overflow-hidden", className)}
      onWheel={handleWheel}
    >
      {/* Ruler Row */}
      <div className="flex shrink-0" style={{ height: RULER_HEIGHT }}>
        {/* Empty corner (track header width) */}
        <div
          className="shrink-0 bg-zinc-900 border-b border-r border-zinc-800"
          style={{ width: TRACK_HEADER_WIDTH }}
        />

        {/* Time Ruler */}
        <div
          ref={rulerRef}
          className="flex-1 overflow-hidden bg-zinc-900 border-b border-zinc-800"
        >
          <TimeRuler
            width={timelineWidth}
            height={RULER_HEIGHT}
            pixelsPerSecond={timelineView.pixelsPerSecond}
            sampleRate={sampleRate}
            bpm={bpm}
            timeSignature={timeSignature}
            timeFormat={timelineView.timeFormat}
          />
        </div>
      </div>

      {/* Main Scrollable Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto relative"
        onScroll={handleScroll}
        onClick={handleTimelineClick}
      >
        {/* Track Lanes Container */}
        <div
          className="relative"
          style={{
            width: TRACK_HEADER_WIDTH + timelineWidth,
            minHeight: Math.max(totalHeight, containerHeight - RULER_HEIGHT),
          }}
        >
          {/* Track Lanes */}
          {tracks.length === 0 ? (
            <div className="flex items-center justify-center h-full text-zinc-600">
              <div className="text-center py-20">
                <p className="text-sm">No tracks yet</p>
                <p className="text-xs mt-1">Click + to add a track</p>
              </div>
            </div>
          ) : (
            tracks.map((track, index) => {
              // Calculate y position
              let yOffset = 0;
              for (let i = 0; i < index; i++) {
                yOffset += tracks[i].height || DEFAULT_TRACK_HEIGHT;
              }

              return (
                <TrackLane
                  key={track.id}
                  track={track}
                  yOffset={yOffset}
                  headerWidth={TRACK_HEADER_WIDTH}
                  timelineWidth={timelineWidth}
                  pixelsPerSecond={timelineView.pixelsPerSecond}
                  sampleRate={sampleRate}
                />
              );
            })
          )}

          {/* Loop Region Overlay */}
          {loop.enabled && (
            <LoopRegion
              startSamples={loop.startSamples}
              endSamples={loop.endSamples}
              pixelsPerSecond={timelineView.pixelsPerSecond}
              sampleRate={sampleRate}
              headerWidth={TRACK_HEADER_WIDTH}
              height={Math.max(totalHeight, containerHeight - RULER_HEIGHT)}
            />
          )}

          {/* Markers */}
          {markers.map((marker) => (
            <Marker
              key={marker.id}
              marker={marker}
              pixelsPerSecond={timelineView.pixelsPerSecond}
              sampleRate={sampleRate}
              headerWidth={TRACK_HEADER_WIDTH}
              height={Math.max(totalHeight, containerHeight - RULER_HEIGHT)}
            />
          ))}

          {/* Playhead Cursor */}
          <PlayheadCursor
            positionX={playheadX + TRACK_HEADER_WIDTH}
            height={Math.max(totalHeight, containerHeight - RULER_HEIGHT)}
          />
        </div>
      </div>
    </div>
  );
}
