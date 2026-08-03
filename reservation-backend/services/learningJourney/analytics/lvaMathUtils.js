'use strict';

function round(value, digits = 4) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const p = 10 ** digits;
  return Math.round(num * p) / p;
}

function mean(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function stddev(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (nums.length < 2) return 0;
  const avg = mean(nums);
  const variance = nums.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / (nums.length - 1);
  return Math.sqrt(variance);
}

function clamp(value, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
}

function logit(probability) {
  const p = clamp(probability, 1e-6, 1 - 1e-6);
  return Math.log(p / (1 - p));
}

function invLogit(x) {
  const num = Number(x);
  if (!Number.isFinite(num)) return 0.5;
  if (num >= 0) {
    const z = Math.exp(-num);
    return 1 / (1 + z);
  }
  const z = Math.exp(num);
  return z / (1 + z);
}

function solveLinearSystem(matrix, vector) {
  const n = matrix.length;
  const aug = matrix.map((row, i) => [...row, vector[i]]);

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    let pivotVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row += 1) {
      const candidate = Math.abs(aug[row][col]);
      if (candidate > pivotVal) {
        pivotVal = candidate;
        pivotRow = row;
      }
    }
    if (pivotVal < 1e-12) return null;
    if (pivotRow !== col) {
      const tmp = aug[col];
      aug[col] = aug[pivotRow];
      aug[pivotRow] = tmp;
    }
    const pivot = aug[col][col];
    for (let j = col; j <= n; j += 1) aug[col][j] /= pivot;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = aug[row][col];
      if (Math.abs(factor) < 1e-12) continue;
      for (let j = col; j <= n; j += 1) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }
  return aug.map((row) => row[n]);
}

function dot(a, b) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function fitOlsRegression(designMatrix, outcomes, { ridge = 1e-6 } = {}) {
  if (!designMatrix.length || designMatrix.length !== outcomes.length) return null;
  const p = designMatrix[0].length;
  if (p < 1) return null;

  const xtx = Array.from({ length: p }, () => new Array(p).fill(0));
  const xty = new Array(p).fill(0);
  for (let i = 0; i < designMatrix.length; i += 1) {
    const row = designMatrix[i];
    const y = Number(outcomes[i]);
    if (!Number.isFinite(y)) continue;
    for (let j = 0; j < p; j += 1) {
      xty[j] += row[j] * y;
      for (let k = 0; k < p; k += 1) {
        xtx[j][k] += row[j] * row[k];
      }
    }
  }
  for (let i = 0; i < p; i += 1) xtx[i][i] += ridge;

  const coefficients = solveLinearSystem(xtx, xty);
  if (!coefficients) return null;
  return { coefficients, featureCount: p, sampleSize: designMatrix.length };
}

function predictOls(model, featureVector) {
  if (!model?.coefficients?.length) return null;
  return dot(model.coefficients, featureVector);
}

function fitLogisticRegression(designMatrix, outcomes, { maxIter = 250, learningRate = 0.15, ridge = 1e-4 } = {}) {
  if (!designMatrix.length || designMatrix.length !== outcomes.length) return null;
  const p = designMatrix[0].length;
  if (p < 1) return null;

  let weights = new Array(p).fill(0);
  const n = designMatrix.length;

  for (let iter = 0; iter < maxIter; iter += 1) {
    const gradient = new Array(p).fill(0);
    for (let i = 0; i < n; i += 1) {
      const z = dot(weights, designMatrix[i]);
      const pred = invLogit(z);
      const err = pred - outcomes[i];
      for (let j = 0; j < p; j += 1) {
        gradient[j] += err * designMatrix[i][j];
      }
    }
    for (let j = 0; j < p; j += 1) {
      const reg = j === 0 ? 0 : ridge * weights[j];
      weights[j] -= learningRate * ((gradient[j] / n) + reg);
    }
  }

  return { coefficients: weights, featureCount: p, sampleSize: n };
}

function predictLogistic(model, featureVector) {
  if (!model?.coefficients?.length) return null;
  return invLogit(dot(model.coefficients, featureVector));
}

function computeAustinLogitCaliper(propensities) {
  const logits = propensities
    .map(Number)
    .filter((p) => Number.isFinite(p) && p > 0.01 && p < 0.99)
    .map((p) => logit(p));
  if (logits.length < 2) return null;
  return round(0.2 * stddev(logits), 4);
}

function ci95(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (nums.length < 2) return { low: null, high: null };
  const avg = mean(nums);
  const variance = nums.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / (nums.length - 1);
  const se = Math.sqrt(variance) / Math.sqrt(nums.length);
  return { low: round(avg - (1.96 * se), 2), high: round(avg + (1.96 * se), 2) };
}

module.exports = {
  round,
  mean,
  stddev,
  clamp,
  logit,
  invLogit,
  fitOlsRegression,
  predictOls,
  fitLogisticRegression,
  predictLogistic,
  computeAustinLogitCaliper,
  ci95,
  dot,
};
