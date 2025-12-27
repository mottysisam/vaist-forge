/**
 * Studio Components
 *
 * Barrel exports for the WASM Studio DAW components.
 */

// Main layout
export { StudioLayout } from "./StudioLayout";

// Timeline components
export {
  Timeline,
  TimeRuler,
  TrackLane,
  AudioClip,
  PlayheadCursor,
  LoopRegion,
  Marker,
} from "./timeline";

// Track components
export { Track, CreateTrackButton } from "./track";

// Mixer components
export {
  Mixer,
  ChannelStrip,
  MasterBus,
  VolumeSlider,
  MeterDisplay,
  InsertSlot,
  InsertRack,
} from "./mixer";

// Transport components
export {
  Transport,
  TransportControls,
  TimeDisplay,
  TempoControl,
} from "./transport";

// Recording components
export {
  InputSelector,
  RecordButton,
  RecordArmButton,
  useAudioInputDevices,
} from "./recording";
