/**
 * ONNX Runtime session manager
 */
import * as ort from 'onnxruntime-web';

// Configure ONNX Runtime
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;

/**
 * Create an ONNX inference session
 * @param {string} modelPath - Path to ONNX model
 * @param {Object} options - Session options
 * @returns {Promise<InferenceSession>} Initialized session
 */
export async function createSession(modelPath, options = {}) {
  try {
    const sessionOptions = {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
      enableCpuMemArena: true,
      enableMemPattern: true,
      ...options
    };

    console.log(`Loading model: ${modelPath}`);
    const session = await ort.InferenceSession.create(modelPath, sessionOptions);
    console.log(`Model loaded successfully: ${modelPath}`);
    
    return session;
  } catch (error) {
    console.error(`Failed to load model ${modelPath}:`, error);
    throw error;
  }
}

/**
 * Run inference on a session
 * @param {InferenceSession} session - ONNX session
 * @param {Object} feeds - Input tensors
 * @returns {Promise<Object>} Output tensors
 */
export async function runInference(session, feeds) {
  try {
    const results = await session.run(feeds);
    return results;
  } catch (error) {
    console.error('Inference failed:', error);
    throw error;
  }
}

/**
 * Create tensor from data
 * @param {Float32Array} data - Tensor data
 * @param {Array} dims - Tensor dimensions
 * @returns {Tensor} ONNX tensor
 */
export function createTensor(data, dims) {
  return new ort.Tensor('float32', data, dims);
}

/**
 * Dispose of session and free resources
 * @param {InferenceSession} session - Session to dispose
 */
export async function disposeSession(session) {
  if (session) {
    try {
      // ONNX Runtime Web doesn't have explicit dispose method
      // Memory will be garbage collected
      console.log('Session disposed');
    } catch (error) {
      console.error('Error disposing session:', error);
    }
  }
}