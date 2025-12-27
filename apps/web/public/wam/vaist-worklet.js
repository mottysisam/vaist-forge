/**
 * vAIst AudioWorklet Processor
 *
 * Real-time audio processing via WASM with proper memory management.
 *
 * Supports two modes:
 * 1. SharedArrayBuffer (low-latency, requires COOP/COEP headers)
 * 2. MessagePort fallback (higher latency, works everywhere)
 *
 * Memory Management:
 * - Uses fixed-size HEAPF32 buffers (no dynamic allocation in audio thread)
 * - Pre-allocated input/output buffers on WASM heap
 * - Zero-copy where possible
 */

class VAIstProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    // WASM module state
    this.wasmInstance = null;
    this.wasmMemory = null;
    this.heapF32 = null;

    // Pre-allocated buffer pointers (fixed addresses - no allocation in process())
    this.inputLeftPtr = 0;
    this.inputRightPtr = 0;
    this.outputLeftPtr = 0;
    this.outputRightPtr = 0;

    // Processing state
    this.bypass = false;
    this.initialized = false;
    this.sampleRate = sampleRate; // Global in AudioWorklet scope

    // Parameter state (MessagePort fallback for non-SAB browsers)
    this.parameterValues = {};
    this.pendingParameterUpdates = [];

    // SharedArrayBuffer support detection
    this.useSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
    this.parameterBuffer = null; // SharedArrayBuffer for low-latency param updates

    // Buffer size (AudioWorklet standard: 128 samples)
    this.bufferSize = 128;

    // Message handling
    this.port.onmessage = this.handleMessage.bind(this);

    // Signal ready
    this.port.postMessage({
      type: 'ready',
      sharedArrayBufferSupported: this.useSharedArrayBuffer,
    });
  }

  handleMessage(event) {
    const { type, data } = event.data;

    switch (type) {
      case 'init':
        this.initWasm(data);
        break;

      case 'setParameter':
        // MessagePort fallback: queue parameter updates
        if (data && typeof data.id === 'string' && typeof data.value === 'number') {
          this.pendingParameterUpdates.push({ id: data.id, value: data.value });
        }
        break;

      case 'setParameterBuffer':
        // SharedArrayBuffer mode: receive pre-allocated buffer
        if (data.buffer instanceof SharedArrayBuffer) {
          this.parameterBuffer = new Float32Array(data.buffer);
          this.parameterIds = data.parameterIds; // ['gain', 'drive', 'mix', ...]
        }
        break;

      case 'bypass':
        this.bypass = !!data.enabled;
        break;

      case 'reset':
        this.resetState();
        break;
    }
  }

  async initWasm(data) {
    try {
      const { wasmBytes, descriptor } = data;

      // CRITICAL: Destroy previous processor state to prevent memory leaks
      // across refine iterations (filter states, delay buffers accumulate)
      if (this.wasmInstance?.exports?.destroy) {
        this.wasmInstance.exports.destroy();
      }

      // Clear any previous state
      this.initialized = false;
      this.parameterValues = {};
      this.pendingParameterUpdates = [];

      // Create WASM memory with fixed size (no growth during processing)
      // 16 pages = 1MB, enough for stereo buffers + processor state
      this.wasmMemory = new WebAssembly.Memory({
        initial: 16,
        maximum: 32,
        shared: this.useSharedArrayBuffer,
      });

      // Compile and instantiate
      const wasmModule = await WebAssembly.compile(wasmBytes);
      this.wasmInstance = await WebAssembly.instantiate(wasmModule, {
        env: {
          memory: this.wasmMemory,
        },
        wasi_snapshot_preview1: {
          // Minimal WASI stubs (required by some Emscripten builds)
          proc_exit: () => {},
          fd_close: () => 0,
          fd_write: () => 0,
          fd_seek: () => 0,
        },
      });

      // Get HEAPF32 view (fixed reference - don't recreate per frame)
      this.heapF32 = new Float32Array(this.wasmMemory.buffer);

      // Allocate fixed buffer regions in WASM heap
      // Memory layout: [0-512: input L] [512-1024: input R] [1024-1536: out L] [1536-2048: out R]
      const BUFFER_OFFSET = 1024; // Start after any WASM data segment
      this.inputLeftPtr = BUFFER_OFFSET;
      this.inputRightPtr = BUFFER_OFFSET + 128;
      this.outputLeftPtr = BUFFER_OFFSET + 256;
      this.outputRightPtr = BUFFER_OFFSET + 384;

      // Initialize processor state
      if (this.wasmInstance.exports.prepare) {
        this.wasmInstance.exports.prepare(this.sampleRate);
      }

      // Store parameter metadata
      this.parameterDescriptor = descriptor?.parameters || [];

      this.initialized = true;

      this.port.postMessage({
        type: 'initialized',
        sampleRate: this.sampleRate,
        bufferSize: this.bufferSize,
      });
    } catch (error) {
      this.port.postMessage({
        type: 'error',
        message: `WASM init failed: ${error.message}`,
      });
    }
  }

  resetState() {
    // Use destroy() for full cleanup (resets filter states, delay buffers, etc.)
    if (this.wasmInstance?.exports?.destroy) {
      this.wasmInstance.exports.destroy();
    } else if (this.wasmInstance?.exports?.reset) {
      // Fallback for older WASM modules without destroy()
      this.wasmInstance.exports.reset();
    }
    this.pendingParameterUpdates = [];
    this.parameterValues = {};
  }

  applyPendingParameters() {
    // Apply MessagePort parameter updates (fallback mode)
    while (this.pendingParameterUpdates.length > 0) {
      const { id, value } = this.pendingParameterUpdates.shift();
      const setter = this.wasmInstance?.exports?.[`set_${id}`];
      if (typeof setter === 'function') {
        setter(value);
        this.parameterValues[id] = value;
      }
    }

    // Apply SharedArrayBuffer parameters (low-latency mode)
    // Main thread writes via Int32Array + Atomics.store() for atomicity,
    // but we read via Float32Array view - the bit pattern is automatically
    // reinterpreted as float. Single 32-bit reads are atomic on modern CPUs.
    if (this.parameterBuffer && this.parameterIds) {
      for (let i = 0; i < this.parameterIds.length; i++) {
        const id = this.parameterIds[i];
        // Direct Float32Array read (atomic for single 32-bit values)
        const value = this.parameterBuffer[i];
        if (value !== this.parameterValues[id]) {
          const setter = this.wasmInstance?.exports?.[`set_${id}`];
          if (typeof setter === 'function') {
            setter(value);
            this.parameterValues[id] = value;
          }
        }
      }
    }
  }

  process(inputs, outputs, parameters) {
    // Bypass mode or not initialized: passthrough
    if (this.bypass || !this.initialized || !this.wasmInstance) {
      const input = inputs[0];
      const output = outputs[0];
      if (input && output) {
        for (let ch = 0; ch < Math.min(input.length, output.length); ch++) {
          if (input[ch]) {
            output[ch].set(input[ch]);
          }
        }
      }
      return true;
    }

    const input = inputs[0];
    const output = outputs[0];

    if (!input || !output || input.length === 0 || output.length === 0) {
      return true;
    }

    const numSamples = output[0].length;

    // Apply any pending parameter changes
    this.applyPendingParameters();

    // Get HEAPF32 view (may need refresh if memory grew)
    if (this.heapF32.buffer !== this.wasmMemory.buffer) {
      this.heapF32 = new Float32Array(this.wasmMemory.buffer);
    }

    // Copy input to WASM heap (fixed buffer locations - no malloc)
    const leftIn = input[0] || new Float32Array(numSamples);
    const rightIn = input[1] || input[0] || new Float32Array(numSamples);

    this.heapF32.set(leftIn, this.inputLeftPtr);
    this.heapF32.set(rightIn, this.inputRightPtr);

    // Process via WASM
    // The process function takes: (leftInPtr, rightInPtr, leftOutPtr, rightOutPtr, numSamples)
    const processFunc = this.wasmInstance.exports.process;
    if (processFunc) {
      processFunc(
        this.inputLeftPtr * 4,  // Byte offset (Float32 = 4 bytes)
        this.inputRightPtr * 4,
        this.outputLeftPtr * 4,
        this.outputRightPtr * 4,
        numSamples
      );
    } else {
      // Fallback: copy input to output locations
      this.heapF32.copyWithin(this.outputLeftPtr, this.inputLeftPtr, this.inputLeftPtr + numSamples);
      this.heapF32.copyWithin(this.outputRightPtr, this.inputRightPtr, this.inputRightPtr + numSamples);
    }

    // Copy output from WASM heap to AudioWorklet output
    output[0].set(this.heapF32.subarray(this.outputLeftPtr, this.outputLeftPtr + numSamples));
    if (output[1]) {
      output[1].set(this.heapF32.subarray(this.outputRightPtr, this.outputRightPtr + numSamples));
    }

    return true;
  }

  static get parameterDescriptors() {
    // Dynamic parameters are handled via MessagePort/SharedArrayBuffer
    return [];
  }
}

registerProcessor('vaist-processor', VAIstProcessor);
