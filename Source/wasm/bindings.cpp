/**
 * Emscripten Bindings for VAIstProcessor
 *
 * Uses EMSCRIPTEN_KEEPALIVE for C-style exports (compatible with AudioWorklet).
 * No dynamic allocation in process() - uses fixed memory layout.
 *
 * IMPORTANT: Call destroy() before loading a new WASM module to prevent
 * memory leaks from accumulated filter/delay states across refine iterations.
 *
 * Compile with:
 *   emcc processor.cpp bindings.cpp -o vaist-processor.js \
 *     -s WASM=1 \
 *     -s EXPORTED_FUNCTIONS='["_prepare","_reset","_destroy","_process","_set_rate","_get_rate","_set_depth","_get_depth","_set_feedback","_get_feedback","_set_mix","_get_mix"]' \
 *     -s EXPORTED_RUNTIME_METHODS='["cwrap"]' \
 *     -s ALLOW_MEMORY_GROWTH=0 \
 *     -s INITIAL_MEMORY=1048576 \
 *     -O3
 */

#include "processor.h"
#include <emscripten.h>

// Global processor instance (no dynamic allocation)
static VAIstProcessor g_processor;

// Flag to track if processor is initialized
static bool g_initialized = false;

extern "C" {

/**
 * Initialize the processor with sample rate
 */
EMSCRIPTEN_KEEPALIVE
void prepare(float sampleRate) {
    g_processor.prepare(sampleRate);
    g_initialized = true;
}

/**
 * Reset processor state (keeps processor alive, just clears DSP state)
 */
EMSCRIPTEN_KEEPALIVE
void reset() {
    g_processor.reset();
}

/**
 * Destroy processor state completely.
 * MUST be called before loading a new WASM module to prevent memory leaks.
 * This resets all internal state and marks processor as uninitialized.
 */
EMSCRIPTEN_KEEPALIVE
void destroy() {
    g_processor.reset();
    g_initialized = false;
    // Note: Since g_processor is static, we can't actually delete it.
    // But we reset all state to prevent accumulation across refines.
}

/**
 * Process audio buffers (fixed memory locations)
 *
 * Memory layout expected by AudioWorklet:
 * - leftInPtr: byte offset to input left channel (128 floats)
 * - rightInPtr: byte offset to input right channel (128 floats)
 * - leftOutPtr: byte offset to output left channel (128 floats)
 * - rightOutPtr: byte offset to output right channel (128 floats)
 *
 * All offsets are in bytes (float = 4 bytes).
 * The worklet copies data to these locations before calling process().
 */
EMSCRIPTEN_KEEPALIVE
void process(int leftInPtr, int rightInPtr, int leftOutPtr, int rightOutPtr, int numSamples) {
    // Convert byte offsets to float pointers
    float* leftIn = reinterpret_cast<float*>(leftInPtr);
    float* rightIn = reinterpret_cast<float*>(rightInPtr);
    float* leftOut = reinterpret_cast<float*>(leftOutPtr);
    float* rightOut = reinterpret_cast<float*>(rightOutPtr);

    // Copy input to output (we process in-place on output buffers)
    for (int i = 0; i < numSamples; ++i) {
        leftOut[i] = leftIn[i];
        rightOut[i] = rightIn[i];
    }

    // Process the output buffers in-place
    float* buffers[2] = { leftOut, rightOut };
    g_processor.process(buffers, 2, numSamples);
}

// Parameter setters (C-style exports)

EMSCRIPTEN_KEEPALIVE
void set_rate(float value) {
    g_processor.set_rate(value);
}

EMSCRIPTEN_KEEPALIVE
void set_depth(float value) {
    g_processor.set_depth(value);
}

EMSCRIPTEN_KEEPALIVE
void set_feedback(float value) {
    g_processor.set_feedback(value);
}

EMSCRIPTEN_KEEPALIVE
void set_mix(float value) {
    g_processor.set_mix(value);
}

// Parameter getters (C-style exports)

EMSCRIPTEN_KEEPALIVE
float get_rate() {
    return g_processor.get_rate();
}

EMSCRIPTEN_KEEPALIVE
float get_depth() {
    return g_processor.get_depth();
}

EMSCRIPTEN_KEEPALIVE
float get_feedback() {
    return g_processor.get_feedback();
}

EMSCRIPTEN_KEEPALIVE
float get_mix() {
    return g_processor.get_mix();
}

} // extern "C"
