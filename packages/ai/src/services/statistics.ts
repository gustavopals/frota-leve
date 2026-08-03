/**
 * Utilitarios estatisticos usados pela deteccao deterministica de anomalias.
 * Ficam isolados para serem testados sem tocar em banco nem em IA.
 */

export function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

/** Desvio padrao amostral (n-1). Retorna 0 quando ha menos de 2 pontos. */
export function standardDeviation(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const average = mean(values);
  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

/**
 * Z-score de `value` contra a distribuicao de `population`.
 * Retorna 0 quando o desvio padrao é zero — sem dispersao nao ha outlier.
 */
export function zScore(value: number, population: number[]): number {
  const deviation = standardDeviation(population);

  if (deviation === 0) {
    return 0;
  }

  return (value - mean(population)) / deviation;
}

/**
 * Percentil por interpolacao linear (mesmo metodo do `numpy.percentile` default).
 * `percentile` vai de 0 a 100.
 */
export function percentile(values: number[], percentileRank: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const rank = (percentileRank / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];

  if (lower === undefined) {
    return 0;
  }

  if (upper === undefined || lowerIndex === upperIndex) {
    return lower;
  }

  const weight = rank - lowerIndex;

  return lower * (1 - weight) + upper * weight;
}

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  /** Coeficiente de determinacao (R²), entre 0 e 1. */
  rSquared: number;
}

/**
 * Regressao linear por minimos quadrados.
 * `rSquared` é 0 quando a serie nao tem variacao em x ou em y.
 */
export function linearRegression(points: Array<{ x: number; y: number }>): LinearRegressionResult {
  if (points.length < 2) {
    return { slope: 0, intercept: points[0]?.y ?? 0, rSquared: 0 };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const meanX = mean(xs);
  const meanY = mean(ys);

  let covariance = 0;
  let varianceX = 0;

  for (const point of points) {
    covariance += (point.x - meanX) * (point.y - meanY);
    varianceX += (point.x - meanX) ** 2;
  }

  if (varianceX === 0) {
    return { slope: 0, intercept: meanY, rSquared: 0 };
  }

  const slope = covariance / varianceX;
  const intercept = meanY - slope * meanX;

  let residualSumSquares = 0;
  let totalSumSquares = 0;

  for (const point of points) {
    const predicted = slope * point.x + intercept;
    residualSumSquares += (point.y - predicted) ** 2;
    totalSumSquares += (point.y - meanY) ** 2;
  }

  if (totalSumSquares === 0) {
    return { slope, intercept, rSquared: 0 };
  }

  return { slope, intercept, rSquared: 1 - residualSumSquares / totalSumSquares };
}
