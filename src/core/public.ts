/** Public, non-generated core API (shared by the ESM entry and the CDN bundles). */

export {
  DpQualifier,
  Inverter,
  Orientation,
  UiModeType,
  UnitType,
  AutoResizePercentBasis,
  type DpQualifierEntry,
} from './enums';
export { DimenMetrics, type DimenMetricsInit } from './metrics';
export {
  install,
  uninstall,
  configure,
  refresh,
  flush,
  subscribe,
  getMetrics,
  getVersion,
  setMetrics,
  register,
  registeredStrategies,
  cssDeclarations,
  detectUiModeType,
  readEnvironment,
  type WebDimensConfig,
} from './runtime';
export {
  cssDimen,
  plainRotate,
  plainMode,
  plainQualifier,
  plainScreen,
  type DimenOptions,
  type SpOptions,
  type FacilitatorOptions,
} from './api';
export { DimenBuilder, type ScreenEntry, type ScreenRule } from './builder';
export { createDimenScope, type DimenScope, type DimenScopeOptions } from './scope';
export {
  computeFactor,
  effectiveQualifier,
  readScreenDp,
  VARIANTS,
  type StrategyDef,
  type AxisVariant,
} from './strategy';
export {
  BASE_WIDTH_DP,
  BASE_HEIGHT_DP,
  BASE_DIAGONAL_DP,
  BASE_PERIMETER_DP,
  REFERENCE_ASPECT_RATIO,
  INV_BASE_RATIO,
  ADJUSTMENT_SCALE,
  SENSITIVITY_DEFAULT,
  VERSION,
} from './constants';
